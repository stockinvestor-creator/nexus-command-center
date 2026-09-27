import { intel } from '@/services/intel/client';
import { marketData } from '@/services/market';
import { isoDay } from '@/lib/format';
import type { Catalyst, EventAnnotation, Prediction, SimPosition, WatchlistItem } from '@/types/db';
import type { EarningsDate, EconomicRelease, IntelEvent, IntelSourceStatus, MacroSeriesPoint } from '@/types/intel';

/**
 * Morning Briefing generator. It ONLY assembles data NEXUS already fetches elsewhere (same caches,
 * same Netlify functions) plus your own workspace rows. No text is generated: every line is either a
 * sourced item (with link + timestamp) or a rules-based flag that states its rule.
 *
 * `kind` exists so an end-of-day brief can reuse this pipeline with a different window (see KIND_CONFIG).
 */
export type BriefingKind = 'morning' | 'eod';
export const KIND_CONFIG: Record<BriefingKind, { title: string; filingsLabel: string }> = {
  morning: { title: 'Morning Briefing', filingsLabel: 'Overnight SEC filings (since the previous session)' },
  eod: { title: 'End-of-Day Brief', filingsLabel: 'SEC filings today' },
};

export interface BriefingSnapshot {
  version: 1;
  kind: BriefingKind;
  date: string;
  generatedAt: string;
  dataRefreshedAt: string | null;
  tickers: string[];
  sources: IntelSourceStatus[];
  macro: MacroSeriesPoint[];
  economic: EconomicRelease[];
  watchlistCatalysts: { id: string; symbol: string; title: string; type: string; date: string | null; sourceUrl: string | null; origin: 'manual_catalyst' | 'watchlist_date' }[];
  filings: IntelEvent[];
  news: IntelEvent[];
  fda: IntelEvent[];
  portfolio: { id: string; symbol: string; direction: string; shares: number; avgEntry: number; price: number | null; priceSource: string | null; unrealized: number | null }[];
  earnings: { symbol: string; date: string; fiscal?: string; source: string }[];
  highPriority: { id: string; title: string; rule: string; url: string | null; level: 'critical' | 'high'; symbol?: string }[];
  predictionsDue: { id: string; title: string; symbol: string | null; resolution_date: string | null; confidence: number; pastDue: boolean }[];
  changes: {
    comparedTo: string | null;
    newFilings: string[];
    newNews: string[];
    newHighPriority: string[];
    positionsOpened: string[];
    positionsClosed: string[];
    predictionsResolved: string[];
    catalystsAdded: string[];
  };
}

export interface BuildInputs {
  kind: BriefingKind;
  tickers: string[];
  watchlist: WatchlistItem[];
  positions: SimPosition[];
  predictions: Prediction[];
  catalysts: Catalyst[];
  annotations: EventAnnotation[];
  previous: BriefingSnapshot | null;
  force: boolean;
  now?: number;
}

const HIGH_8K = new Set(['MANAGEMENT', 'OFFERING', 'FINANCING', 'M_AND_A', 'CYBER', 'LEGAL_REGULATORY', 'RESTRUCTURING', 'EARNINGS', 'OPERATIONAL']);
const CRITICAL = new Set(['OFFERING', 'CYBER', 'M_AND_A', 'MANAGEMENT']);

/** Previous US trading day (weekends only; exchange holidays are not modelled, so the window may be 1 day wider). */
export function previousTradingDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

function sinceSession(e: IntelEvent, date: string, now: number): boolean {
  const prev = previousTradingDay(date);
  if (e.atPrecision === 'date') return e.at.slice(0, 10) >= prev;
  // previous session close 16:00 ET ≈ 20:00/21:00 UTC; use 20:00 UTC (conservative, wider by ≤1h in winter)
  return Date.parse(e.at) >= Date.parse(`${prev}T20:00:00Z`) && Date.parse(e.at) <= now;
}

