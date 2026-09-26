import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { DataSourceBadge, MarketUnavailable } from '@/components/ui/DataSource';
import { SkeletonRows } from '@/components/ui/States';
import { useMovers, type MoverKind } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { fmtCompact, fmtPct, fmtPrice, trendClass } from '@/lib/format';

/** Movers from the configured API provider (only rendered when it supports them). */
export function ProviderMovers({ className }: { className?: string }) {
  const [kind, setKind] = useState<MoverKind>('gainers');
  const q = useMovers(kind);
  if (!marketData().capabilities.movers) return null;
  return (
    <GlassCard className={className} title={`Movers · ${marketData().sourceLabel}`} icon={<Activity />} badge={q.data && <DataSourceBadge provenance={q.data.provenance} />}>
      <Tabs size="xs" value={kind} onChange={setKind} options={[{ value: 'gainers', label: 'Gainers' }, { value: 'losers', label: 'Losers' }, { value: 'active', label: 'Most active' }]} className="mb-3" />
      {q.loading && !q.data ? (
        <SkeletonRows rows={6} />
      ) : !q.data ? (
        <MarketUnavailable reason={q.reason} message={q.error?.message} />
      ) : (
        <div className="space-y-0.5">
          {q.data.items.slice(0, 10).map((m) => (
            <Link key={m.symbol} to={`/stock/${m.symbol}`} className="grid grid-cols-[64px_1fr_auto_auto] items-center gap-2 rounded-lg px-2 py-1.5 font-mono text-xs hover:bg-white/[0.04]">
              <span className="font-semibold text-slate-100">{m.symbol}</span>
              <span className="text-right text-slate-400">{fmtPrice(m.price)}</span>
              <span className="w-16 text-right text-slate-500">{fmtCompact(m.volume)}</span>
              <span className={`w-16 text-right ${trendClass(m.changePercent)}`}>{fmtPct(m.changePercent)}</span>
            </Link>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
