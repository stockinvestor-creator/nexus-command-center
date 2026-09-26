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
import {
  currentSessionDate,
  etToUtcMs,
  isEarlyClose,
  marketSession,
  nyParts,
  tradingDatesBetween,
} from '@/lib/marketClock';
import type { MarketDataProvider } from './MarketDataProvider';
import { lookupUniverse, searchUniverse, UNIVERSE, type UniverseEntry } from './universe';

/* ───────── deterministic RNG ───────── */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const HISTORY_START = '2019-01-02';
const ANCHOR_DATE = '2026-06-01';
const round = (n: number) => Math.round(n * 100) / 100;

function entryFor(symbol: string): UniverseEntry {
  const known = lookupUniverse(symbol);
  if (known) return known;
  const h = hash(symbol);
  return {
    symbol,
    name: `${symbol} (demo)`,
    exchange: 'DEMO',
    sector: 'Unknown',
    industry: 'Unknown',
    base: 5 + (h % 300),
    vol: 0.3 + ((h >> 8) % 60) / 100,
  };
}

interface DayPlan {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface SessionState {
  daily: Candle[]; // includes the current/most recent session (possibly partial)
  todayBars: Candle[]; // 5-minute bars of the current/most recent session (elapsed only)
  plans: DayPlan[];
  sessionDate: string;
}

/**
 * DEMO data generator. Produces stable, realistic-looking synthetic OHLCV so the whole UI
 * can be tested with zero configuration. Every value it returns is labelled DEMO.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly id = 'mock';
  readonly name = 'Demo Data (synthetic)';
  readonly freshness = 'DEMO' as const;
  readonly dailyLimit = null;
  readonly usesNetwork = false;
  readonly refreshIntervalMs = 20_000;
  readonly description =
    'Synthetic prices generated in your browser. Nothing here is real market data — use it to test the interface.';

  private planCache = new Map<string, DayPlan[]>();
  private stateCache = new Map<string, { key: string; state: SessionState }>();

  private delay<T>(v: T, ms = 90 + Math.random() * 120): Promise<T> {
    return new Promise((r) => setTimeout(() => r(v), ms));
  }

  /** Full daily history from HISTORY_START → session date (deterministic; history never changes). */
  private plans(symbol: string, sessionDate: string): DayPlan[] {
    const cacheKey = `${symbol}|${sessionDate}`;
    const cached = this.planCache.get(cacheKey);
    if (cached) return cached;
    const e = entryFor(symbol);
    const rng = mulberry32(hash(symbol));
    const dates = tradingDatesBetween(HISTORY_START, sessionDate);
    const dailyVol = e.vol / Math.sqrt(252);
    const baseVolume = 2e6 + (hash(symbol + 'v') % 60) * 1e6;
    let close = 100;
    const out: DayPlan[] = [];
    for (const date of dates) {
      const regime = Math.sin(out.length / 90 + (hash(symbol) % 7)) * 0.0006;
      const gap = gaussian(rng) * dailyVol * 0.25;
      const open = Math.max(0.05, close * (1 + gap));
      const ret = 0.00035 + regime + gaussian(rng) * dailyVol;
      const c = Math.max(0.05, open * (1 + ret));
      const high = Math.max(open, c) * (1 + Math.abs(gaussian(rng)) * dailyVol * 0.45);
      const low = Math.min(open, c) * (1 - Math.abs(gaussian(rng)) * dailyVol * 0.45);
      const volume = Math.round(baseVolume * (0.55 + rng() * 0.9) * (1 + Math.abs(ret) * 18));
      out.push({ date, open, high, low, close: c, volume });
      close = c;
    }
    // Anchor the synthetic series so it sits near a realistic level at a FIXED date.
    // (Fixed anchor → history never shifts from one day to the next.)
    const anchorIdx = out.findLastIndex((d) => d.date <= ANCHOR_DATE);
    const anchor = out[anchorIdx >= 0 ? anchorIdx : out.length - 1];
    const k = anchor ? e.base / anchor.close : 1;
    for (const d of out) {
      d.open = round(d.open * k);
      d.high = round(d.high * k);
      d.low = round(d.low * k);
      d.close = round(d.close * k);
    }
    this.planCache.set(cacheKey, out);
    if (this.planCache.size > 200) this.planCache.delete(this.planCache.keys().next().value as string);
    return out;
  }

