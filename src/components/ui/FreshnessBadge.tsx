import type { DataFreshness } from '@/types/market';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';

const META: Record<DataFreshness, { cls: string; dot: string; title: string }> = {
  LIVE: { cls: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300', dot: 'bg-emerald-400', title: 'Real-time data' },
  DELAYED: {
    cls: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
    dot: 'bg-amber-400',
    title: 'Delayed data (typically 15+ minutes, per exchange licensing)',
  },
  EOD: { cls: 'border-sky-400/40 bg-sky-400/10 text-sky-300', dot: 'bg-sky-400', title: 'End-of-day data (previous close)' },
  DEMO: { cls: 'border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300', dot: 'bg-fuchsia-400', title: 'Synthetic demo data — not real prices' },
};

/** Always shown next to market data so users know how fresh it is. */
export function FreshnessBadge({
  freshness,
  stale,
  asOf,
  className,
  note,
}: {
  freshness: DataFreshness;
  stale?: boolean;
  asOf?: number;
  className?: string;
  note?: string;
}) {
  const m = META[freshness];
  const title = [m.title, stale ? 'Served from cache (provider unavailable or limit reached)' : '', asOf ? `As of ${fmtDateTime(asOf)}` : '', note ?? '']
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded border px-1.5 py-[1px] font-mono text-[9px] font-semibold tracking-[0.14em]',
        m.cls,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot, freshness === 'LIVE' && 'animate-pulse')} />
      {freshness}
      {stale && <span className="text-slate-400">·CACHED</span>}
    </span>
  );
}
