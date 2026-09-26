/**
 * Market-data types.
 *
 * RULE: NEXUS never displays invented market data. Every market value shown by NEXUS
 * (outside an embedded TradingView widget) carries a Provenance: where it came from,
 * how fresh it is, and when it was last updated.
 */

/** Freshness that the configured provider can actually guarantee. */
export type DataStatus =
  /** Realtime quotes from the IEX exchange only (e.g. Alpaca Basic). NOT the consolidated market. */
  | 'REALTIME_IEX'
  /** Consolidated realtime (paid entitlements only). */
  | 'REALTIME'
  /** Delayed (typically 15+ minutes). */
  | 'DELAYED'
  /** End-of-day / previous close. */
  | 'END_OF_DAY';

export interface Provenance {
  /** Human-readable source, e.g. "Alpha Vantage" */
  source: string;
  status: DataStatus;
  /** Epoch ms of the underlying data point, when known */
  updatedAt: number | null;
  /** True when served from cache because the provider failed or hit its limit */
  stale?: boolean;
  note?: string;
}

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y';
export const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y'];

export type Exchange = 'NASDAQ' | 'NYSE' | 'AMEX';

/** A symbol as NEXUS understands it. `tvSymbol` is what TradingView widgets receive. */
export interface ResolvedSymbol {
  ticker: string;
  exchange: Exchange | null;
  /** "NASDAQ:NVDA" when the exchange is known, otherwise the bare ticker (TradingView resolves it) */
  tvSymbol: string;
  name?: string;
  /** True when the exchange is known from the directory or typed explicitly by the user */
  verified: boolean;
}

export interface SymbolMatch {
  symbol: string;
  name: string;
  exchange?: string;
  type?: string;
  region?: string;
}

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  open?: number;
  high?: number;
  low?: number;
  previousClose?: number;
  volume?: number;
  provenance: Provenance;
}

export interface Candle {
  /** UTC seconds */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BarSeries {
  symbol: string;
  timeframe: Timeframe;
  bars: Candle[];
  intraday: boolean;
  provenance: Provenance;
}

export interface CompanyProfile {
  symbol: string;
  name: string;
  exchange?: string;
  sector?: string;
  industry?: string;
  description?: string;
  marketCap?: number;
  peRatio?: number;
  week52High?: number;
  week52Low?: number;
  sharesOutstanding?: number;
  website?: string;
  provenance: Provenance;
}

export interface Mover {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface MoverList {
  items: Mover[];
  provenance: Provenance;
}

export type MarketSession = 'pre' | 'open' | 'after' | 'closed';

export interface MarketStatusInfo {
  session: MarketSession;
  /** Always schedule-based: computed from the published NYSE calendar, not from a data feed */
  source: 'NYSE calendar';
  checkedAt: number;
}

export type Capability = 'quotes' | 'bars' | 'movers' | 'search' | 'profile';
