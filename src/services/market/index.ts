import { env } from '@/lib/env';
import { getAccessToken } from '@/lib/supabase';
import { safeStorage } from '@/lib/safeStorage';
import { useMarketStatus } from '@/store/marketStatusStore';
import type { MarketDataProvider } from './MarketDataProvider';
import { AlphaVantageProvider } from './AlphaVantageProvider';
import { TradingViewProvider, UnconfiguredProvider } from './TradingViewProvider';

export type { MarketDataProvider } from './MarketDataProvider';
export { MarketDataUnavailableError, RateLimitError, PremiumEndpointError, SymbolNotFoundError, isUnavailable } from './MarketDataProvider';
export { AlphaVantageProvider } from './AlphaVantageProvider';
export { TradingViewProvider } from './TradingViewProvider';

export const PROVIDER_OVERRIDE_KEY = 'ncc.mkt.providerOverride';

export interface ProviderOption {
  id: string;
  label: string;
  description: string;
}

/**
 * Registry of legitimate providers. There is intentionally NO mock/demo provider.
 * To add one (e.g. Alpaca): implement MarketDataProvider (extend BaseProvider),
 * add a case in build() and an entry here. See README.
 */
export const PROVIDER_OPTIONS: ProviderOption[] = [
  { id: 'tradingview', label: 'TradingView widgets', description: 'Official TradingView widgets for all market visuals. No NEXUS-side prices.' },
  { id: 'alphavantage', label: 'Alpha Vantage (free, end of day)', description: 'Adds end-of-day quotes/bars inside NEXUS via the Netlify proxy.' },
];

/** Recognised for future use but not implemented yet → shown as "not configured", never faked. */
const PLANNED: Record<string, string> = {
  alpaca: 'Alpaca is planned but not implemented yet. Market data inside NEXUS is unavailable; TradingView widgets still work.',
  twelvedata: 'Twelve Data is planned but not implemented yet. Market data inside NEXUS is unavailable; TradingView widgets still work.',
};

function build(id: string): MarketDataProvider {
  switch (id) {
    case 'tradingview':
      return new TradingViewProvider();
    case 'alphavantage':
      return new AlphaVantageProvider({ getAuthToken: getAccessToken });
    default:
      if (PLANNED[id]) return new UnconfiguredProvider(id, PLANNED[id]);
      if (id === 'mock' || id === 'demo')
        return new UnconfiguredProvider(id, '"mock" is no longer a valid market-data provider. Set VITE_MARKET_DATA_PROVIDER=tradingview (or alphavantage) in Netlify.');
      return new UnconfiguredProvider(id, id ? `Unknown market-data provider "${id}". No verified market-data source configured.` : 'No verified market-data source configured.');
  }
}

export function selectedProviderId(): string {
  const override = safeStorage.get<string | null>(PROVIDER_OVERRIDE_KEY, null);
  // ignore stale overrides from older versions (e.g. "mock")
  if (override && PROVIDER_OPTIONS.some((o) => o.id === override)) return override;
  return env.marketProvider;
}

let instance: MarketDataProvider | null = null;

export function marketData(): MarketDataProvider {
  if (!instance) {
    instance = build(selectedProviderId());
    useMarketStatus.getState().init({
      id: instance.id,
      name: instance.name,
      status: instance.status,
      dailyLimit: instance.dailyLimit,
    });
  }
  return instance;
}

/** Switch provider for this browser only (page reload recommended afterwards). */
export function setProviderOverride(id: string | null) {
  if (id) safeStorage.set(PROVIDER_OVERRIDE_KEY, id);
  else safeStorage.remove(PROVIDER_OVERRIDE_KEY);
  instance = null;
  marketData();
}