  /** Brownian bridge of `n` bars from plan.open → plan.close within the day's range. */
  private intradayBars(symbol: string, plan: DayPlan, n: number, minutesPerBar: number): Candle[] {
    const rng = mulberry32(hash(`${symbol}|${plan.date}|${n}`));
    const walk: number[] = [0];
    for (let i = 1; i <= n; i++) walk.push(walk[i - 1] + gaussian(rng));
    const span = Math.max(plan.high - plan.low, plan.close * 0.002);
    const scale = span / (Math.max(...walk) - Math.min(...walk) || 1) * 0.55;
    const path = walk.map((w, i) => plan.open + (w - (i / n) * walk[n]) * scale + (i / n) * (plan.close - plan.open));
    const bars: Candle[] = [];
    const u = plan.volume / n;
    for (let i = 0; i < n; i++) {
      const o = path[i];
      const c = path[i + 1];
      const wiggle = Math.abs(gaussian(rng)) * span * 0.04;
      const time = Math.floor(etToUtcMs(plan.date, 570 + i * minutesPerBar) / 1000);
      const edge = i < 6 || i > n - 7 ? 1.8 : 0.8; // U-shaped volume
      bars.push({
        time,
        open: round(o),
        close: round(c),
        high: round(Math.min(plan.high, Math.max(o, c) + wiggle)),
        low: round(Math.max(plan.low, Math.min(o, c) - wiggle)),
        volume: Math.round(u * edge * (0.6 + rng() * 0.8)),
      });
    }
    return bars;
  }

  private state(symbol: string): SessionState {
    const now = new Date();
    const sessionDate = currentSessionDate(now);
    const p = nyParts(now);
    const closeMin = isEarlyClose(sessionDate) ? 780 : 960;
    const barsPerDay = (closeMin - 570) / 5;
    const live = p.date === sessionDate && p.minutes < closeMin;
    const elapsed = live ? Math.max(1, Math.min(barsPerDay, Math.floor((p.minutes - 570) / 5) + 1)) : barsPerDay;
    const key = `${sessionDate}|${elapsed}`;
    const hit = this.stateCache.get(symbol);
    if (hit && hit.key === key) return hit.state;

    const plans = this.plans(symbol, sessionDate);
    const last = plans[plans.length - 1];
    const allBars = this.intradayBars(symbol, last, barsPerDay, 5);
    const todayBars = allBars.slice(0, elapsed);
    const daily: Candle[] = plans.map((d) => ({
      time: Math.floor(etToUtcMs(d.date, 570) / 1000),
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      volume: d.volume,
    }));
    if (live) {
      daily[daily.length - 1] = {
        time: daily[daily.length - 1].time,
        open: todayBars[0].open,
        high: Math.max(...todayBars.map((b) => b.high)),
        low: Math.min(...todayBars.map((b) => b.low)),
        close: todayBars[todayBars.length - 1].close,
        volume: todayBars.reduce((s, b) => s + b.volume, 0),
      };
    }
    const state = { daily, todayBars, plans, sessionDate };
    this.stateCache.set(symbol, { key, state });
    return state;
  }

  private quoteSync(symbol: string): Quote {
    const sym = symbol.toUpperCase();
    const { daily } = this.state(sym);
    const today = daily[daily.length - 1];
    const prev = daily[daily.length - 2] ?? today;
    let price = today.close;
    if (marketSession() !== 'closed') {
      // gentle "tick" so the demo feels alive; changes every 15 seconds
      const tick = mulberry32(hash(`${sym}|${Math.floor(Date.now() / 15000)}`));
      price = round(price * (1 + (tick() - 0.5) * 0.003));
    }
    const change = round(price - prev.close);
    return {
      symbol: sym,
      price,
      change,
      changePercent: (change / prev.close) * 100,
      open: today.open,
      high: Math.max(today.high, price),
      low: Math.min(today.low, price),
      previousClose: prev.close,
      volume: today.volume,
      asOf: Date.now(),
      freshness: 'DEMO',
    };
  }

  async searchSymbols(query: string): Promise<SymbolMatch[]> {
    return this.delay(searchUniverse(query, 10), 40);
  }

