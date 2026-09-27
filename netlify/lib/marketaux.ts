import type { IntelEvent } from '../../src/types/intel';
import { classifyHeadline } from '../../src/types/intel';
import { env } from './env';
import { cached, incrementDaily, readDaily } from './cache';
import { fetchJson, mapLimit, UpstreamError } from './http';

/**
 * Marketaux (free tier: 100 requests/day, 3 articles/request). Key stays server-side.
 * We store/return headline, provider snippet, publisher, time, tickers and link only — never article bodies.
 */
export const marketauxConfigured = () => Boolean(env('MARKETAUX_API_KEY'));
const DAILY_BUDGET = 95; // keep a margin under the 100/day free limit
const TTL = 90 * 60; // per-ticker cache: 90 minutes (shared by both users)

interface MxEntity {
  symbol: string;
  name?: string;
  type?: string;
  match_score?: number;
}
interface MxArticle {
  uuid: string;
  title: string;
  description?: string;
  snippet?: string;
  url: string;
  source?: string;
  published_at: string;
  entities?: MxEntity[];
}

function normalize(a: MxArticle, requested: Set<string>): IntelEvent {
  const tickers = [...new Set((a.entities ?? []).map((e) => e.symbol?.toUpperCase()).filter((s): s is string => Boolean(s) && requested.has(s!)))];
  const snippet = (a.description || a.snippet || '').trim();
  return {
    id: `mx:${a.uuid}`,
    source: 'Marketaux',
    publisher: a.source ? `${a.source} via Marketaux` : 'Marketaux',
    kind: 'news',
    tickers,
    title: a.title,
    summary: snippet ? (snippet.length > 280 ? `${snippet.slice(0, 277)}…` : snippet) : undefined,
    url: a.url,
    at: new Date(a.published_at).toISOString(),
    atPrecision: 'time',
    classifications: classifyHeadline(a.title),
  };
}

async function fetchTicker(ticker: string, token: string | null, ttl = TTL) {
  return cached(`mx:${ticker}`, ttl, token, async () => {
    if (!marketauxConfigured()) throw new UpstreamError('Marketaux', 'MARKETAUX_API_KEY is not set');
    if ((await readDaily('marketaux', token)) >= DAILY_BUDGET) throw new UpstreamError('Marketaux', 'Marketaux daily request budget reached (free tier: 100/day)', 429);
    await incrementDaily('marketaux', token);
    const qs = new URLSearchParams({ symbols: ticker, filter_entities: 'true', language: 'en', limit: '3', api_token: env('MARKETAUX_API_KEY') });
    const res = await fetchJson<{ data?: MxArticle[]; error?: { message?: string } }>('Marketaux', `https://api.marketaux.com/v1/news/all?${qs}`);
    if (res.error) throw new UpstreamError('Marketaux', res.error.message ?? 'Marketaux error');
    return (res.data ?? []).map((a) => normalize(a, new Set([ticker])));
  });
}

export async function newsForTickers(tickers: string[], token: string | null) {
  const uniq = [...new Set(tickers.map((t) => t.toUpperCase()))].slice(0, 12);
  // Adaptive TTL: refreshing N tickers around the clock must stay under the daily budget
  // (N × 24h / ttl ≤ ~90 requests). 4 tickers → 90 min; 12 tickers → ~3.2 h.
  const ttl = Math.max(TTL, Math.ceil((24 * 3600 * uniq.length) / 90));
  const results = await mapLimit(uniq, 3, (t) => fetchTicker(t, token, ttl));
  const events = new Map<string, IntelEvent>();
  let oldest = Date.now();
  let stale = false;
  const errors: string[] = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      for (const e of r.value.value) {
        const prev = events.get(e.id);
        events.set(e.id, prev ? { ...prev, tickers: [...new Set([...prev.tickers, ...e.tickers])] } : e);
      }
      oldest = Math.min(oldest, r.value.fetchedAt);
      stale = stale || r.value.stale;
    } else errors.push((r.reason as Error).message);
  });
  const list = [...events.values()].sort((a, b) => b.at.localeCompare(a.at));
  return { events: list, fetchedAt: oldest, stale, errors: [...new Set(errors)] };
}
