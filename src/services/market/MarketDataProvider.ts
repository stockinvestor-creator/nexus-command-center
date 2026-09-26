import type {
  CandleSeries,
  CompanyProfile,
  DataFreshness,
  MarketMovers,
  Quote,
  SymbolMatch,
  Timeframe,
} from '@/types/market';

/**
 * Every market data source implements this interface.
 * To add a provider: implement it, then register it in services/market/index.ts.
 */
export interface MarketDataProvider {
  /** Stable id used in VITE_MARKET_DATA_PROVIDER */
  readonly id: string;
  readonly name: string;
  /** Freshness of the data this provider returns under its current plan */
  readonly freshness: DataFreshness;
  /** Max API calls per day under the free tier (null = unlimited / local) */
  readonly dailyLimit: number | null;
  /** False for providers that generate data locally (no network, no cost) */
  readonly usesNetwork: boolean;
  /** Suggested client refresh interval for quotes in ms (null = only on demand / cache expiry) */
  readonly refreshIntervalMs: number | null;
  /** Human-readable explanation shown in Settings → Market Data Status */
  readonly description: string;

  searchSymbols(query: string): Promise<SymbolMatch[]>;
  getQuote(symbol: string): Promise<Quote>;
  getCandles(symbol: string, timeframe: Timeframe): Promise<CandleSeries>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile>;
  getMarketMovers(): Promise<MarketMovers>;
}

export class RateLimitError extends Error {
  constructor(message = 'Market data API limit reached. Showing cached data.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class PremiumEndpointError extends Error {
  constructor(message = 'This endpoint is not available on the free tier.') {
    super(message);
    this.name = 'PremiumEndpointError';
  }
}

export class SymbolNotFoundError extends Error {
  constructor(symbol: string) {
    super(`No data found for ${symbol}`);
    this.name = 'SymbolNotFoundError';
  }
}
