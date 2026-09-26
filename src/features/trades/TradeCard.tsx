import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowDownRight, ArrowUpRight, CalendarClock, MessageSquare } from 'lucide-react';
import type { TradeIdea, TradeReaction } from '@/types/db';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { TickerChip } from '@/components/ui/TickerChip';
import { useAuth } from '@/store/authStore';
import { useQuote } from '@/hooks/useMarket';
import { cn } from '@/lib/cn';
import { daysUntil, fmtDate, fmtPct, fmtPrice, timeAgo, trendClass } from '@/lib/format';
import { STATUS_META, tradePnl } from './api';
import { ReactionBar } from './ReactionBar';

function TradeCardInner({ trade, reactions, commentCount, onOpen }: { trade: TradeIdea; reactions: TradeReaction[]; commentCount: number; onOpen: () => void }) {
  const author = useAuth((s) => s.profiles.find((p) => p.id === trade.created_by));
  const { data: q } = useQuote(trade.symbol);
  const pnl = tradePnl(trade, q?.price);
  const long = trade.direction === 'long';
  const d = daysUntil(trade.catalyst_date);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      onClick={onOpen}
      className="glass glow-border cursor-pointer p-4"
    >
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', long ? 'bg-emerald-400/10 text-bull' : 'bg-rose-400/10 text-bear')}>
          {long ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
        </span>
        <TickerChip symbol={trade.symbol} size="md" />
        <Badge tone={long ? 'green' : 'red'}>{trade.direction}</Badge>
        <Badge tone={STATUS_META[trade.status].tone} className="ml-auto">
          {STATUS_META[trade.status].label}
        </Badge>
      </div>
      {trade.thesis && <p className="mt-3 line-clamp-3 text-sm text-slate-300">{trade.thesis}</p>}
      <div className="mt-3 grid grid-cols-4 gap-2 font-mono text-[11px]">
        {[
          ['Entry', fmtPrice(trade.entry)],
          ['Target', fmtPrice(trade.target)],
          ['Exp.', trade.expected_move != null ? `±${trade.expected_move}%` : '—'],
          ['Prob.', trade.probability != null ? `${trade.probability}%` : '—'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-slate-500">{l}</div>
            <div className="text-slate-200">{v}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        <span className="font-mono">
          Now {fmtPrice(q?.price)}
          {pnl && <span className={cn('ml-1.5', trendClass(pnl.pct))}>{fmtPct(pnl.pct)}{pnl.realized ? ' (realized)' : ''}</span>}
        </span>
        {trade.catalyst_date && (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {fmtDate(trade.catalyst_date)}
            {d != null && d >= 0 && <span className="text-amber-300">· {d}d</span>}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3 w-3" /> {commentCount}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
        <Avatar profile={author} size={20} />
        <span className="text-[11px] text-slate-400">{author?.display_name ?? 'Unknown'}</span>
        <span className="font-mono text-[10px] text-slate-600">{timeAgo(trade.updated_at)}</span>
        <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
          <ReactionBar tradeId={trade.id} reactions={reactions} compact />
        </div>
      </div>
    </motion.div>
  );
}

export const TradeCard = memo(TradeCardInner);
