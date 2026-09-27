import { ExternalLink, Landmark } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonRows } from '@/components/ui/States';
import { MarketUnavailable } from '@/components/ui/DataSource';
import { TradingViewWidget } from '@/components/widgets/TradingViewWidget';
import { tv } from '@/components/widgets/TradingViewWidget';
import { useMacro } from '@/hooks/useIntel';
import { fmtDate } from '@/lib/format';
import { SourceStatus } from './SourceStatus';

const LIVE_MARKETS: [string, string][] = [
  ['TVC:US10Y', 'US 10Y yield'],
  ['TVC:US02Y', 'US 2Y yield'],
  ['TVC:VIX', 'VIX'],
  ['TVC:DXY', 'US dollar index'],
];

/** FRED macro values (official releases, with date + basis) + TradingView mini charts for market-priced rates/vol. */
export function MacroDashboard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const q = useMacro();
  const series = q.data?.data.series ?? [];
  return (
    <GlassCard className={className} title="Macro dashboard" icon={<Landmark />} badge={<span className="hidden font-mono text-[9px] uppercase tracking-wider text-slate-500 sm:inline">Source: FRED (St. Louis Fed)</span>}>
      <SourceStatus sources={q.data?.data.sources} fetchedAt={q.data?.fetchedAt} stale={q.data?.stale} error={q.error?.message ?? q.data?.error} onRefresh={q.refetch} refreshing={q.loading} className="mb-3" />
      {q.loading && !q.data ? (
        <SkeletonRows rows={4} />
      ) : q.error && !q.data ? (
        <MarketUnavailable message={`Macro data unavailable — ${q.error.message}`} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {series.map((s) => (
            <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer" title={s.basis} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-neon-cyan/30">
              <p className="truncate text-[11px] text-slate-400">{s.label}</p>
              <p className="mt-1 font-mono text-lg text-slate-100">{s.value == null ? <span className="text-sm text-slate-500">UNAVAILABLE</span> : `${s.value.toFixed(2)}${s.unit}`}</p>
              <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                {s.date ? `as of ${fmtDate(s.date)}` : 'no observation'}
                {s.previous != null && <span> · prev {s.previous.toFixed(2)}{s.unit}</span>}
              </p>
              <p className="mt-1 flex items-center gap-1 truncate text-[9px] text-slate-600 group-hover:text-slate-400">
                FRED {s.id} <ExternalLink className="h-2.5 w-2.5" />
              </p>
            </a>
          ))}
        </div>
      )}
      {!compact && (
        <>
          <p className="mb-2 mt-4 font-mono text-[10px] uppercase tracking-wider text-slate-500">Market-priced · TradingView</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {LIVE_MARKETS.map(([sym, label]) => (
              <div key={sym} className="h-[170px] overflow-hidden rounded-xl border border-white/[0.06]" title={label}>
                <TradingViewWidget script="mini-symbol-overview" config={tv.miniSymbol(sym)} />
              </div>
            ))}
          </div>
        </>
      )}
      <p className="mt-2 text-[10px] text-slate-600">FRED values are the latest official observations (monthly/quarterly series lag). Hover a tile for how NEXUS derived it.</p>
    </GlassCard>
  );
}
