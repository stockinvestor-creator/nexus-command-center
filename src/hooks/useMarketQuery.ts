import { useCallback, useEffect, useSyncExternalStore } from 'react';

interface Entry<T> {
  data?: T;
  error?: Error;
  loading: boolean;
  updatedAt: number;
  listeners: Set<() => void>;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<void>>();

function entry<T>(key: string): Entry<T> {
  let e = store.get(key) as Entry<T> | undefined;
  if (!e) {
    e = { loading: false, updatedAt: 0, listeners: new Set() };
    store.set(key, e as Entry<unknown>);
  }
  return e;
}

/** Immutable update → new snapshot identity → subscribed components re-render. */
function update<T>(key: string, patch: Partial<Entry<T>>) {
  const prev = entry<T>(key);
  const next: Entry<T> = { ...prev, ...patch, listeners: prev.listeners };
  store.set(key, next as Entry<unknown>);
  prev.listeners.forEach((l) => l());
}

function run<T>(key: string, fn: () => Promise<T>): Promise<void> {
  const running = inflight.get(key);
  if (running) return running;
  update<T>(key, { loading: true });
  const p = fn()
    .then(
      (data) => update<T>(key, { data, error: undefined, loading: false, updatedAt: Date.now() }),
      (err: unknown) =>
        update<T>(key, {
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
          updatedAt: Date.now(),
        }),
    )
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  updatedAt: number;
  refetch: () => void;
}

/**
 * Minimal shared async cache (no dependency). Components asking for the same key share
 * one request and one result. Optional refresh interval pauses when the tab is hidden.
 */
export function useMarketQuery<T>(
  key: string | null,
  fn: () => Promise<T>,
  opts: { refreshMs?: number | null; staleMs?: number } = {},
): QueryState<T> {
  const { refreshMs = null, staleMs = 30_000 } = opts;

  const subscribe = useCallback(
    (cb: () => void) => {
      if (!key) return () => undefined;
      const e = entry<T>(key);
      e.listeners.add(cb);
      return () => {
        e.listeners.delete(cb);
      };
    },
    [key],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (key ? (store.get(key) as Entry<T> | undefined) : undefined),
    () => undefined,
  );

  useEffect(() => {
    if (!key) return;
    const e = entry<T>(key);
    if (!e.data || Date.now() - e.updatedAt > staleMs) void run(key, fn);
    if (!refreshMs) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void run(key, fn);
    }, refreshMs);
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - entry<T>(key).updatedAt > refreshMs) void run(key, fn);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
    // fn is intentionally excluded: key fully identifies the request
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshMs, staleMs]);

  const refetch = useCallback(() => {
    if (key) void run(key, fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return {
    data: snapshot?.data,
    error: snapshot?.error,
    loading: snapshot ? snapshot.loading || (!snapshot.data && !snapshot.error) : Boolean(key),
    updatedAt: snapshot?.updatedAt ?? 0,
    refetch,
  };
}

export function invalidateMarketQueries() {
  store.forEach((e) => {
    e.updatedAt = 0;
  });
}
