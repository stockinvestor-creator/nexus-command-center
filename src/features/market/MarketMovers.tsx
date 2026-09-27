import { WhyQuickInput } from '@/features/why/WhyQuick';
import { useState } from 'react';
import { Activity, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { TradingViewWidget, tv, type ScreenerPreset } from '@/components/widgets/TradingViewWidget';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSettings } from '@/store/settingsStore';
import { cn } from '@/lib/cn';

type Kind = 'gainers' | 'losers' | 'active';
const COLUMNS: { kind: Kind; label: string; preset: ScreenerPreset; icon: typeof TrendingUp; accent: string }[] = [
  { kind: 'gainers', label: 'Top gainers', preset: 'top_gainers', icon: TrendingUp, accent: 'text-bull' },
  { kind: 'losers', label: 'Top losers', preset: 'top_losers', icon: TrendingDown, accent: 'text-bear' },
  { kind: 'active', label: 'Most active', preset: 'volume_leaders', icon: Activity, accent: 'text-neon-cyan' },
];

/**
 * MARKET MOVERS — three official TradingView Stock Screener widgets (US market) preset to
 * Top Gainers / Top Losers / Volume Leaders. Columns (price, change, change %, volume,
 * relative volume, market cap, sector…) are whatever TradingView supplies for the "Overview"
 * column set. NEXUS adds nothing to these lists.
 */
export function MarketMovers({ className }: { className?: string }) {
  const wide = useMediaQuery('(min-width: 1280px)');
  const [kind, setKind] = useState<Kind>('gainers');
  const enabled = useSettings((s) => s.widgets.movers);
  const toggle = useSettings((s) => s.toggleWidget);
  const shown = wide ? COLUMNS : COLUMNS.filter((c) => c.kind === kind);

  return (
    <GlassCard
      collapseId="market-movers"
      className={cn('glow-border', className)}
      title="Market Movers"
      icon={<Flame />}
      badge={<TradingViewBadge className="hidden sm:inline-flex" />}
      actions={<WhyQuickInput className="hidden sm:flex" />}
      bodyClassName="p-0"
    >
      {!enabled ? (
        <EmptyState
          title="Market Movers hidden"
          body="Uses official TradingView screener widgets."
          action={
            <Button size="sm" variant="outline" onClick={() => toggle('movers')}>
              Show
            </Button>
          }
        />
      ) : (
        <>
          {!wide && (
            <div className="border-b border-white/[0.05] p-2">
              <Tabs value={kind} onChange={setKind} options={COLUMNS.map((c) => ({ value: c.kind, label: c.label }))} />
            </div>
          )}
          <div className={cn('grid', wide ? 'grid-cols-3 divide-x divide-white/[0.05]' : 'grid-cols-1')}>
            {shown.map((c) => (
              <div key={c.kind} className="flex min-w-0 flex-col">
                {wide && (
                  <div className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5">
                    <c.icon className={cn('h-4 w-4', c.accent)} />
                    <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-slate-200">{c.label}</span>
                    <span className="ml-auto font-mono text-[10px] text-slate-500">US · TradingView screener</span>
                  </div>
                )}
                <div className="h-[520px] sm:h-[560px]">
                  <TradingViewWidget key={c.preset} script="screener" config={tv.screener(c.preset, 'overview', false)} failureText={`${c.label}: market data temporarily unavailable`} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
}
