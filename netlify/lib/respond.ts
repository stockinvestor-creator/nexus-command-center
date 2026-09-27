import type { IntelEvent, IntelResponse, IntelSourceStatus } from '../../src/types/intel';
import { authorize } from './auth';
import { json } from './http';

export type Handler = (req: Request, ctx: { token: string | null; url: URL }) => Promise<Response>;

/** Wrap a function: method check + member auth + uniform error handling. */
export function secured(handler: Handler) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
    const auth = await authorize(req);
    if (!auth.ok) return json(401, { error: 'Sign in required' });
    try {
      return await handler(req, { token: auth.token, url: new URL(req.url) });
    } catch (e) {
      return json(502, { error: (e as Error).message || 'Upstream error' });
    }
  };
}

export function intelResponse(events: IntelEvent[], sources: IntelSourceStatus[]): Response {
  const body: IntelResponse = { events, sources, generatedAt: Date.now() };
  return json(200, body);
}

export const status = (source: string, configured: boolean, r: { fetchedAt?: number; stale?: boolean; errors?: string[] } | null, error?: string): IntelSourceStatus => ({
  source,
  configured,
  ok: Boolean(r) && !error && !(r?.errors?.length && !r?.fetchedAt),
  checkedAt: r?.fetchedAt ?? null,
  error: error ?? (r?.stale ? 'Source unavailable — showing cached data' : r?.errors?.length ? r.errors[0] : undefined),
});

export const tickersParam = (url: URL) =>
  (url.searchParams.get('tickers') ?? url.searchParams.get('ticker') ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => /^[A-Z0-9.\-]{1,12}$/.test(t));
