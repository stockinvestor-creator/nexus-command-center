import type {
  Candle,
  CandleSeries,
  CompanyProfile,
  MarketMovers,
  Mover,
  Quote,
  SymbolMatch,
  Timeframe,
} from '@/types/market';
import { etToUtcMs, nextEodRefresh, nyParts } from '@/lib/marketClock';
import { callsUsedToday, useMarketStatus } from '@/store/marketStatusStore';
import {
  PremiumEndpointError,
  RateLimitError,
  SymbolNotFoundError,
  type MarketDataProvider,
} from './MarketDataProvider';
import { cached } from './requestCache';

type AVParams = Record<string, string>;
type AVBar = Record<'1. open' | '2. high' | '3. low' | '4. close' | '5. volume', string>;

const DAY = 86_400_000;
const MIN_SPACING_MS = 1_300; // free tier: ~1 request / second burst limit

export interface AlphaVantageOptions {
  /** Direct key (dev only — visible in the browser bundle). If empty, the Netlify proxy is used. */
  apiKey?: string;
  /** Returns the Supabase access token, used to authenticate calls to the Netlify proxy. */
  getAuthToken?: () => Promise<string | null>;
  proxyPath?: string;
  dailyLimit?: number;
}

/**
 * FreeMarketDataProvider — Alpha Vantage free tier.
 *
 * Honest data freshness: the free tier provides END-OF-DAY data for US equities
 * (realtime and 15-minute delayed US data are premium products). Everything here is labelled EOD.
 *
 * Budget: 25 requests/day. We minimise calls by:
 *  - deriving quotes AND 1M/3M charts from a single TIME_SERIES_DAILY call per symbol
 *  - deriving 6M/1Y/5Y charts from a single TIME_SERIES_WEEKLY call per symbol
 *  - caching everything until the next expected end-of-day update (~17:00 ET next trading day)
 *  - never auto-searching remotely (local symbol directory first; remote search is explicit)
 */
export class AlphaVantageProvider implements MarketDataProvider {
  readonly id = 'alphavantage';
  readonly name = 'Alpha Vantage (free tier)';
  readonly freshness = 'EOD' as const;
  readonly usesNetwork = true;
  readonly refreshIntervalMs = null;
  readonly dailyLimit: number;
  readonly description =
    'End-of-day US equity data from the Alpha Vantage free tier (25 requests/day). Responses are cached until the next trading-day close, so a normal day uses only a handful of calls.';

  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(private readonly opts: AlphaVantageOptions = {}) {
    this.dailyLimit = opts.dailyLimit ?? 25;
  }

  get mode(): 'direct' | 'proxy' {
    return this.opts.apiKey ? 'direct' : 'proxy';
  }

  /* ───────── transport ───────── */

