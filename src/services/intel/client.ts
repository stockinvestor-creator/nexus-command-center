import { getAccessToken } from '@/lib/supabase';
import { safeStorage } from '@/lib/safeStorage';
import type { EconomicRelease, EarningsDate, IntelEvent, IntelResponse, IntelSourceStatus, MacroSeriesPoint } from '@/types/intel';

/**
 * Client for NEXUS Netlify Functions (SEC, news, FDA, policy, macro, previews).
 * One cache per request key (memory + localStorage) with in-flight de-duplication, so every
 * feature that needs e.g. "SEC filings for my watchlist" shares ONE request.
 * When a request fails, the last good copy is returned with stale=true and its timestamp.
 */
const PREFIX = 'ncc.intel.';
const memory = new Map<string, { v: unknown; at: number }>();
const inflight = new Map<string, Promise<unknown>>();

export interface Fetched<T> {
  data: T;
  /** When NEXUS received this copy (epoch ms) */
  fetchedAt: number;
  stale: boolean;
  error?: string;
}

export class IntelHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, params: Record<string, string>): Promise<T> {
  const token = await getAccessToken();
  const qs = new URLSearchParams(params).toString();
  let res: Response;
  try {
    res = await fetch(`/.netlify/functions/${path}${qs ? `?${qs}` : ''}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new IntelHttpError('Data service unreachable', 0);
  }
  if (res.status === 401) throw new IntelHttpError('Sign in required for external data (or run `netlify dev` locally)', 401);
  if (res.status === 404) throw new IntelHttpError('Data functions not deployed (deploy to Netlify or run `netlify dev`)', 404);
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('json') && !type.includes('csv')) throw new IntelHttpError('Data functions not available in this environment', res.status);
  if (type.includes('csv')) return (await res.text()) as unknown as T;
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new IntelHttpError(body.error ?? `Request failed (${res.status})`, res.status);
  return body;
}

export async function intelGet<T>(path: string, params: Record<string, string>, ttlMs: number, force = false): Promise<Fetched<T>> {
  const key = `${path}?${new URLSearchParams(params).toString()}`;
  const mem = memory.get(key) ?? safeStorage.get<{ v: unknown; at: number } | null>(PREFIX + key, null) ?? undefined;
  if (mem && !force && Date.now() - mem.at < ttlMs) return { data: mem.v as T, fetchedAt: mem.at, stale: false };
  const running = inflight.get(key) as Promise<Fetched<T>> | undefined;
  if (running) return running;
  const p = (async () => {
    try {
      const v = await call<T>(path, params);
      const e = { v, at: Date.now() };
      memory.set(key, e);
      safeStorage.set(PREFIX + key, e);
      return { data: v, fetchedAt: e.at, stale: false };
    } catch (err) {
      if (mem) return { data: mem.v as T, fetchedAt: mem.at, stale: true, error: (err as Error).message };
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function clearIntelCache() {
  memory.clear();
  safeStorage.keys(PREFIX).forEach((k) => safeStorage.remove(k));
}

/** Mirrors netlify/functions/link-preview.ts */
export interface LinkPreviewData {
  url: string;
  finalUrl: string;
  domain: string;
  kind: 'page' | 'sec' | 'finviz' | 'none';
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  sec?: { form: string; company: string; filingDate: string; items: string[] };
}

/* ───────── typed endpoints ───────── */
const MIN = 60_000;
const norm = (tickers: string[]) => [...new Set(tickers.map((t) => t.toUpperCase()))].sort().join(',');

export const intel = {
  secFilings: (tickers: string[], force = false) => intelGet<IntelResponse>('sec', { action: 'watchlist', tickers: norm(tickers) }, 5 * MIN, force),
  latestFilings: (form: string, force = false) => intelGet<IntelResponse>('sec', { action: 'latest', form }, 3 * MIN, force),
  news: (tickers: string[], force = false) => intelGet<IntelResponse>('news', { tickers: norm(tickers) }, 15 * MIN, force),
  policy: (force = false) => intelGet<IntelResponse>('policy', {}, 30 * MIN, force),
  fda: (days = 14, force = false) => intelGet<IntelResponse>('fda', { days: String(days) }, 3 * 60 * MIN, force),
  macro: (force = false) => intelGet<{ series: MacroSeriesPoint[]; sources: IntelSourceStatus[]; generatedAt: number }>('macro', { action: 'dashboard' }, 60 * MIN, force),
  calendar: (from: string, to: string, force = false) =>
    intelGet<{ releases: EconomicRelease[]; sources: IntelSourceStatus[]; generatedAt: number }>('macro', { action: 'calendar', from, to }, 60 * MIN, force),
  linkPreview: (url: string) => intelGet<LinkPreviewData>('link-preview', { url }, 24 * 60 * MIN),
  status: () => intelGet<Record<string, boolean | number>>('intel-status', {}, 10 * MIN),
  earnings: async (force = false): Promise<Fetched<EarningsDate[]>> => {
    const r = await intelGet<string>('market', { function: 'EARNINGS_CALENDAR' }, 6 * 60 * MIN, force);
    return { ...r, data: parseEarningsCsv(typeof r.data === 'string' ? r.data : '') };
  },
};

function parseEarningsCsv(csv: string): EarningsDate[] {
  const lines = csv.trim().split(/\r?\n/);
  if (!lines[0]?.startsWith('symbol,')) return [];
  const head = lines[0].split(',');
  const idx = (k: string) => head.indexOf(k);
  return lines.slice(1).map((l) => {
    const c = l.split(',');
    const est = c[idx('estimate')];
    return {
      symbol: c[idx('symbol')],
      name: c[idx('name')],
      reportDate: c[idx('reportDate')],
      fiscalDateEnding: c[idx('fiscalDateEnding')],
      estimate: est ? Number(est) : null,
      currency: c[idx('currency')],
      source: 'Alpha Vantage' as const,
    };
  });
}

/* ───────── helpers ───────── */
export const mergeEvents = (...lists: (IntelEvent[] | undefined)[]) => {
  const map = new Map<string, IntelEvent>();
  for (const l of lists) for (const e of l ?? []) if (!map.has(e.id)) map.set(e.id, e);
  return [...map.values()].sort((a, b) => b.at.localeCompare(a.at));
};

export const withinHours = (e: IntelEvent, hours: number, now = Date.now()) => {
  const t = Date.parse(e.at);
  if (e.atPrecision === 'date') {
    // date-only: compare calendar days (a filing dated today counts as "today" for any window ≥ its day)
    const days = Math.max(1, Math.ceil(hours / 24));
    return now - t < days * 86400_000 + 86400_000;
  }
  return now - t <= hours * 3600_000;
};
