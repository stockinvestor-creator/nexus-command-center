/** How fresh a piece of market data is. Shown next to every market-data component. */
export type DataFreshness = 'LIVE' | 'DELAYED' | 'EOD' | 'DEMO';

export type Timeframe = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '5Y';
export const TIMEFRAMES: Timeframe[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '5Y'];

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
  /** Epoch ms of the underlying data point (not the fetch time) */
  asOf: number;
  freshness: DataFreshness;
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

export interface CandleSeries {
  symbol: string;
  timeframe: Timeframe;
  candles: Candle[];
  intraday: boolean;
  freshness: DataFreshness;
  /** Human-readable caveat, e.g. when a timeframe fell back to daily bars */
  note?: string;
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
  freshness: DataFreshness;
}

export interface Mover {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

export interface MarketMovers {
  gainers: Mover[];
  losers: Mover[];
  mostActive: Mover[];
  asOf: number;
  freshness: DataFreshness;
}

export type MarketSession = 'pre' | 'open' | 'after' | 'closed';
