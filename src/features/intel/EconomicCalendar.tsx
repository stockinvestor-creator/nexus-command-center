import { useMemo } from 'react';
import { CalendarClock, ExternalLink } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { SkeletonRows } from '@/components/ui/States';
import { MarketUnavailable } from '@/components/ui/DataSource';
import { useEconCalendar } from '@/hooks/useIntel';
import { fmtDate, isoDay } from '@/lib/format';
import type { EconomicRelease } from '@/types/intel';
import { SourceStatus } from './SourceStatus';

/** Shared hook: the next `days` of US economic releases (FRED release calendar + FOMC). */
export function useUpcomingReleases(days = 14, back = 0) {
  const from = isoDay(-back);
  const to = isoDay(days);
  const q = useEconCalendar(from, to);
  const releases = useMemo(() => [...(q.data?.data.releases ?? [])].sort((a, b) => a.date.localeCompare(b.date) || (a.priority === 'high' ? -1 : 1)), [q.data]);
  return { q, releases };
}

/** The time only when the source actually publishes one (FRED gives dates only). */
export const releaseTime = (r: EconomicRelease) => (r.time && /\d/.test(r.time) ? r.time : null);

export function ReleaseRow({ r }: { r: EconomicRelease }) {
  const today = r.date === isoDay(0);
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.04] py-2 last:border-0">
      <span className={`w-20 shrink-0 font-mono text-[11px] ${today ? 'text-neon-cyan' : 'text-slate-400'}`}>{today ? 'TODAY' : fmtDate(r.date).replace(/, \d{4}$/, '')}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{r.name}</span>
      <span className="font-mono text-[10px] text-slate-500" title={releaseTime(r) ? 'Time published by source' : 'The source publishes the release date only'}>
        {releaseTime(r) ?? 'time not published by source'}
      </span>
      {r.priority === 'high' && (
        <Badge tone="amber" title={`NEXUS rule: ${r.priorityBasis}`}>
          High importance
        </Badge>
      )}
      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-mono text-[10px] text-slate-500 hover:text-neon-cyan" title={r.source}>
        {r.source === 'FRED release calendar' ? 'FRED' : 'Fed'} <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </li>
  );
}

/** US economic calendar list — real release dates only; times shown only when the source states them. */
export function EconomicCalendarList({ className, days = 14, highOnly = false, limit }: { className?: string; days?: number; highOnly?: boolean; limit?: number }) {
  const { q, releases } = useUpcomingReleases(days);
  const rows = (highOnly ? releases.filter((r) => r.priority === 'high') : releases).slice(0, limit ?? 999);
  return (
    <GlassCard className={className} title="US economic calendar" icon={<CalendarClock />} badge={<span className="hidden font-mono text-[9px] uppercase tracking-wider text-slate-500 sm:inline">FRED · Federal Reserve</span>}>
      <SourceStatus sources={q.data?.data.sources} fetchedAt={q.data?.fetchedAt} stale={q.data?.stale} error={q.error?.message ?? q.data?.error} onRefresh={q.refetch} refreshing={q.loading} className="mb-2" />
      {q.loading && !q.data ? (
        <SkeletonRows rows={5} />
      ) : q.error && !q.data ? (
        <MarketUnavailable message={`Economic calendar unavailable — ${q.error.message}`} />
      ) : rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-500">No scheduled releases found in the next {days} days.</p>
      ) : (
        <ul>{rows.map((r) => <ReleaseRow key={r.id} r={r} />)}</ul>
      )}
      <p className="mt-2 text-[10px] text-slate-600">Importance is a NEXUS rule (CPI, PCE, jobs, GDP, FOMC, retail sales, PPI…), not a provider rating. Consensus/actual values are shown in the TradingView calendar.</p>
    </GlassCard>
  );
}
