import { safeStorage } from '@/lib/safeStorage';
import { useMarketStatus } from '@/store/marketStatusStore';

const PREFIX = 'ncc.mkt.c.';

interface Entry<T> {
  v: T;
  at: number; // fetched at
  exp: number; // expires at
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export interface CachedResult<T> {
  value: T;
  stale: boolean;
  fetchedAt: number;
}

function read<T>(key: string): Entry<T> | null {
  const m = memory.get(key) as Entry<T> | undefined;
  if (m) return m;
  const s = safeStorage.get<Entry<T> | null>(PREFIX + key, null);
  if (s) memory.set(key, s);
  return s;
}

function write<T>(key: string, v: T, ttlMs: number) {
  const e: Entry<T> = { v, at: Date.now(), exp: Date.now() + ttlMs };
  memory.set(key, e);
  if (!safeStorage.set(PREFIX + key, e)) {
    // storage full → evict the oldest third and retry once
    const keys = safeStorage.keys(PREFIX)
      .map((k) => ({ k, at: safeStorage.get<Entry<unknown> | null>(k, null)?.at ?? 0 }))
      .sort((a, b) => a.at - b.at);
    keys.slice(0, Math.ceil(keys.length / 3)).forEach(({ k }) => safeStorage.remove(k));
    safeStorage.set(PREFIX + key, e);
  }
}

/**
 * Cache-first fetch with:
 *  - in-flight de-duplication
 *  - persistent (localStorage) TTL cache so reloads don't spend API calls
 *  - graceful fallback to stale data when the network call fails or the API limit is hit
 */
export async function cached<T>(key: string, ttlMs: number | (() => number), fetcher: () => Promise<T>): Promise<CachedResult<T>> {
  const status = useMarketStatus.getState();
  const hit = read<T>(key);
  if (hit && hit.exp > Date.now()) {
    status.recordHit();
    return { value: hit.v, stale: false, fetchedAt: hit.at };
  }
  const running = inflight.get(key) as Promise<CachedResult<T>> | undefined;
  if (running) return running;

  status.recordMiss();
  const p = (async () => {
    try {
      const v = await fetcher();
      write(key, v, typeof ttlMs === 'function' ? ttlMs() : ttlMs);
      status.recordSuccess();
      return { value: v, stale: false, fetchedAt: Date.now() };
    } catch (err) {
      const e = err as Error;
      status.recordError(e.message, e.name === 'RateLimitError');
      if (hit) {
        status.recordStale();
        return { value: hit.v, stale: true, fetchedAt: hit.at };
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function cacheStats() {
  const keys = safeStorage.keys(PREFIX);
  let bytes = 0;
  let fresh = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  for (const k of keys) {
    try {
      const raw = window.localStorage.getItem(k) ?? '';
      bytes += raw.length * 2;
      const e = JSON.parse(raw) as Entry<unknown>;
      if (e.exp > Date.now()) fresh++;
      oldest = oldest == null ? e.at : Math.min(oldest, e.at);
      newest = newest == null ? e.at : Math.max(newest, e.at);
    } catch {
      /* ignore */
    }
  }
  return { entries: keys.length, fresh, bytes, oldest, newest };
}

export function clearMarketCache() {
  memory.clear();
  safeStorage.keys(PREFIX).forEach((k) => safeStorage.remove(k));
}
