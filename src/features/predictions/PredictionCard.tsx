import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/store/authStore';
import { cn } from '@/lib/cn';
import { daysUntil, fmtDate, fmtPct } from '@/lib/format';
import type { Prediction } from '@/types/db';
import { DIRECTION_LABEL, STATUS_META, TYPE_LABEL } from './api';

export function dueLabel(p: Prediction) {
  if (p.status !== 'open' || !p.resolution_date) return null;
  const d = daysUntil(p.resolution_date);
  if (d == null) return null;
  return d < 0 ? { text: `Past due ${-d}d — needs resolution`, tone: 'text-amber-300' } : d === 0 ? { text: 'Resolves today', tone: 'text-neon-cyan' } : { text: `Resolves in ${d}d`, tone: 'text-slate-400' };
}

export function PredictionRow({ p, onOpen, compact }: { p: Prediction; onOpen?: () => void; compact?: boolean }) {
  const author = useAuth((s) => s.profiles.find((x) => x.id === p.created_by));
  const due = dueLabel(p);
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge>
        {p.symbol && <span className="font-mono text-xs font-semibold text-cyan-300">${p.symbol}</span>}
        <Badge tone={p.direction === 'bullish' ? 'green' : p.direction === 'bearish' ? 'red' : 'neutral'}>{DIRECTION_LABEL[p.direction]}</Badge>
        {!compact && <Badge tone="neutral">{TYPE_LABEL[p.prediction_type]}</Badge>}
        <span className="ml-auto font-mono text-[10px] text-violet-300" title="USER PREDICTION — the author's own confidence, not a probability model">{p.confidence}% conf.</span>
      </div>
      <p className={cn('mt-1 text-sm text-slate-200', compact && 'truncate')}>{p.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[10px] text-slate-500">
        {author && (
          <span className="flex items-center gap-1">
            <Avatar profile={author} size={14} /> {author.display_name}
          </span>
        )}
        <span>Made {fmtDate(p.prediction_date)}</span>
        {p.expected_move != null && <span>Exp. {fmtPct(p.expected_move)}</span>}
        {p.actual_move != null && <span className={p.actual_move >= 0 ? 'text-bull' : 'text-bear'}>Actual {fmtPct(p.actual_move)}</span>}
        {due && <span className={due.tone}>{due.text}</span>}
        {p.status !== 'open' && p.resolved_at && <span>Resolved {fmtDate(p.resolved_at)}</span>}
      </div>
    </>
  );
  return onOpen ? (
    <button onClick={onOpen} className="block w-full rounded-xl border border-white/[0.05] bg-white/[0.015] p-3 text-left transition hover:border-neon-cyan/30">
      {body}
    </button>
  ) : (
    <Link to={`/predictions?id=${p.id}`} className="block rounded-xl border border-white/[0.05] bg-white/[0.015] p-2.5 transition hover:border-neon-cyan/30">
      {body}
    </Link>
  );
}

export const PredictionIcon = Target;
