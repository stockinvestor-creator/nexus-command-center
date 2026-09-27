import type { IntelEvent, EconomicRelease, EarningsDate } from '@/types/intel';
import type { Catalyst, EventAnnotation } from '@/types/db';
import type { Candle } from '@/types/market';
import { withinHours } from '@/services/intel/client';

/**
 * "Why is it moving?" evidence engine. It never writes a narrative. It only sorts REAL, sourced items
 * into evidence tiers using transparent rules, each item carrying the rule that placed it there.
 *
 *   CONFIRMED          primary-source company event inside the window (the company's own SEC filing),
 *                      or a ticker-tagged article in the window whose headline matches a material category
 *   STRONGLY RELATED   any ticker-tagged news in the window; a dated catalyst/earnings date inside the window
 *   POSSIBLY RELATED   sector policy items, market-wide macro releases, company items just outside the window,
 *                      upcoming dated events
 *   NO CONFIRMED CATALYST FOUND   when nothing CONFIRMED or STRONGLY RELATED exists
 *
 * Tiers describe the evidence found, NOT causation.
 */
export type WhyWindow = '1h' | '3h' | 'today' | '24h' | '3d' | '7d';
export const WHY_WINDOWS: { value: WhyWindow; label: string }[] = [
  { value: '1h', label: '1h' },
  { value: '3h', label: '3h' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '3d', label: '3d' },
  { value: '7d', label: '7d' },
];

export type EvidenceTier = 'CONFIRMED' | 'STRONGLY RELATED' | 'POSSIBLY RELATED';
export type Verdict = EvidenceTier | 'NO CONFIRMED CATALYST FOUND';
export const TIER_ORDER: EvidenceTier[] = ['CONFIRMED', 'STRONGLY RELATED', 'POSSIBLY RELATED'];

export type EvidenceSection = 'catalyst' | 'news' | 'filing' | 'upcoming' | 'policy' | 'macro' | 'note';

export interface Evidence {
  id: string;
  tier: EvidenceTier;
  section: EvidenceSection;
  title: string;
  source: string;
  at: string | null;
  atPrecision: 'time' | 'date';
  url: string | null;
  /** The rule that assigned the tier — always shown */
  rule: string;
  categories: string[];
}

/** Hours covered by a window. "today" = since 00:00 America/New_York. */
export function windowHours(w: WhyWindow, now = Date.now()): number {
  if (w === 'today') {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(now));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return Math.max(h + m / 60, 0.25);
  }
  return { '1h': 1, '3h': 3, '24h': 24, '3d': 72, '7d': 168 }[w];
}

const MATERIAL = new Set(['EARNINGS', 'MANAGEMENT', 'FINANCING', 'OFFERING', 'M_AND_A', 'LEGAL_REGULATORY', 'CYBER', 'OPERATIONAL', 'RESTRUCTURING', 'MATERIAL_AGREEMENT', 'FDA', 'PERIODIC_REPORT', 'OWNERSHIP']);

const fromEvent = (e: IntelEvent, tier: EvidenceTier, section: EvidenceSection, rule: string): Evidence => ({
  id: e.id,
  tier,
  section,
  title: e.title,
  source: e.publisher ?? e.source,
  at: e.at,
  atPrecision: e.atPrecision,
  url: e.url,
  rule,
  categories: e.classifications.filter((c) => c.category !== 'NEWS').map((c) => c.label),
});

const hostOf = (u: string | null) => {
  if (!u) return null;
  try {
    return new URL(u).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
};
const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400_000).toISOString().slice(0, 10);

export interface WhyInputs {
  symbol: string;
  window: WhyWindow;
  filings: IntelEvent[];
  news: IntelEvent[];
  fda: IntelEvent[];
  policy: IntelEvent[];
  releases: EconomicRelease[];
  earnings: EarningsDate[];
  catalysts: Catalyst[];
  annotations: EventAnnotation[];
  sectorTags: string[];
  now?: number;
}

