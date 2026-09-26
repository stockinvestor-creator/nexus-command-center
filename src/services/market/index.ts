import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/supabase';
import { safeStorage } from '@/lib/safeStorage';
import { useMarketStatus } from '@/store/marketStatusStore';
import type { MarketDataProvider } from './MarketDataProvider';
import { MockMarketDataProvider } from './MockMarketDataProvider';
import { AlphaVantageProvider } from './AlphaVantageProvider';

export type { MarketDataProvider } from './MarketDataProvider';
export { RateLimitError, PremiumEndpointError, SymbolNotFoundError } from './MarketDataProvider';

/** Alias required by the spec: the free, real-data provider. */
export { AlphaVantageProvider as FreeMarketDataProvider } from './AlphaVantageProvider';
export { MockMarketDataProvider } from './MockMarketDataProvider';

export const PROVIDER_OVERRIDE_KEY = 'ncc.mkt.providerOverride';

export interface ProviderOption {
  id: string;
  label: string;
  description: string;
}

/**
 * Provider registry. To add a new provider:
 *   1. implement MarketDataProvider in services/market/YourProvider.ts
 *   2. add a case below and an entry to PROVIDER_OPTIONS
 *   3. set VITE_MARKET_DATA_PROVIDER=<id> (or switch in Settings)
 */
export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: 'mock', label: 'Demo (synthetic)', description: 'Zero-config synthetic data, labelled DEMO.' },
  { id: 'alphavantage', label: 'Alpha Vantage (free)', description: 'Real end-of-day data, 25 calls/day, labelled EOD.' },
];

function build(id: string): MarketDataProvider {
  switch (id) {
    case 'alphavantage':
    case 'alpha_vantage':
    case 'free':
      return new AlphaVantageProvider({ apiKey: env.marketApiKey || undefined, getAuthToken: getAccessToken });
    case 'mock':
    default:
      return new MockMarketDataProvider();
  }
}

export function selectedProviderId(): string {
  return safeStorage.get<string | null>(PROVIDER_OVERRIDE_KEY, null) ?? env.marketProvider;
}

let instance: MarketDataProvider | null = null;

export function marketData(): MarketDataProvider {
  if (!instance) {
    instance = build(selectedProviderId());
    useMarketStatus.getState().init({
      id: instance.id,
      name: instance.name,
      freshness: instance.freshness,
      dailyLimit: instance.dailyLimit,
    });
  }
  return instance;
}

/** Switch provider at runtime (persisted per browser). Page reload recommended afterwards. */
export function setProviderOverride(id: string | null) {
  if (id) safeStorage.set(PROVIDER_OVERRIDE_KEY, id);
  else safeStorage.remove(PROVIDER_OVERRIDE_KEY);
  instance = null;
  marketData();
}
