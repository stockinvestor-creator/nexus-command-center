import { supabaseAnon, supabaseUrl } from './env';

interface Entry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

const memory = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export interface Cached<T> {
  value: T;
  fetchedAt: number;
  /** Served from an expired entry because the source failed */
  stale: boolean;
}

async function readShared<T>(key: string, token: string | null): Promise<Entry<T> | null> {
  const url = supabaseUrl();
  const anon = supabaseAnon();
  if (!url || !anon || !token) return null;
  try {
    const r = await fetch(`${url}/rest/v1/intel_cache?key=eq.${encodeURIComponent(key)}&select=payload,fetched_at,expires_at`, {
      headers: { apikey: anon, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const rows = (await r.json()) as { payload: T; fetched_at: string; expires_at: string }[];
    if (!rows[0]) return null;
    return { value: rows[0].payload, fetchedAt: Date.parse(rows[0].fetched_at), expiresAt: Date.parse(rows[0].expires_at) };
  } catch {
    return null;
  }
}

async function writeShared<T>(key: string, e: Entry<T>, token: string | null) {
  const url = supabaseUrl();
  const anon = supabaseAnon();
  if (!url || !anon || !token) return;
  try {
    await fetch(`${url}/rest/v1/intel_cache?on_conflict=key`, {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ key, payload: e.value, fetched_at: new Date(e.fetchedAt).toISOString(), expires_at: new Date(e.expiresAt).toISOString() }),
    });
  } catch {
    /* cache write is best-effort */
  }
}

/**
 * Memory → shared Supabase cache (both users benefit, survives cold starts) → upstream loader.
 * On upstream failure an expired entry is returned with stale=true (callers must show its timestamp).
 */
export async function cached<T>(key: string, ttlSec: number, token: string | null, loader: () => Promise<T>): Promise<Cached<T>> {
  const now = Date.now();
  const mem = memory.get(key) as Entry<T> | undefined;
  if (mem && mem.expiresAt > now) return { value: mem.value, fetchedAt: mem.fetchedAt, stale: false };
  const running = inflight.get(key) as Promise<Cached<T>> | undefined;
  if (running) return running;
  const p = (async (): Promise<Cached<T>> => {
    const shared = await readShared<T>(key, token);
    if (shared && shared.expiresAt > Date.now()) {
      memory.set(key, shared);
      return { value: shared.value, fetchedAt: shared.fetchedAt, stale: false };
    }
    try {
      const value = await loader();
      const e: Entry<T> = { value, fetchedAt: Date.now(), expiresAt: Date.now() + ttlSec * 1000 };
      memory.set(key, e);
      if (memory.size > 500) memory.delete(memory.keys().next().value as string);
      await writeShared(key, e, token);
      return { value, fetchedAt: e.fetchedAt, stale: false };
    } catch (err) {
      const fallback = mem ?? shared;
      if (fallback) return { value: fallback.value, fetchedAt: fallback.fetchedAt, stale: true };
      throw err;
    }
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Small persistent daily counter (e.g. Marketaux 100 requests/day). */
export async function incrementDaily(name: string, token: string | null): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `budget:${name}:${day}`;
  const cur = (memory.get(key) as Entry<number> | undefined)?.value ?? (await readShared<number>(key, token))?.value ?? 0;
  const next = cur + 1;
  const e: Entry<number> = { value: next, fetchedAt: Date.now(), expiresAt: Date.now() + 36 * 3600_000 };
  memory.set(key, e);
  await writeShared(key, e, token);
  return next;
}

export async function readDaily(name: string, token: string | null): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const key = `budget:${name}:${day}`;
  return (memory.get(key) as Entry<number> | undefined)?.value ?? (await readShared<number>(key, token))?.value ?? 0;
}
