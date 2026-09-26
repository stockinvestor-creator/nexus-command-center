import { Link } from 'react-router-dom';
import { Briefcase, Swords } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { TickerChip } from '@/components/ui/TickerChip';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { ClickRow } from '@/components/ui/ClickRow';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useQuotes } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { cn } from '@/lib/cn';
import { fmtPct, fmtPrice, trendClass } from '@/lib/format';
import { STATUS_META, tradePnl } from './api';

export function ActiveTrades({ className }: { className?: string }) {
  const { rows, loading } = useLiveTable('trade_ideas', { order: { column: 'updated_at', ascending: false } });
  const active = rows.filter((t) => ['watching', 'planning', 'entered'].includes(t.status)).slice(0, 6);
  return (
    <GlassCard
      collapseId="active-trades"
      className={className}
      title="Shared Trade Ideas"
      icon={<Swords />}
      actions={
        <Link to="/war-room" className="text-[11px] text-neon-cyan hover:underline">
          War Room
        </Link>
      }
    >
      {loading ? (
        <SkeletonRows rows={4} />
      ) : active.length === 0 ? (
        <EmptyState icon={<Swords />} title="No active ideas" body="Post one in the Trade War Room." />
      ) : (
        <ul className="space-y-1">
          {active.map((t) => (
            <li key={t.id}>
              <ClickRow to={`/war-room?trade=${t.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 transition hover:bg-white/[0.03]">
                <TickerChip symbol={t.symbol} />
                <Badge tone={t.direction === 'long' ? 'green' : 'red'}>{t.direction}</Badge>
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{t.thesis ?? t.catalyst ?? ''}</span>
                <Badge tone={STATUS_META[t.status].tone}>{STATUS_META[t.status].label}</Badge>
              </ClickRow>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}

export function PortfolioTracker({ className }: { className?: string }) {
  const { rows, loading } = useLiveTable('trade_ideas', { order: { column: 'updated_at', ascending: false } });
  const entered = rows.filter((t) => t.status === 'entered');
  const closed = rows.filter((t) => ['won', 'lost', 'closed'].includes(t.status));
  const quotes = useQuotes(entered.map((t) => t.symbol));
  const positions = entered.map((t) => ({ t, pnl: tradePnl(t, quotes.data?.[t.symbol]?.price) }));
  const openDollars = positions.reduce((s, p) => s + (p.pnl?.dollars ?? 0), 0);
  const realized = closed.map((t) => tradePnl(t, null)).filter(Boolean);
  const wins = closed.filter((t) => t.status === 'won').length;
  const losses = closed.filter((t) => t.status === 'lost').length;
  const winRate = wins + losses ? (wins / (wins + losses)) * 100 : null;
  const realizedDollars = realized.reduce((s, p) => s + (p?.dollars ?? 0), 0);

  return (
    <GlassCard collapseId="portfolio" className={className} title="Trade Tracker" icon={<Briefcase />} badge={<FreshnessBadge freshness={marketData().freshness} />}>
      {loading ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'Open P&L', v: entered.length ? `${openDollars >= 0 ? '+' : ''}${fmtPrice(openDollars)}` : '—', c: trendClass(openDollars) },
              { l: 'Realized', v: realized.length ? `${realizedDollars >= 0 ? '+' : ''}${fmtPrice(realizedDollars)}` : '—', c: trendClass(realizedDollars) },
              { l: 'Win rate', v: winRate == null ? '—' : `${winRate.toFixed(0)}%`, c: 'text-slate-100' },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-white/5 bg-white/[0.02] px-2 py-2 text-center">
                <div className={cn('num text-sm font-semibold', x.c)}>{x.v}</div>
                <div className="label mt-0.5">{x.l}</div>
              </div>
            ))}
          </div>
          <p className="label mb-1.5 mt-4">Open positions ({entered.length})</p>
          {positions.length === 0 ? (
            <p className="text-xs text-slate-500">Mark a War Room idea as “Entered” (with entry & size) to track it here.</p>
          ) : (
            <ul className="space-y-0.5">
              {positions.map(({ t, pnl }) => (
                <li key={t.id}>
                  <ClickRow to={`/war-room?trade=${t.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs hover:bg-white/[0.03]">
                    <TickerChip symbol={t.symbol} />
                    <span className="text-slate-500">
                      {t.position_size ?? '?'}sh @ {fmtPrice(t.entry)}
                    </span>
                    <span className={cn('ml-auto', trendClass(pnl?.pct))}>{pnl ? fmtPct(pnl.pct) : 'need entry'}</span>
                  </ClickRow>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[10px] text-slate-600">
            Paper tracking from shared ideas using the latest available price. Wins {wins} · Losses {losses} · Closed {closed.length}.
          </p>
        </>
      )}
    </GlassCard>
  );
}