export function gatherEvidence(i: WhyInputs): { verdict: Verdict; items: Evidence[] } {
  const now = i.now ?? Date.now();
  const hours = windowHours(i.window, now);
  const sym = i.symbol.toUpperCase();
  const items: Evidence[] = [];
  const mine = (e: IntelEvent) => e.tickers.map((t) => t.toUpperCase()).includes(sym);

  for (const f of i.filings.filter(mine)) {
    if (withinHours(f, hours, now)) {
      items.push(fromEvent(f, 'CONFIRMED', 'filing', `${f.form ?? 'SEC'} filed by the company ${f.atPrecision === 'date' ? 'on a date inside' : 'inside'} the window (primary source)`));
    } else if (withinHours(f, hours * 3, now)) {
      items.push(fromEvent(f, 'POSSIBLY RELATED', 'filing', 'Company filing shortly before the window'));
    }
  }
  for (const n of i.news.filter(mine)) {
    const material = n.classifications.filter((c) => MATERIAL.has(c.category));
    if (withinHours(n, hours, now)) {
      if (material.length) items.push(fromEvent(n, 'CONFIRMED', 'news', `Article tagged ${sym} in window; ${material[0].basis}`));
      else items.push(fromEvent(n, 'STRONGLY RELATED', 'news', `Article tagged ${sym} by the provider, published inside the window`));
    } else if (withinHours(n, Math.max(hours * 3, 24), now)) {
      items.push(fromEvent(n, 'POSSIBLY RELATED', 'news', 'Ticker-tagged article shortly before the window'));
    }
  }
  for (const f of i.fda.filter(mine)) {
    if (withinHours(f, Math.max(hours, 24), now)) items.push(fromEvent(f, 'STRONGLY RELATED', 'catalyst', 'openFDA action naming this company'));
  }

  const today = isoToday();
  const winStartDay = new Date(now - hours * 3600_000).toISOString().slice(0, 10);
  // manual (team-entered, sourced) catalysts
  for (const c of i.catalysts.filter((c) => c.symbol.toUpperCase() === sym)) {
    const d = c.catalyst_date;
    const base = { id: `cat:${c.id}`, section: 'catalyst' as const, title: `MANUAL CATALYST · ${c.catalyst_type}: ${c.headline}`, source: hostOf(c.source_url) ?? 'Team entry (no source link)', at: d ? `${d}T00:00:00.000Z` : null, atPrecision: 'date' as const, url: c.source_url, categories: [c.catalyst_type] };
    if (d && d >= winStartDay && d <= today) items.push({ ...base, tier: c.source_url ? 'STRONGLY RELATED' : 'POSSIBLY RELATED', rule: `Team-logged catalyst dated inside the window${c.source_url ? ' (with source link)' : ' (no source link)'}` });
    else if (d && d > today && d <= addDays(today, 7)) items.push({ ...base, section: 'upcoming', tier: 'POSSIBLY RELATED', rule: 'Upcoming team-logged catalyst within 7 days' });
  }
  // earnings dates
  for (const e of i.earnings.filter((e) => e.symbol.toUpperCase() === sym)) {
    const base = { id: `earn:${e.symbol}:${e.reportDate}`, title: `Earnings report scheduled ${e.reportDate}${e.fiscalDateEnding ? ` (fiscal period ending ${e.fiscalDateEnding})` : ''}`, source: e.source, at: `${e.reportDate}T00:00:00.000Z`, atPrecision: 'date' as const, url: null, categories: ['Earnings'] };
    if (e.reportDate >= winStartDay && e.reportDate <= today) items.push({ ...base, section: 'catalyst', tier: 'STRONGLY RELATED', rule: 'Scheduled earnings date inside the window' });
    else if (e.reportDate > today && e.reportDate <= addDays(today, 14)) items.push({ ...base, section: 'upcoming', tier: 'POSSIBLY RELATED', rule: 'Earnings date within the next 14 days' });
  }
  // sector policy
  if (i.sectorTags.length) {
    for (const p of i.policy) {
      const hit = (p.tags ?? []).find((t) => i.sectorTags.includes(t));
      if (hit && withinHours(p, Math.max(hours, 72), now)) items.push(fromEvent(p, 'POSSIBLY RELATED', 'policy', `Potentially related: ${p.source} item tagged “${hit}”, matching this company's sector`));
    }
  }
  // macro releases (market-wide)
  for (const r of i.releases) {
    if (r.priority !== 'high') continue;
    if (r.date >= winStartDay && r.date <= today)
      items.push({ id: `rel:${r.id}`, tier: 'POSSIBLY RELATED', section: 'macro', title: `${r.name} released`, source: r.source, at: `${r.date}T00:00:00.000Z`, atPrecision: 'date', url: r.url, rule: `Potentially related: market-wide high-importance release (${r.priorityBasis})`, categories: ['Macro'] });
    else if (r.date > today && r.date <= addDays(today, 3))
      items.push({ id: `rel:${r.id}`, tier: 'POSSIBLY RELATED', section: 'upcoming', title: `${r.name} scheduled`, source: r.source, at: `${r.date}T00:00:00.000Z`, atPrecision: 'date', url: r.url, rule: 'Upcoming market-wide high-importance release', categories: ['Macro'] });
  }
  // team annotations on this ticker's events (user analysis, never evidence of cause)
  for (const a of i.annotations) {
    const ev = a.event as { tickers?: string[]; title?: string; url?: string; at?: string };
    if (!a.note || !ev.tickers?.map((t) => t.toUpperCase()).includes(sym)) continue;
    items.push({ id: `note:${a.id}`, tier: 'POSSIBLY RELATED', section: 'note', title: `USER NOTE on “${ev.title ?? a.event_key}”: ${a.note}`, source: 'Your team', at: a.updated_at, atPrecision: 'time', url: ev.url ?? null, rule: 'User analysis — not a source', categories: [] });
  }

  const seen = new Set<string>();
  const dedup = items.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
  dedup.sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier) || (b.at ?? '').localeCompare(a.at ?? ''));
  const verdict: Verdict = dedup.some((x) => x.tier === 'CONFIRMED')
    ? 'CONFIRMED'
    : dedup.some((x) => x.tier === 'STRONGLY RELATED')
      ? 'STRONGLY RELATED'
      : 'NO CONFIRMED CATALYST FOUND';
  return { verdict, items: dedup };
}

/** Price move over the window from REAL provider bars. null when bars don't cover the window. */
export function moveFromBars(bars: Candle[], hours: number): { pct: number; from: Candle; to: Candle } | null {
  if (bars.length < 2) return null;
  const to = bars[bars.length - 1];
  const target = to.time - hours * 3600;
  if (bars[0].time > target) return null; // bars don't reach back far enough
  let from = bars[0];
  for (const b of bars) {
    if (b.time <= target) from = b;
    else break;
  }
  if (from === to || from.close <= 0) return null;
  return { pct: ((to.close - from.close) / from.close) * 100, from, to };
}