async function settle<T>(p: Promise<T>): Promise<{ ok: true; v: T } | { ok: false; error: string }> {
  try {
    return { ok: true, v: await p };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function buildBriefing(i: BuildInputs): Promise<BriefingSnapshot> {
  const now = i.now ?? Date.now();
  const date = isoDay(0, now);
  const tickers = i.tickers.slice(0, 25);
  const set = new Set(tickers);
  const mine = (e: IntelEvent) => e.tickers.some((t) => set.has(t.toUpperCase()));

  const [sec, news, fda, macro, cal, earn] = await Promise.all([
    tickers.length ? settle(intel.secFilings(tickers, i.force)) : Promise.resolve(null),
    tickers.length ? settle(intel.news(tickers, i.force)) : Promise.resolve(null),
    settle(intel.fda(7, false)),
    settle(intel.macro(false)),
    settle(intel.calendar(date, isoDay(3, now), false)),
    settle(intel.earnings(false)),
  ]);

  const sources: IntelSourceStatus[] = [];
  const fetched: number[] = [];
  const take = <T,>(r: { ok: true; v: { data: T; fetchedAt: number; stale: boolean; error?: string } } | { ok: false; error: string } | null, label: string, srcOf?: (d: T) => IntelSourceStatus[] | undefined): T | null => {
    if (!r) return null;
    if (!r.ok) {
      sources.push({ source: label, ok: false, checkedAt: null, error: r.error, configured: true });
      return null;
    }
    fetched.push(r.v.fetchedAt);
    const s = srcOf?.(r.v.data);
    if (s?.length) sources.push(...s.map((x) => ({ ...x, error: x.error ?? (r.v.stale ? `Cached copy (${r.v.error ?? 'refresh failed'})` : undefined) })));
    else sources.push({ source: label, ok: !r.v.stale, checkedAt: r.v.fetchedAt, configured: true, error: r.v.stale ? r.v.error : undefined });
    return r.v.data;
  };
  const secD = take(sec, 'SEC EDGAR', (d) => d.sources);
  const newsD = take(news, 'Marketaux', (d) => d.sources);
  const fdaD = take(fda, 'openFDA', (d) => d.sources);
  const macroD = take(macro, 'FRED', (d) => d.sources);
  const calD = take(cal, 'FRED release calendar', (d) => d.sources);
  const earnD = take(earn, 'Alpha Vantage earnings calendar');

  const filings = (secD?.events ?? []).filter((e) => mine(e) && sinceSession(e, date, now));
  const newsItems = (newsD?.events ?? []).filter((e) => mine(e) && now - Date.parse(e.at) <= 24 * 3600_000);
  const fdaItems = (fdaD?.events ?? []).filter(mine);
  const economic = (calD?.releases ?? []).filter((r) => r.date >= date).sort((a, b) => a.date.localeCompare(b.date) || (a.priority === 'high' ? -1 : 1));

  const in7 = isoDay(7, now);
  const watchlistCatalysts: BriefingSnapshot['watchlistCatalysts'] = [
    ...i.catalysts
      .filter((c) => set.has(c.symbol.toUpperCase()) && c.status !== 'invalidated' && c.catalyst_date && c.catalyst_date >= date && c.catalyst_date <= in7)
      .map((c) => ({ id: `cat:${c.id}`, symbol: c.symbol, title: c.headline, type: c.catalyst_type, date: c.catalyst_date, sourceUrl: c.source_url, origin: 'manual_catalyst' as const })),
    ...i.watchlist
      .filter((w) => w.catalyst_date && w.catalyst_date >= date && w.catalyst_date <= in7)
      .map((w) => ({ id: `wl:${w.id}`, symbol: w.symbol, title: `Watchlist catalyst date${w.notes ? ` — ${w.notes.slice(0, 80)}` : ''}`, type: w.category, date: w.catalyst_date, sourceUrl: null, origin: 'watchlist_date' as const })),
  ].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));

  // portfolio check — prices only from a verified provider
  const open = i.positions.filter((p) => p.status === 'open');
  let quotes: Record<string, { price: number; provenance: { source: string; status: string } }> = {};
  const provider = marketData();
  if (provider.capabilities.quotes && open.length) {
    try {
      quotes = await provider.getQuotes([...new Set(open.map((p) => p.symbol))].slice(0, 10));
    } catch {
      quotes = {};
    }
  }
  const portfolio = open.map((p) => {
    const q = quotes[p.symbol.toUpperCase()];
    const price = q?.price ?? null;
    return {
      id: p.id,
      symbol: p.symbol,
      direction: p.direction,
      shares: p.shares,
      avgEntry: p.avg_entry,
      price,
      priceSource: q ? `${q.provenance.source} · ${q.provenance.status}` : null,
      unrealized: price == null ? null : (price - p.avg_entry) * p.shares * (p.direction === 'long' ? 1 : -1),
    };
  });

  const in14 = isoDay(14, now);
  const earningsList: EarningsDate[] = earnD ?? [];
  const earnings = [
    ...earningsList.filter((e) => set.has(e.symbol.toUpperCase()) && e.reportDate >= date && e.reportDate <= in14).map((e) => ({ symbol: e.symbol, date: e.reportDate, fiscal: e.fiscalDateEnding, source: 'Alpha Vantage' })),
    ...i.catalysts.filter((c) => c.catalyst_type === 'Earnings' && set.has(c.symbol.toUpperCase()) && c.catalyst_date && c.catalyst_date >= date && c.catalyst_date <= in14).map((c) => ({ symbol: c.symbol, date: c.catalyst_date!, source: 'Manual catalyst (team entry)' })),
  ]
    .filter((e, idx, arr) => arr.findIndex((x) => x.symbol === e.symbol && x.date === e.date) === idx)
    .sort((a, b) => a.date.localeCompare(b.date));

  // rules-based priority flags — each states its rule
  const hp: BriefingSnapshot['highPriority'] = [];
  for (const f of filings) {
    const cls = f.classifications.filter((c) => HIGH_8K.has(c.category));
    if (cls.length) hp.push({ id: f.id, title: `${f.tickers[0] ?? f.company}: ${f.title}`, rule: `${cls[0].basis} on a watched ticker`, url: f.url, level: cls.some((c) => CRITICAL.has(c.category)) ? 'critical' : 'high', symbol: f.tickers[0] });
  }
  for (const n of newsItems) {
    const cls = n.classifications.filter((c) => HIGH_8K.has(c.category) || c.category === 'FDA');
    if (cls.length) hp.push({ id: n.id, title: n.title, rule: `${cls[0].basis} (article tagged ${n.tickers.filter((t) => set.has(t)).join(', ')})`, url: n.url, level: 'high', symbol: n.tickers[0] });
  }
  for (const f of fdaItems) hp.push({ id: f.id, title: f.title, rule: 'openFDA action naming a watched company', url: f.url, level: 'high', symbol: f.tickers[0] });
  const tomorrow = isoDay(1, now);
  for (const e of earnings.filter((e) => e.date <= tomorrow)) hp.push({ id: `earn:${e.symbol}:${e.date}`, title: `${e.symbol} earnings ${e.date === date ? 'today' : 'tomorrow'}`, rule: `Earnings date within 1 day (${e.source})`, url: null, level: 'high', symbol: e.symbol });
  for (const r of economic.filter((r) => r.date === date && r.priority === 'high')) hp.push({ id: `rel:${r.id}`, title: `${r.name} today${r.time && /\d/.test(r.time) ? ` at ${r.time}` : ''}`, rule: `High-importance release (${r.priorityBasis})`, url: r.url, level: 'high' });
  for (const a of i.annotations.filter((a) => (a.priority === 'high' || a.priority === 'critical') && now - Date.parse(a.updated_at) < 3 * 86400_000)) {
    const ev = a.event as { title?: string; url?: string; tickers?: string[] };
    hp.push({ id: `ann:${a.id}`, title: ev.title ?? a.event_key, rule: `Team marked ${a.priority!.toUpperCase()} priority (user analysis)`, url: ev.url ?? null, level: a.priority === 'critical' ? 'critical' : 'high', symbol: ev.tickers?.[0] });
  }
  for (const c of i.catalysts.filter((c) => c.expected_impact === 'high' && c.catalyst_date && c.catalyst_date >= date && c.catalyst_date <= tomorrow)) {
    hp.push({ id: `cat:${c.id}`, title: `MANUAL CATALYST · ${c.symbol}: ${c.headline}`, rule: 'Team-logged high-impact catalyst dated today/tomorrow', url: c.source_url, level: 'high', symbol: c.symbol });
  }
  const predictionsDue = i.predictions
    .filter((p) => p.status === 'open' && p.resolution_date && p.resolution_date <= isoDay(2, now))
    .map((p) => ({ id: p.id, title: p.title, symbol: p.symbol, resolution_date: p.resolution_date, confidence: p.confidence, pastDue: (p.resolution_date ?? '') < date }));
  for (const p of predictionsDue) hp.push({ id: `pred:${p.id}`, title: `Prediction ${p.pastDue ? 'past due' : 'resolving soon'}: ${p.title}`, rule: 'Open prediction with resolution date within 2 days (or past due)', url: null, level: 'high', symbol: p.symbol ?? undefined });
  const seen = new Set<string>();
  const highPriority = hp.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true))).sort((a, b) => (a.level === b.level ? 0 : a.level === 'critical' ? -1 : 1));

  // what changed since the previous briefing
  const prev = i.previous;
  const prevAt = prev ? Date.parse(prev.generatedAt) : null;
  const prevIds = (l?: { id: string }[]) => new Set((l ?? []).map((x) => x.id));
  const pf = prevIds(prev?.filings);
  const pn = prevIds(prev?.news);
  const ph = prevIds(prev?.highPriority);
  const changes: BriefingSnapshot['changes'] = {
    comparedTo: prev?.generatedAt ?? null,
    newFilings: prev ? filings.filter((f) => !pf.has(f.id)).map((f) => f.id) : [],
    newNews: prev ? newsItems.filter((n) => !pn.has(n.id)).map((n) => n.id) : [],
    newHighPriority: prev ? highPriority.filter((h) => !ph.has(h.id)).map((h) => h.id) : [],
    positionsOpened: prevAt ? i.positions.filter((p) => Date.parse(p.opened_at) > prevAt).map((p) => `${p.symbol} ${p.direction}`) : [],
    positionsClosed: prevAt ? i.positions.filter((p) => p.closed_at && Date.parse(p.closed_at) > prevAt).map((p) => `${p.symbol} ${p.direction}`) : [],
    predictionsResolved: prevAt ? i.predictions.filter((p) => p.resolved_at && Date.parse(p.resolved_at) > prevAt).map((p) => `${p.title} → ${p.status.toUpperCase()}`) : [],
    catalystsAdded: prevAt ? i.catalysts.filter((c) => Date.parse(c.created_at) > prevAt).map((c) => `${c.symbol}: ${c.headline}`) : [],
  };

  return {
    version: 1,
    kind: i.kind,
    date,
    generatedAt: new Date(now).toISOString(),
    dataRefreshedAt: fetched.length ? new Date(Math.min(...fetched)).toISOString() : null,
    tickers,
    sources,
    macro: macroD?.series ?? [],
    economic,
    watchlistCatalysts,
    filings,
    news: newsItems,
    fda: fdaItems,
    portfolio,
    earnings,
    highPriority,
    predictionsDue,
    changes,
  };
}

/** Rate limit for REFRESH BRIEFING (protects the free Marketaux / SEC budgets). */
export const REFRESH_COOLDOWN_MS = 5 * 60_000;
