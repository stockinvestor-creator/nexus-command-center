/**
 * Netlify Function: server-side proxy for the Alpha Vantage free tier.
 *
 * Why it exists: the market-data API key must never ship in browser JavaScript.
 * The key lives in the MARKET_DATA_API_KEY environment variable (no VITE_ prefix),
 * which only this function can read.
 *
 * Abuse protection (so strangers can't burn your 25 calls/day):
 *  - only signed-in workspace members may call it (Supabase JWT is verified)
 *  - only a whitelist of read-only Alpha Vantage functions/params is forwarded
 *  - successful responses are cached (in-memory + Netlify CDN), errors are not
 *
 * Free-tier impact: at most a handful of invocations per day (Netlify free: 125k/month).
 */

type Params = Record<string, string>;

const ALLOWED: Record<string, (p: URLSearchParams) => Params | null> = {
  TIME_SERIES_DAILY: (p) => sym(p) && { symbol: sym(p)!, outputsize: 'compact' },
  TIME_SERIES_WEEKLY: (p) => sym(p) && { symbol: sym(p)! },
  TIME_SERIES_INTRADAY: (p) => {
    const interval = p.get('interval') ?? '';
    if (!sym(p) || !['1min', '5min', '15min', '30min', '60min'].includes(interval)) return null;
    return { symbol: sym(p)!, interval, outputsize: 'compact', extended_hours: 'false' };
  },
  GLOBAL_QUOTE: (p) => sym(p) && { symbol: sym(p)! },
  OVERVIEW: (p) => sym(p) && { symbol: sym(p)! },
  SYMBOL_SEARCH: (p) => {
    const k = (p.get('keywords') ?? '').trim();
    return k && k.length <= 40 && /^[\w .&'-]+$/.test(k) ? { keywords: k } : null;
  },
  TOP_GAINERS_LOSERS: () => ({}),
};

function sym(p: URLSearchParams): string | null {
  const s = (p.get('symbol') ?? '').toUpperCase();
  return /^[A-Z0-9.\-]{1,12}$/.test(s) ? s : null;
}

const HOUR = 3600;
const TTL: Record<string, number> = {
  SYMBOL_SEARCH: 7 * 24 * HOUR,
  OVERVIEW: 7 * 24 * HOUR,
  TIME_SERIES_WEEKLY: 12 * HOUR,
  TIME_SERIES_DAILY: 4 * HOUR,
  TIME_SERIES_INTRADAY: 4 * HOUR,
  GLOBAL_QUOTE: 4 * HOUR,
  TOP_GAINERS_LOSERS: 4 * HOUR,
};

const memory = new Map<string, { body: string; exp: number }>();
const tokenCache = new Map<string, number>();

const env = (k: string) => (typeof process !== 'undefined' ? process.env[k] : undefined) ?? '';

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

async function authorized(req: Request): Promise<boolean> {
  if (env('MARKET_PROXY_PUBLIC') === 'true') return true; // explicit opt-out (not recommended)
  const url = env('VITE_SUPABASE_URL') || env('SUPABASE_URL');
  const anon = env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!url || !anon || !token) return false;
  const cachedUntil = tokenCache.get(token);
  if (cachedUntil && cachedUntil > Date.now()) return true;
  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!r.ok) return false;
    tokenCache.set(token, Date.now() + 5 * 60_000);
    if (tokenCache.size > 50) tokenCache.delete(tokenCache.keys().next().value as string);
    return true;
  } catch {
    return false;
  }
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
  const apiKey = env('MARKET_DATA_API_KEY');
  if (!apiKey) return json(500, { error: 'MARKET_DATA_API_KEY is not set in Netlify environment variables.' });
  if (!(await authorized(req))) return json(401, { error: 'Sign in required' });

  const qs = new URL(req.url).searchParams;
  const fn = (qs.get('function') ?? '').toUpperCase();
  const build = ALLOWED[fn];
  const params = build?.(qs);
  if (!build || !params) return json(400, { error: 'Unsupported request' });

  const key = `${fn}|${new URLSearchParams(params).toString()}`;
  const ttl = TTL[fn] ?? HOUR;
  const hit = memory.get(key);
  const cacheHeaders = {
    'Cache-Control': `private, max-age=${Math.min(ttl, 3600)}`,
    'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${ttl}, stale-while-revalidate=${ttl}`,
    'X-Proxy-Cache': 'HIT',
  };
  if (hit && hit.exp > Date.now()) return json(200, hit.body, cacheHeaders);

  let upstream: Response;
  try {
    upstream = await fetch(`https://www.alphavantage.co/query?${new URLSearchParams({ function: fn, ...params, apikey: apiKey })}`, {
      headers: { 'User-Agent': 'nexus-command-center/1.0' },
    });
  } catch {
    return json(502, { error: 'Upstream unavailable' });
  }
  const body = await upstream.text();
  if (!upstream.ok) return json(502, { error: `Upstream error ${upstream.status}` });

  // Never cache rate-limit / premium / error payloads
  let cacheable = true;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (parsed['Note'] || parsed['Information'] || parsed['Error Message']) cacheable = false;
  } catch {
    cacheable = false;
  }
  if (!cacheable) return json(200, body);

  memory.set(key, { body, exp: Date.now() + ttl * 1000 });
  if (memory.size > 300) memory.delete(memory.keys().next().value as string);
  return json(200, body, { ...cacheHeaders, 'X-Proxy-Cache': 'MISS' });
};
