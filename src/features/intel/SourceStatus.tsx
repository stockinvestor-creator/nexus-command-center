import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import type { IntelSourceStatus } from '@/types/intel';
import { cn } from '@/lib/cn';
import { ago } from './time';

/** "SOURCE: SEC · LAST CHECKED 2 MIN AGO" chips (plus configuration/errors). */
export function SourceStatus({ sources, fetchedAt, stale, error, onRefresh, refreshing, className }: { sources?: IntelSourceStatus[]; fetchedAt?: number; stale?: boolean; error?: string; onRefresh?: () => void; refreshing?: boolean; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider', className)}>
      {(sources ?? []).map((s) => (
        <span
          key={s.source}
          title={s.error ?? (s.checkedAt ? `Last checked ${new Date(s.checkedAt).toLocaleString()}` : '')}
          className={cn('inline-flex items-center gap-1 rounded border px-1.5 py-[1px]', s.ok ? 'border-emerald-400/25 text-emerald-200' : s.configured ? 'border-amber-400/30 text-amber-200' : 'border-white/10 text-slate-500')}
        >
          {s.ok ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
          {s.source}
          {s.checkedAt ? <span className="text-slate-500">· checked {ago(s.checkedAt)}</span> : null}
          {!s.configured && <span className="normal-case tracking-normal text-slate-500">· not configured</span>}
        </span>
      ))}
      {stale && fetchedAt && <span className="rounded border border-amber-400/30 px-1.5 py-[1px] text-amber-200">Cached copy from {ago(fetchedAt)}</span>}
      {error && !stale && <span className="rounded border border-amber-400/30 px-1.5 py-[1px] normal-case tracking-normal text-amber-200">{error}</span>}
      {onRefresh && (
        <button onClick={onRefresh} className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-slate-400 hover:text-neon-cyan" disabled={refreshing}>
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} /> Refresh
        </button>
      )}
    </div>
  );
}
