import { marketData, MarketDataUnavailableError } from '@/services/market';
import type { UnavailableReason } from '@/services/market/MarketDataProvider';
import type { BarSeries, Capability, CompanyProfile, MoverList, Quote, Timeframe } from '@/types/market';
import { useMarketQuery, type QueryState } from './useMarketQuery';

export interface MarketState<T> extends QueryState<T> {
  /** The configured provider cannot serve this at all (show "unavailable", never a substitute) */
  unsupported: boolean;
  /** Why data is missing, when it is */
  reason?: UnavailableReason;
}

function useGated<T>(cap: Capability, key: string | null, fn: () => Promise<T>, opts: { refreshMs?: number | null; staleMs?: number } = {}): MarketState<T> {
  const p = marketData();
  const ok = p.capabilities[cap];
  const q = useMarketQuery(ok ? key : null, fn, opts);
  const reason: UnavailableReason | undefined = !ok
    ? p.configurationError
      ? 'not_configured'
      : 'unsupported'
    : q.error instanceof MarketDataUnavailableError
      ? q.error.reason
      : q.error
        ? 'unavailable'
        : undefined;
  return { ...q, loading: ok && q.loading, unsupported: !ok, reason };
}

const refresh = () => marketData().refreshIntervalMs;

export function useQuote(symbol: string | null | undefined): MarketState<Quote> {
  const sym = symbol?.toUpperCase() ?? null;
  return useGated('quotes', sym ? `quote:${sym}` : null, () => marketData().getQuote(sym!), { refreshMs: refresh(), staleMs: 15_000 });
}

export function useQuotes(symbols: string[]): MarketState<Record<string, Quote>> {
  const syms = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  return useGated('quotes', syms.length ? `quotes:${syms.join(',')}` : null, () => marketData().getQuotes(syms), { refreshMs: refresh(), staleMs: 20_000 });
}

export function useBars(symbol: string | null | undefined, timeframe: Timeframe): MarketState<BarSeries> {
  const sym = symbol?.toUpperCase() ?? null;
  return useGated('bars', sym ? `bars:${sym}:${timeframe}` : null, () => marketData().getBars(sym!, timeframe), { staleMs: 60_000 });
}

export function useCompanyProfile(symbol: string | null | undefined): MarketState<CompanyProfile> {
  const sym = symbol?.toUpperCase() ?? null;
  return useGated('profile', sym ? `profile:${sym}` : null, () => marketData().getCompanyProfile(sym!), { staleMs: 10 * 60_000 });
}

export type MoverKind = 'gainers' | 'losers' | 'active';
export function useMovers(kind: MoverKind): MarketState<MoverList> {
  const p = marketData();
  const fn = kind === 'gainers' ? () => p.getTopGainers() : kind === 'losers' ? () => p.getTopLosers() : () => p.getMostActive();
  return useGated('movers', `movers:${kind}`, fn, { staleMs: 60_000 });
}
