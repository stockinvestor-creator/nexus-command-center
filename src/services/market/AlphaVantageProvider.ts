import type { BarSeries, Candle, CompanyProfile, MoverList, Mover, Provenance, Quote, SymbolMatch, Timeframe } from '@/types/market';
import { etToUtcMs, nextEodRefresh, nyParts } from '@/lib/marketClock';
import { callsUsedToday, useMarketStatus } from '@/store/marketStatusStore';
import { BaseProvider, MarketDataUnavailableError, PremiumEndpointError, RateLimitError, SymbolNotFoundError } from './MarketDataProvider';
import { cached } from './requestCache';

type AVParams = Record<string, string>;
type AVBar = Record<'1. open' | '2. high' | '3. low' | '4. close' | '5. volume', string>;

const DAY = 86_400_000;
const MIN_SPACING_MS = 1_300; // free tier burst limit ≈ 1 request/second

export interface AlphaVantageOptions {
  /** Returns the Supabase access token used to authenticate calls to the Netlify proxy. */
  getAuthToken?: () => Promise<string | null>;
  proxyPath?: string;
  dailyLimit?: number;
}

/**
 * Alpha Vantage free tier — END OF DAY US equity data (realtime / 15-min delayed are premium).
 *
 * The API key never reaches the browser: every call goes through netlify/functions/market.ts,
 * which reads MARKET_DATA_API_KEY server-side and verifies the caller's Supabase session.
 *
 * Budget (25 calls/day): quotes + 1M/3M bars share one TIME_SERIES_DAILY call per symbol,
 * 6M/1Y/5Y share one TIME_SERIES_WEEKLY call, everything is cached until the next close.
 */
export class AlphaVantageProvider extends BaseProvider {
  readonly id = 'alphavantage';
  readonly name = 'Alpha Vantage (free tier)';
  readonly sourceLabel = 'Alpha Vantage';
  readonly status = 'END_OF_DAY' as const;
  readonly capabilities = { quotes: true, bars: true, movers: true, search: true, profile: true };
  readonly usesNetwork = true;
  readonly refreshIntervalMs = null;
  readonly dailyLimit: number;
  readonly description =
    'End-of-day US equity data from the Alpha Vantage free tier (25 requests/day), fetched through the NEXUS Netlify Function so the key stays server-side. Cached until the next trading-day close.';

  private queue: Promise<unknown> = Promise.resolve();
  private lastCall = 0;

  constructor(private readonly opts: AlphaVantageOptions = {}) {
    super();
    this.dailyLimit = opts.dailyLimit ?? 25;
  }

  private prov(updatedAt: number | null, stale: boolean, note?: string): Provenance {
    return { source: this.sourceLabel, status: 'END_OF_DAY', updatedAt, stale, note };
  }

