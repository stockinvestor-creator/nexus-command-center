import { useMemo, useState, type ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import type { IntelCategory, IntelEvent, IntelSourceStatus } from '@/types/intel';
import { CATEGORY_LABEL } from '@/types/intel';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { MarketUnavailable } from '@/components/ui/DataSource';
import { cn } from '@/lib/cn';
import { EventCard } from './EventCard';
import { SourceStatus } from './SourceStatus';
import { useAnnotations } from './annotations';

export interface EventListProps {
  events: IntelEvent[];
  loading?: boolean;
  error?: string;
  sources?: IntelSourceStatus[];
  fetchedAt?: number;
  stale?: boolean;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
  /** Show category filter chips */
  filters?: boolean;
  limit?: number;
  columns?: 1 | 2 | 3;
}

/** Newest-first list of sourced events with category filters, loading/empty/unavailable states. */
export function EventList({ events, loading, error, sources, fetchedAt, stale, onRefresh, emptyTitle = 'No events found', emptyBody, filters = true, limit = 60, columns = 2 }: EventListProps) {
  const [cat, setCat] = useState<IntelCategory | 'ALL'>('ALL');
  const { byKey } = useAnnotations();
  const cats = useMemo(() => {
    const m = new Map<IntelCategory, number>();
    for (const e of events) for (const c of new Set(e.classifications.map((x) => x.category))) m.set(c, (m.get(c) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [events]);
  const shown = (cat === 'ALL' ? events : events.filter((e) => e.classifications.some((c) => c.category === cat))).slice(0, limit);
  const allUnconfigured = sources?.length && sources.every((s) => !s.ok && !s.configured);

  return (
    <div className="space-y-3">
      <SourceStatus sources={sources} fetchedAt={fetchedAt} stale={stale} error={error} onRefresh={onRefresh} refreshing={loading} />
      {filters && cats.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <Chip on={cat === 'ALL'} onClick={() => setCat('ALL')}>
            All {events.length}
          </Chip>
          {cats.map(([c, n]) => (
            <Chip key={c} on={cat === c} onClick={() => setCat(c)}>
              {CATEGORY_LABEL[c]} {n}
            </Chip>
          ))}
        </div>
      )}
      {loading && !events.length ? (
        <SkeletonRows rows={5} />
      ) : error && !events.length ? (
        <MarketUnavailable reason="unavailable" message={error} />
      ) : allUnconfigured && !events.length ? (
        <MarketUnavailable reason="not_configured" message={sources?.[0]?.error ?? 'Source not configured'} />
      ) : !shown.length ? (
        <EmptyState icon={<Inbox />} title={emptyTitle} body={emptyBody} />
      ) : (
        <div className={cn('grid gap-3', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 2xl:grid-cols-3')}>
          {shown.map((e) => (
            <EventCard key={e.id} event={e} annotation={byKey.get(e.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={cn('rounded-lg border px-2 py-0.5 text-[11px] transition', on ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 text-slate-400 hover:text-white')}>
      {children}
    </button>
  );
}