  async getQuote(symbol: string): Promise<Quote> {
    return this.delay(this.quoteSync(symbol));
  }

  async getCandles(symbol: string, timeframe: Timeframe): Promise<CandleSeries> {
    const sym = symbol.toUpperCase();
    const st = this.state(sym);
    let candles: Candle[];
    let intraday = false;
    switch (timeframe) {
      case '1D':
        candles = st.todayBars;
        intraday = true;
        break;
      case '5D': {
        const plans = st.plans.slice(-5);
        candles = [];
        plans.forEach((pl, idx) => {
          const isLast = idx === plans.length - 1;
          if (isLast) {
            // aggregate today's elapsed 5-min bars into 30-min bars
            for (let i = 0; i < st.todayBars.length; i += 6) {
              const chunk = st.todayBars.slice(i, i + 6);
              candles.push({
                time: chunk[0].time,
                open: chunk[0].open,
                close: chunk[chunk.length - 1].close,
                high: Math.max(...chunk.map((c) => c.high)),
                low: Math.min(...chunk.map((c) => c.low)),
                volume: chunk.reduce((s, c) => s + c.volume, 0),
              });
            }
          } else {
            const n = isEarlyClose(pl.date) ? 7 : 13;
            candles.push(...this.intradayBars(sym, pl, n, 30));
          }
        });
        intraday = true;
        break;
      }
      case '1M':
        candles = st.daily.slice(-22);
        break;
      case '3M':
        candles = st.daily.slice(-64);
        break;
      case '6M':
        candles = st.daily.slice(-127);
        break;
      case 'YTD': {
        const year = st.sessionDate.slice(0, 4);
        const idx = st.plans.findIndex((p) => p.date.startsWith(year));
        candles = st.daily.slice(Math.max(0, idx));
        break;
      }
      case '1Y':
        candles = st.daily.slice(-253);
        break;
      case '5Y':
        candles = toWeekly(st.daily.slice(-1262));
        break;
    }
    return this.delay({ symbol: sym, timeframe, candles, intraday, freshness: 'DEMO' });
  }

  async getCompanyProfile(symbol: string): Promise<CompanyProfile> {
    const sym = symbol.toUpperCase();
    const e = entryFor(sym);
    const q = this.quoteSync(sym);
    const yr = this.state(sym).daily.slice(-253);
    const shares = (hash(sym + 's') % 4000) * 1e6 + 5e7;
    return this.delay({
      symbol: sym,
      name: e.name,
      exchange: e.exchange,
      sector: e.sector,
      industry: e.industry,
      description:
        'DEMO profile. Company name, exchange and sector come from the built-in symbol directory; all numbers on this page are synthetic. Connect a real provider in Settings to see actual fundamentals.',
      marketCap: shares * q.price,
      sharesOutstanding: shares,
      week52High: Math.max(...yr.map((c) => c.high)),
      week52Low: Math.min(...yr.map((c) => c.low)),
      freshness: 'DEMO',
    });
  }

  async getMarketMovers(): Promise<MarketMovers> {
    const movers: Mover[] = UNIVERSE.filter((u) => u.sector !== 'ETF').map((u) => {
      const q = this.quoteSync(u.symbol);
      return { symbol: u.symbol, price: q.price, change: q.change, changePercent: q.changePercent, volume: q.volume ?? 0 };
    });
    const byPct = [...movers].sort((a, b) => b.changePercent - a.changePercent);
    return this.delay({
      gainers: byPct.slice(0, 10),
      losers: byPct.slice(-10).reverse(),
      mostActive: [...movers].sort((a, b) => b.volume - a.volume).slice(0, 10),
      asOf: Date.now(),
      freshness: 'DEMO',
    });
  }
}

function toWeekly(daily: Candle[]): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let curWeek = -1;
  for (const c of daily) {
    const d = new Date(c.time * 1000);
    const monday = Math.floor((c.time - ((d.getUTCDay() + 6) % 7) * 86400) / 86400);
    if (monday !== curWeek || !cur) {
      if (cur) out.push(cur);
      cur = { ...c };
      curWeek = monday;
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    }
  }
  if (cur) out.push(cur);
  return out;
}
