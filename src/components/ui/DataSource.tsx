import { AlertTriangle, Clock3, DatabaseZap, Radio } from 'lucide-react';
import type { DataStatus, Provenance } from '@/types/market';
import type { UnavailableReason } from '@/services/market/MarketDataProvider';
import { DEFAULT_MESSAGES } from '@/services/market/MarketDataProvider';
import { cn } from '@/lib/cn';

export const STATUS_LABEL: Record<DataStatus, string> = {
  REALTIME_IEX: 'Realtime · IEX only',
  REALTIME: 'Realtime',
  DELAYED: 'Delayed',
  END_OF_DAY: 'End of day',
};

const etTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' });
const etDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });

export function updatedLabel(p: Provenance): string | null {
  if (p.updatedAt == null) return null;
  const d = new Date(p.updatedAt);
  return p.status === 'END_OF_DAY' ? `Updated ${etDate.format(d)}` : `Updated ${etTime.format(d)} ET`;
}

/** SOURCE · STATUS · LAST UPDATED — shown next to every NEXUS-rendered market value. */
export function DataSourceBadge({ provenance, className }: { provenance: Provenance; className?: string }) {
  const upd = updatedLabel(provenance);
  const title = [provenance.source, STATUS_LABEL[provenance.status], upd, provenance.stale ? 'Served from cache: provider unavailable or limit reached' : '', provenance.note ?? '']
    .filter(Boolean)
    .join(' · ');
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 truncate rounded border px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.12em]',
        provenance.stale ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : 'border-sky-400/30 bg-sky-400/10 text-sky-200',
        className,
      )}
    >
      <DatabaseZap className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">
        {provenance.source} · {STATUS_LABEL[provenance.status]}
        {upd && <span className="text-slate-400"> · {upd}</span>}
        {provenance.stale && <span className="text-amber-300"> · cached</span>}
      </span>
    </span>
  );
}

/** Label for official TradingView embeds (their freshness depends on TradingView's exchange entitlements). */
export function TradingViewBadge({ className }: { className?: string }) {
  return (
    <span
      title="Data displayed inside this widget is supplied by TradingView. Depending on the exchange it may be delayed. NEXUS does not modify or extract it."
      className={cn('inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.04] px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-300', className)}
    >
      <Radio className="h-2.5 w-2.5" /> TradingView market data
    </span>
  );
}

/** Explicit empty state. NEXUS shows this instead of any substitute value. */
export function MarketUnavailable({ reason = 'unavailable', message, compact, className }: { reason?: UnavailableReason; message?: string; compact?: boolean; className?: string }) {
  const text = message ?? DEFAULT_MESSAGES[reason];
  if (compact)
    return (
      <span title={text} className={cn('text-slate-500', className)}>
        —
      </span>
    );
  const Icon = reason === 'rate_limited' ? Clock3 : AlertTriangle;
  return (
    <div className={cn('flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400', className)}>
      <Icon className={cn('h-3.5 w-3.5 shrink-0', reason === 'rate_limited' ? 'text-amber-400' : 'text-slate-500')} />
      {text}
    </div>
  );
}

/** Tiny label marking a value as the team's own estimate, not provider market data. */
export function UserEstimateTag({ label = 'User estimate', className }: { label?: string; className?: string }) {
  return (
    <span
      title="Entered manually by you or your partner. Not market data."
      className={cn('inline-flex items-center rounded border border-violet-400/30 bg-violet-400/10 px-1 py-[1px] font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-violet-200', className)}
    >
      {label}
    </span>
  );
}
