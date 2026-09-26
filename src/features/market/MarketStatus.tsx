import { useNow } from '@/hooks/useNow';
import { marketSession, SESSION_LABEL } from '@/lib/marketClock';
import { PulseDot } from '@/components/ui/States';
import { cn } from '@/lib/cn';
import type { MarketSession } from '@/types/market';

const COLORS: Record<MarketSession, { dot: string; text: string }> = {
  open: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  pre: { dot: 'bg-amber-400', text: 'text-amber-300' },
  after: { dot: 'bg-violet-400', text: 'text-violet-300' },
  closed: { dot: 'bg-slate-500', text: 'text-slate-400' },
};

export function MarketStatusPill({ className }: { className?: string }) {
  const now = useNow(15_000);
  const s = marketSession(now);
  const c = COLORS[s];
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1', className)}>
      {s === 'closed' ? <span className={cn('h-2 w-2 rounded-full', c.dot)} /> : <PulseDot color={c.dot} />}
      <span className={cn('font-mono text-[10px] font-semibold uppercase tracking-[0.14em]', c.text)}>{SESSION_LABEL[s]}</span>
    </span>
  );
}

const etClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const localClock = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

export function Clock() {
  const now = useNow(1000);
  return (
    <div className="hidden flex-col items-end leading-none lg:flex">
      <span className="num text-sm text-slate-100 [text-shadow:0_0_12px_rgba(34,211,238,0.35)]">{etClock.format(now)} <span className="text-[10px] text-slate-500">ET</span></span>
      <span className="mt-0.5 font-mono text-[10px] text-slate-500">local {localClock.format(now)}</span>
    </div>
  );
}