  /* ───── transport ───── */
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
      throw new RateLimitError(`Market data rate limit reached (${this.dailyLimit} calls/day). Showing cached data where available.`);
    }
    return this.schedule(async () => {
      const token = (await this.opts.getAuthToken?.()) ?? null;
      let res: Response;
      try {
        res = await fetch(`${this.opts.proxyPath ?? '/.netlify/functions/market'}?${new URLSearchParams(params)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {
        throw new MarketDataUnavailableError('unavailable');
      }
      useMarketStatus.getState().recordCall();
      if (res.status === 401) throw new MarketDataUnavailableError('unavailable', 'Market data proxy requires sign-in.');
      if (res.status === 404) throw new MarketDataUnavailableError('not_configured', 'Market data proxy not found (deploy to Netlify or run `netlify dev`).');
      if (res.status === 500) throw new MarketDataUnavailableError('not_configured', 'MARKET_DATA_API_KEY is not set in Netlify.');
      if (!res.ok) throw new MarketDataUnavailableError('unavailable');
      const json = (await res.json()) as Record<string, unknown>;
      const info = String(json['Note'] ?? json['Information'] ?? '');
      if (info) {
        if (/premium/i.test(info) && !/rate limit|per day|requests per/i.test(info)) throw new PremiumEndpointError();
        throw new RateLimitError();
      }
      if (json['Error Message']) throw new SymbolNotFoundError(params.symbol ?? params.keywords ?? '?');
      return json;
    });
  }

  private eodTtl = () => Math.max(15 * 60_000, nextEodRefresh() - Date.now());

  private get<T>(key: string, params: AVParams, parse: (j: Record<string, unknown>) => T, ttl: number | (() => number) = this.eodTtl) {
    return cached(`av:${key}`, ttl, async () => parse(await this.request(params)));
  }

  private daily(symbol: string) {
    return this.get(`daily:${symbol}`, { function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact' }, (j) => parseSeries(j, 'Time Series (Daily)', symbol, false));
  }
  private weekly(symbol: string) {
    return this.get(`weekly:${symbol}`, { function: 'TIME_SERIES_WEEKLY', symbol }, (j) => parseSeries(j, 'Weekly Time Series', symbol, false));
  }
  private intraday(symbol: string, interval: '5min' | '30min') {
    return this.get(`intra:${interval}:${symbol}`, { function: 'TIME_SERIES_INTRADAY', symbol, interval, outputsize: 'compact', extended_hours: 'false' }, (j) =>
      parseSeries(j, `Time Series (${interval})`, symbol, true),
    );
  }

  /* ───── MarketDataProvider ───── */
  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    const q = query.trim();
    if (!q) return [];
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
    const { value: bars, stale } = await this.daily(sym);
    const last = bars[bars.length - 1];
    const prev = bars[bars.length - 2] ?? last;
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
      // the data point is the session's daily bar; updatedAt = that trading date
      provenance: this.prov(last.time * 1000, stale),
    };
  }

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const out: Record<string, Quote> = {};
    for (const s of symbols) {
      try {
        out[s.toUpperCase()] = await this.getQuote(s);
      } catch (e) {
        if (e instanceof RateLimitError) break; // stop spending the budget
      }
    }
    return out;
  }

  async getBars(symbol: string, timeframe: Timeframe): Promise<BarSeries> {
    const sym = symbol.toUpperCase();
    const make = (bars: Candle[], stale: boolean, intraday = false, note?: string): BarSeries => ({
      symbol: sym,
      timeframe,
      bars,
      intraday,
      provenance: this.prov(bars.length ? bars[bars.length - 1].time * 1000 : null, stale, note),
    });
    const fromDaily = async (n: number, note?: string) => {
      const r = await this.daily(sym);
      return make(r.value.slice(-n), r.stale, false, note);
    };
    const fromWeekly = async (n: number) => {
      const r = await this.weekly(sym);
      return make(r.value.slice(-n), r.stale);
    };
    switch (timeframe) {
      case '1D':
      case '5D': {
        try {
          const r = await this.intraday(sym, timeframe === '1D' ? '5min' : '30min');
          const days = [...new Set(r.value.map((c) => nyParts(new Date(c.time * 1000)).date))];
          const keep = new Set(days.slice(timeframe === '1D' ? -1 : -5));
          return make(
            r.value.filter((c) => keep.has(nyParts(new Date(c.time * 1000)).date)),
            r.stale,
            true,
            'Most recent completed session (free tier is not realtime).',
          );
        } catch (e) {
          if (e instanceof PremiumEndpointError) return fromDaily(timeframe === '1D' ? 2 : 5, 'Intraday bars need a paid plan — showing daily bars.');
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
        const start = Date.UTC(new Date().getFullYear(), 0, 1) / 1000;
        const doy = Math.floor((Date.now() - start * 1000) / DAY);
        const r = doy < 130 ? await this.daily(sym) : await this.weekly(sym);
        return make(r.value.filter((c) => c.time >= start), r.stale);
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
        };
      },
      7 * DAY,
    );
    return { ...r.value, provenance: this.prov(r.fetchedAt, r.stale) };
  }

  private async movers(kind: 'top_gainers' | 'top_losers' | 'most_actively_traded'): Promise<MoverList> {
    const r = await this.get('movers', { function: 'TOP_GAINERS_LOSERS' }, (j) => j);
    const items: Mover[] = ((r.value[kind] as Record<string, string>[] | undefined) ?? []).slice(0, 20).map((m) => ({
      symbol: m.ticker,
      price: Number(m.price),
      change: Number(m.change_amount),
      changePercent: Number(String(m.change_percentage).replace('%', '')),
      volume: Number(m.volume),
    }));
    const updated = Date.parse(String(r.value['last_updated'] ?? '')) || r.fetchedAt;
    return { items, provenance: this.prov(updated, r.stale) };
  }
  getTopGainers() {
    return this.movers('top_gainers');
  }
  getTopLosers() {
    return this.movers('top_losers');
  }
  getMostActive() {
    return this.movers('most_actively_traded');
  }
}

function parseSeries(json: Record<string, unknown>, key: string, symbol: string, intraday: boolean): Candle[] {
  const series = json[key] as Record<string, AVBar> | undefined;
  if (!series) throw new SymbolNotFoundError(symbol);
  const out: Candle[] = [];
  for (const [stamp, bar] of Object.entries(series)) {
    const date = stamp.slice(0, 10);
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