  private schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = async () => {
      const wait = this.lastCall + MIN_SPACING_MS - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      this.lastCall = Date.now();
      return task();
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  private async request(params: AVParams): Promise<Record<string, unknown>> {
    if (callsUsedToday() >= this.dailyLimit) {
      throw new RateLimitError(`Daily limit of ${this.dailyLimit} calls reached. Serving cached data until tomorrow.`);
    }
    return this.schedule(async () => {
      let res: Response;
      if (this.opts.apiKey) {
        const qs = new URLSearchParams({ ...params, apikey: this.opts.apiKey });
        res = await fetch(`https://www.alphavantage.co/query?${qs}`);
      } else {
        const token = (await this.opts.getAuthToken?.()) ?? null;
        const qs = new URLSearchParams(params);
        res = await fetch(`${this.opts.proxyPath ?? '/.netlify/functions/market'}?${qs}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      }
      useMarketStatus.getState().recordCall();
      if (res.status === 401) throw new Error('Market proxy rejected the request (sign in required).');
      if (res.status === 404) throw new Error('Market proxy not found. Deploy to Netlify or run `netlify dev`.');
      if (!res.ok) throw new Error(`Market data request failed (${res.status})`);
      const json = (await res.json()) as Record<string, unknown>;
      const info = String(json['Note'] ?? json['Information'] ?? '');
      if (info) {
        if (/premium/i.test(info) && !/rate limit|per day|requests per/i.test(info)) throw new PremiumEndpointError(info);
        throw new RateLimitError(info);
      }
      if (json['Error Message']) throw new SymbolNotFoundError(params.symbol ?? params.keywords ?? '?');
      return json;
    });
  }

  private eodTtl = () => Math.max(15 * 60_000, nextEodRefresh() - Date.now());

  private get<T>(key: string, params: AVParams, parse: (j: Record<string, unknown>) => T, ttl: number | (() => number) = this.eodTtl) {
    return cached(`av:${key}`, ttl, async () => parse(await this.request(params)));
  }

  /* ───────── raw series (shared across quote + timeframes) ───────── */

  private async daily(symbol: string) {
    return this.get(`daily:${symbol}`, { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact' }, (j) =>
      parseSeries(j, 'Time Series (Daily)', symbol, false),
    );
  }

  private async weekly(symbol: string) {
    return this.get(`weekly:${symbol}`, { function: 'TIME_SERIES_WEEKLY', symbol }, (j) =>
      parseSeries(j, 'Weekly Time Series', symbol, false),
    );
  }

  private async intraday(symbol: string, interval: '5min' | '30min') {
    return this.get(
      `intra:${interval}:${symbol}`,
      { function: 'TIME_SERIES_INTRADAY', symbol, interval, outputsize: 'compact', extended_hours: 'false' },
      (j) => parseSeries(j, `Time Series (${interval})`, symbol, true),
    );
  }

  /* ───────── MarketDataProvider ───────── */

  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    const q = query.trim();
    if (q.length < 1) return [];
    const r = await this.get(
      `search:${q.toUpperCase()}`,
      { function: 'SYMBOL_SEARCH', keywords: q },
      (j) =>
        ((j['bestMatches'] as Record<string, string>[] | undefined) ?? []).map((m) => ({
          symbol: m['1. symbol'],
          name: m['2. name'],
          type: m['3. type'],
          region: m['4. region'],
        })),
      30 * DAY,
    );
    return r.value;
  }

  async getQuote(symbol: string): Promise<Quote> {
    const sym = symbol.toUpperCase();
    const { value: candles, fetchedAt } = await this.daily(sym);
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2] ?? last;
    if (!last) throw new SymbolNotFoundError(sym);
    const change = last.close - prev.close;
    return {
      symbol: sym,
      price: last.close,
      change,
      changePercent: prev.close ? (change / prev.close) * 100 : 0,
      open: last.open,
      high: last.high,
      low: last.low,
      previousClose: prev.close,
      volume: last.volume,
      asOf: Math.min(fetchedAt, last.time * 1000 + DAY),
      freshness: 'EOD',
    };
  }

  async getCandles(symbol: string, timeframe: Timeframe): Promise<CandleSeries> {
    const sym = symbol.toUpperCase();
    const base = { symbol: sym, timeframe, freshness: 'EOD' as const };
    const fromDaily = async (n: number, note?: string): Promise<CandleSeries> => {
      const { value } = await this.daily(sym);
      return { ...base, candles: value.slice(-n), intraday: false, note };
    };
    const fromWeekly = async (n: number): Promise<CandleSeries> => {
      const { value } = await this.weekly(sym);
      return { ...base, candles: value.slice(-n), intraday: false };
    };

    switch (timeframe) {
      case '1D':
      case '5D': {
        try {
          const interval = timeframe === '1D' ? '5min' : '30min';
          const { value } = await this.intraday(sym, interval);
          const days = [...new Set(value.map((c) => nyParts(new Date(c.time * 1000)).date))];
          const keep = new Set(days.slice(timeframe === '1D' ? -1 : -5));
          const candles = value.filter((c) => keep.has(nyParts(new Date(c.time * 1000)).date));
          return { ...base, candles, intraday: true, note: 'Intraday bars from the most recent completed data (free tier).' };
        } catch (e) {
          if (e instanceof PremiumEndpointError) {
            return fromDaily(timeframe === '1D' ? 2 : 5, 'Intraday data needs a premium plan — showing daily bars.');
          }
          throw e;
        }
      }
      case '1M':
        return fromDaily(22);
      case '3M':
        return fromDaily(64);
      case '6M':
        return fromWeekly(27);
      case 'YTD': {
        const year = new Date().getFullYear();
        const start = Date.UTC(year, 0, 1) / 1000;
        const doy = Math.floor((Date.now() - start * 1000) / DAY);
        if (doy < 130) {
          const { value } = await this.daily(sym);
          return { ...base, candles: value.filter((c) => c.time >= start), intraday: false };
        }
        const { value } = await this.weekly(sym);
        return { ...base, candles: value.filter((c) => c.time >= start), intraday: false };
      }
      case '1Y':
        return fromWeekly(53);
      case '5Y':
        return fromWeekly(261);
    }
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const sym = symbol.toUpperCase();
    const r = await this.get(
      `overview:${sym}`,
      { function: 'OVERVIEW', symbol: sym },
      (j) => {
        const n = (k: string) => {
          const v = Number(j[k]);
          return Number.isFinite(v) ? v : undefined;
        };
        if (!j['Symbol']) throw new SymbolNotFoundError(sym);
        return {
          symbol: sym,
          name: String(j['Name'] ?? sym),
          exchange: j['Exchange'] as string | undefined,
          sector: j['Sector'] as string | undefined,
          industry: j['Industry'] as string | undefined,
          description: j['Description'] as string | undefined,
          marketCap: n('MarketCapitalization'),
          peRatio: n('PERatio'),
          week52High: n('52WeekHigh'),
          week52Low: n('52WeekLow'),
          sharesOutstanding: n('SharesOutstanding'),
          website: j['OfficialSite'] as string | undefined,
          freshness: 'EOD' as const,
        };
      },
      7 * DAY,
    );
    return r.value;
  }

  async getMarketMovers(): Promise<MarketMovers> {
    const r = await this.get('movers', { function: 'TOP_GAINERS_LOSERS' }, (j) => {
      const map = (arr: unknown): Mover[] =>
        ((arr as Record<string, string>[] | undefined) ?? []).slice(0, 10).map((m) => ({
          symbol: m.ticker,
          price: Number(m.price),
          change: Number(m.change_amount),
          changePercent: Number(String(m.change_percentage).replace('%', '')),
          volume: Number(m.volume),
        }));
      return {
        gainers: map(j['top_gainers']),
        losers: map(j['top_losers']),
        mostActive: map(j['most_actively_traded']),
        asOf: Date.now(),
        freshness: 'EOD' as const,
      };
    });
    return { ...r.value, asOf: r.fetchedAt };
  }
}

/* ───────── parsing ───────── */

function parseSeries(json: Record<string, unknown>, key: string, symbol: string, intraday: boolean): Candle[] {
  const series = json[key] as Record<string, AVBar> | undefined;
  if (!series) throw new SymbolNotFoundError(symbol);
  const out: Candle[] = [];
  for (const [stamp, bar] of Object.entries(series)) {
    const date = stamp.slice(0, 10);
    // Alpha Vantage intraday timestamps are US/Eastern wall-clock times (bar end); daily bars → 09:30 ET
    const minutes = intraday ? Number(stamp.slice(11, 13)) * 60 + Number(stamp.slice(14, 16)) : 570;
    out.push({
      time: Math.floor(etToUtcMs(date, minutes) / 1000),
      open: Number(bar['1. open']),
      high: Number(bar['2. high']),
      low: Number(bar['3. low']),
      close: Number(bar['4. close']),
      volume: Number(bar['5. volume']),
    });
  }
  return out.sort((a, b) => a.time - b.time);
}
