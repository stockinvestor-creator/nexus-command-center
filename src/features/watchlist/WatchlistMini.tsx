import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { daysUntil } from '@/lib/format';
import { useMyWatchlist } from './api';
import { WatchlistQuotes } from './WatchlistQuotes';

export function WatchlistMini({ className }: { className?: string }) {
  const { active, items } = useMyWatchlist();
  const [tab, setTab] = useState<'quotes' | 'details'>('quotes');
  const sorted = [...items.rows].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.sort_order - b.sort_order);
  return (
    <GlassCard
      collapseId="wl-mini"
      className={className}
      title={active ? `Watchlist · ${active.name}` : 'Watchlist'}
      icon={<Star />}
      bodyClassName="p-0"
      actions={
        <Link to="/watchlist" className="text-[11px] text-neon-cyan hover:underline">
          Open
        </Link>
      }
    >
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-2">
        <Tabs size="xs" value={tab} onChange={setTab} options={[{ value: 'quotes', label: 'Quotes' }, { value: 'details', label: 'Your notes' }]} />
        {tab === 'quotes' && <TradingViewBadge className="ml-auto" />}
      </div>
      {items.loading ? (
        <div className="p-4">
          <SkeletonRows rows={5} />
        </div>
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
      ) : tab === 'quotes' ? (
        <WatchlistQuotes title={active?.name ?? 'Watchlist'} tickers={sorted.map((i) => i.symbol)} heightClass="h-[340px]" />
      ) : (
        <div className="space-y-0.5 p-2">
          {sorted.slice(0, 10).map((it) => {
            const d = daysUntil(it.catalyst_date);
            return (
              <Link key={it.id} to={`/stock/${it.symbol}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition hover:bg-white/[0.04]">
                {it.favorite ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : <span className="w-3" />}
                <span className="w-14 font-mono font-semibold text-slate-100">{it.symbol}</span>
                <Badge tone={it.direction === 'long' ? 'green' : it.direction === 'short' ? 'red' : 'neutral'}>{it.direction}</Badge>
                <span className="min-w-0 flex-1 truncate text-slate-500">{it.category}</span>
                {d != null && d >= 0 && d <= 14 && <Badge tone="amber">⚡ {d}d</Badge>}
              </Link>
            );
          })}
        </div>
      )}
    </GlassCard>
  );
}
