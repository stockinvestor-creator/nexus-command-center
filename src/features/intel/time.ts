import type { IntelEvent } from '@/types/intel';

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const dtFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' });

export function ago(ms: number): string {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const VERB: Record<IntelEvent['kind'], string> = {
  filing: 'Filed',
  news: 'Published',
  regulatory: 'Reported',
  policy: 'Published',
  macro: 'Released',
  earnings_date: 'Scheduled',
};

/** "FILED 8 MIN AGO" when the source gives a time; "FILED SEP 25" when it only gives a date. */
export function eventTimeLabel(e: IntelEvent): { short: string; full: string } {
  const t = Date.parse(e.at);
  const verb = VERB[e.kind];
  if (e.atPrecision === 'date') {
    const d = dateFmt.format(new Date(t));
    return { short: `${verb} ${d}`, full: `${verb} ${d} (source provides the date only)` };
  }
  return { short: `${verb} ${ago(t)}`, full: `${verb} ${dtFmt.format(new Date(t))} ET` };
}
