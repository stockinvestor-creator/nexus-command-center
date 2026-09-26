import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useQuotes } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { fmtPct, fmtPrice, trendClass, daysUntil } from '@/lib/format';
import { useMyWatchlist } from './api';
import { Badge } from '@/components/ui/Badge';

export function WatchlistMini({ className }: { className?: string }) {
  const { active, items } = useMyWatchlist();
  const sorted = [...items.rows].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.sort_order - b.sort_order);
  const quotes = useQuotes(sorted.map((i) => i.symbol));
  return (
    <GlassCard
      collapseId="wl-mini"
      className={className}
      title={active ? `Watchlist · ${active.name}` : 'Watchlist'}
      icon={<Star />}
      badge={<FreshnessBadge freshness={marketData().freshness} />}
      actions={
        <Link to="/watchlist" className="text-[11px] text-neon-cyan hover:underline">
          Open
        </Link>
      }
    >
      {items.loading ? (
        <SkeletonRows rows={5} />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<Star />}
          title="No tickers yet"
          action={
            <Link to="/watchlist">
              <Button size="sm" variant="outline">
                Add tickers
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-0.5">
          {sorted.slice(0, 9).map((it) => {
            const q = quotes.data?.[it.symbol];
            const d = daysUntil(it.catalyst_date);
            return (
              <Link key={it.id} to={`/stock/${it.symbol}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs transition hover:bg-white/[0.04]">
                {it.favorite ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : <span className="w-3" />}
                <span className="w-14 font-semibold text-slate-100">{it.symbol}</span>
                {d != null && d >= 0 && d <= 14 && <Badge tone="amber">T-{d}d</Badge>}
                <span className="ml-auto text-slate-300">{fmtPrice(q?.price)}</span>
                <span className={`w-16 text-right ${trendClass(q?.changePercent)}`}>{fmtPct(q?.changePercent)}</span>
              </Link>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
