import { useMemo } from 'react';
import { intel, type Fetched } from '@/services/intel/client';
import { useMarketQuery, type QueryState } from './useMarketQuery';
import type { IntelResponse } from '@/types/intel';

/** Keys whose next load should bypass the client cache (manual "Refresh"). */
const forceNext = new Set<string>();
const consume = (k: string | null) => (k ? forceNext.delete(k) : false);

/** Shared-cache hooks (same key ⇒ one request across all components). */
const key = (name: string, tickers: string[]) => `intel:${name}:${[...new Set(tickers.map((t) => t.toUpperCase()))].sort().join(',')}`;

export type IntelQuery = QueryState<Fetched<IntelResponse>>;

export function useSecFilings(tickers: string[]): IntelQuery {
  const k = tickers.length ? key('sec', tickers) : null;
  return useMarketQuery(k, () => intel.secFilings(tickers, consume(k)), { staleMs: 5 * 60_000, refreshMs: 10 * 60_000 });
}
export function useLatestFilings(form: string): IntelQuery {
  const k = `intel:latest:${form}`;
  return useMarketQuery(k, () => intel.latestFilings(form, consume(k)), { staleMs: 3 * 60_000, refreshMs: 5 * 60_000 });
}
export function useNews(tickers: string[]): IntelQuery {
  const k = tickers.length ? key('news', tickers) : null;
  return useMarketQuery(k, () => intel.news(tickers, consume(k)), { staleMs: 15 * 60_000, refreshMs: 30 * 60_000 });
}
export function usePolicy(): IntelQuery {
  return useMarketQuery('intel:policy', () => intel.policy(consume('intel:policy')), { staleMs: 30 * 60_000 });
}
export function useFda(days = 14): IntelQuery {
  const k = `intel:fda:${days}`;
  return useMarketQuery(k, () => intel.fda(days, consume(k)), { staleMs: 60 * 60_000 });
}
export function useMacro() {
  return useMarketQuery('intel:macro', () => intel.macro(consume('intel:macro')), { staleMs: 60 * 60_000 });
}
export function useEconCalendar(from: string, to: string) {
  return useMarketQuery(`intel:cal:${from}:${to}`, () => intel.calendar(from, to), { staleMs: 60 * 60_000 });
}
export function useEarningsCalendar() {
  return useMarketQuery('intel:earnings', () => intel.earnings(), { staleMs: 6 * 3600_000 });
}
export function useIntelStatus() {
  return useMarketQuery('intel:status', () => intel.status(), { staleMs: 10 * 60_000 });
}

/** Watchlist + open simulated positions → the set of "my" tickers used across intel features. */
export function useTrackedTickers(watch: string[], positions: string[]) {
  return useMemo(() => [...new Set([...positions, ...watch].map((t) => t.toUpperCase()))].slice(0, 25), [watch, positions]);
}

/** Flatten an intel query into list props; `refresh()` bypasses caches (client + returns server-cached copy). */
export function intelView(q: IntelQuery, key: string | null) {
  return {
    events: q.data?.data.events ?? [],
    sources: q.data?.data.sources,
    fetchedAt: q.data?.fetchedAt,
    stale: q.data?.stale,
    error: q.error?.message ?? q.data?.error,
    loading: q.loading,
    onRefresh: () => {
      if (key) forceNext.add(key);
      q.refetch();
    },
  };
}
export const intelKeys = {
  sec: (t: string[]) => (t.length ? key('sec', t) : null),
  news: (t: string[]) => (t.length ? key('news', t) : null),
  latest: (form: string) => `intel:latest:${form}`,
  policy: 'intel:policy',
  fda: (d: number) => `intel:fda:${d}`,
};
