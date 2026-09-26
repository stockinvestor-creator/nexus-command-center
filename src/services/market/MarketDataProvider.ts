import type {
  BarSeries,
  Capability,
  CompanyProfile,
  DataStatus,
  MarketStatusInfo,
  MoverList,
  Quote,
  SymbolMatch,
  Timeframe,
} from '@/types/market';
import { marketSession } from '@/lib/marketClock';

export type UnavailableReason = 'not_configured' | 'unsupported' | 'rate_limited' | 'unavailable' | 'not_found';

/** The ONLY way a provider may answer when it has no verified data. Never substitute values. */
export class MarketDataUnavailableError extends Error {
  constructor(
    public readonly reason: UnavailableReason,
    message?: string,
  ) {
    super(message ?? DEFAULT_MESSAGES[reason]);
    this.name = 'MarketDataUnavailableError';
  }
}

export const DEFAULT_MESSAGES: Record<UnavailableReason, string> = {
  not_configured: 'No verified market-data source configured',
  unsupported: 'Market data unavailable from the configured source',
  rate_limited: 'Market data rate limit reached',
  unavailable: 'Market data temporarily unavailable',
  not_found: 'No market data found for this symbol',
};

export class RateLimitError extends MarketDataUnavailableError {
  constructor(message?: string) {
    super('rate_limited', message ?? DEFAULT_MESSAGES.rate_limited);
    this.name = 'RateLimitError';
  }
}

export class PremiumEndpointError extends MarketDataUnavailableError {
  constructor(message?: string) {
    super('unsupported', message ?? 'This data requires a paid plan with the configured provider');
    this.name = 'PremiumEndpointError';
  }
}

export class SymbolNotFoundError extends MarketDataUnavailableError {
  constructor(symbol: string) {
    super('not_found', `No market data found for ${symbol}`);
    this.name = 'SymbolNotFoundError';
  }
}

export const isUnavailable = (e: unknown): e is MarketDataUnavailableError => e instanceof MarketDataUnavailableError;

/**
 * Every programmatic market-data source implements this interface.
 * Methods a provider can't serve MUST throw MarketDataUnavailableError('unsupported').
 * To add a provider (Alpaca, Twelve Data, …) see README → "Adding a market-data provider".
 */
export interface MarketDataProvider {
  /** Value of VITE_MARKET_DATA_PROVIDER that selects this provider */
  readonly id: string;
  readonly name: string;
  /** Shown in provenance badges, e.g. "Alpha Vantage" */
  readonly sourceLabel: string;
  /** Freshness this provider guarantees for its quotes/bars (null when it serves none) */
  readonly status: DataStatus | null;
  readonly capabilities: Readonly<Record<Capability, boolean>>;
  /** Max API calls/day on the current plan (null = no fixed daily cap) */
  readonly dailyLimit: number | null;
  readonly usesNetwork: boolean;
  /** Suggested quote refresh interval (null = only when cache expires) */
  readonly refreshIntervalMs: number | null;
  readonly description: string;
  /** Set when the provider is a placeholder for a missing/invalid configuration */
  readonly configurationError?: string;

  searchSymbols(query: string): Promise<SymbolMatch[]>;
  getQuote(symbol: string): Promise<Quote>;
  getQuotes(symbols: string[]): Promise<Record<string, Quote>>;
  getBars(symbol: string, timeframe: Timeframe): Promise<BarSeries>;
  getCompanyProfile(symbol: string): Promise<CompanyProfile>;
  getTopGainers(): Promise<MoverList>;
  getTopLosers(): Promise<MoverList>;
  getMostActive(): Promise<MoverList>;
  getMarketStatus(): Promise<MarketStatusInfo>;
}

const NONE: Record<Capability, boolean> = { quotes: false, bars: false, movers: false, search: false, profile: false };

/**
 * Base class: every data method answers "unavailable". Subclasses override only what they
 * can genuinely serve. Market status is schedule-based (NYSE calendar) and always available.
 */
export abstract class BaseProvider implements MarketDataProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly sourceLabel: string;
  abstract readonly description: string;
  readonly status: DataStatus | null = null;
  readonly capabilities: Readonly<Record<Capability, boolean>> = NONE;
  readonly dailyLimit: number | null = null;
  readonly usesNetwork: boolean = false;
  readonly refreshIntervalMs: number | null = null;
  readonly configurationError?: string;

  protected unsupported(): never {
    throw new MarketDataUnavailableError(this.configurationError ? 'not_configured' : 'unsupported', this.configurationError);
  }

  async searchSymbols(_query: string): Promise<SymbolMatch[]> {
    void _query;
    return this.unsupported();
  }
  async getQuote(_symbol: string): Promise<Quote> {
    void _symbol;
    return this.unsupported();
  }
  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const out: Record<string, Quote> = {};
    for (const s of symbols) out[s.toUpperCase()] = await this.getQuote(s);
    return out;
  }
  async getBars(_symbol: string, _timeframe: Timeframe): Promise<BarSeries> {
    void _symbol;
    void _timeframe;
    return this.unsupported();
  }
  async getCompanyProfile(_symbol: string): Promise<CompanyProfile> {
    void _symbol;
    return this.unsupported();
  }
  async getTopGainers(): Promise<MoverList> {
    return this.unsupported();
  }
  async getTopLosers(): Promise<MoverList> {
    return this.unsupported();
  }
  async getMostActive(): Promise<MoverList> {
    return this.unsupported();
  }
  async getMarketStatus(): Promise<MarketStatusInfo> {
    return { session: marketSession(), source: 'NYSE calendar', checkedAt: Date.now() };
  }
}
