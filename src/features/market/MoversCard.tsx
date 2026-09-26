import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, TrendingDown, TrendingUp } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { useMarketMovers } from '@/hooks/useMarket';
import { fmtCompact, fmtPct, fmtPrice, trendClass } from '@/lib/format';
import type { Mover } from '@/types/market';

type Kind = 'gainers' | 'losers' | 'mostActive';

export function MoversCard({ initial = 'gainers', className }: { initial?: Kind; className?: string }) {
  const [kind, setKind] = useState<Kind>(initial);
  const { data, loading, error, refetch } = useMarketMovers();
  const list: Mover[] = data?.[kind] ?? [];
  return (
    <GlassCard
      collapseId="movers"
      className={className}
      title="Market Movers"
      icon={kind === 'losers' ? <TrendingDown /> : kind === 'gainers' ? <TrendingUp /> : <Activity />}
      badge={data && <FreshnessBadge freshness={data.freshness} asOf={data.asOf} />}
    >
      <Tabs
        size="xs"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'gainers', label: 'Top gainers' },
          { value: 'losers', label: 'Top losers' },
          { value: 'mostActive', label: 'Most active' },
        ]}
        className="mb-3"
      />
      {loading && !data ? (
        <SkeletonRows rows={6} />
      ) : error && !data ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : (
        <div className="space-y-0.5">
          {list.slice(0, 8).map((m, i) => (
            <Link
              key={m.symbol}
              to={`/stock/${m.symbol}`}
              className="grid grid-cols-[18px_64px_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs transition hover:bg-white/[0.04]"
            >
              <span className="text-slate-600">{i + 1}</span>
              <span className="font-semibold text-slate-100">{m.symbol}</span>
              <span className="text-right text-slate-400">{fmtPrice(m.price)}</span>
              <span className="w-16 text-right text-slate-500">{fmtCompact(m.volume)}</span>
              <span className={`w-16 text-right ${trendClass(m.changePercent)}`}>{fmtPct(m.changePercent)}</span>
            </Link>
          ))}
          {list.length === 0 && <p className="py-4 text-center text-xs text-slate-500">No data.</p>}
        </div>
      )}
    </GlassCard>
  );
}
