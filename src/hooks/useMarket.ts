import { marketData } from '@/services/market';
import type { Quote, Timeframe } from '@/types/market';
import { useMarketQuery } from './useMarketQuery';

const refresh = () => marketData().refreshIntervalMs;

export function useQuote(symbol: string | null | undefined) {
  const sym = symbol?.toUpperCase() ?? null;
  return useMarketQuery(sym ? `quote:${sym}` : null, () => marketData().getQuote(sym!), {
    refreshMs: refresh(),
    staleMs: 15_000,
  });
}

export function useCandles(symbol: string | null | undefined, timeframe: Timeframe) {
  const sym = symbol?.toUpperCase() ?? null;
  return useMarketQuery(sym ? `candles:${sym}:${timeframe}` : null, () => marketData().getCandles(sym!, timeframe), {
    refreshMs: timeframe === '1D' ? refresh() && 60_000 : null,
    staleMs: 60_000,
  });
}

export function useCompanyProfile(symbol: string | null | undefined) {
  const sym = symbol?.toUpperCase() ?? null;
  return useMarketQuery(sym ? `profile:${sym}` : null, () => marketData().getCompanyProfile(sym!), {
    staleMs: 10 * 60_000,
  });
}

export function useMarketMovers() {
  return useMarketQuery('movers', () => marketData().getMarketMovers(), { refreshMs: refresh() && 60_000 });
}

/** Quotes for many symbols at once (settled individually; failures are skipped). */
export function useQuotes(symbols: string[]) {
  const syms = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();
  const key = syms.length ? `quotes:${syms.join(',')}` : null;
  return useMarketQuery(
    key,
    async () => {
      const res = await Promise.allSettled(syms.map((s) => marketData().getQuote(s)));
      const out: Record<string, Quote> = {};
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') out[syms[i]] = r.value;
      });
      return out;
    },
    { refreshMs: refresh(), staleMs: 20_000 },
  );
}
