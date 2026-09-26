import { useId, useMemo } from 'react';
import { Gauge, BarChart3 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { SkeletonRows } from '@/components/ui/States';
import { useQuotes } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { INDEX_PROXIES, UNIVERSE } from '@/services/market/universe';
import { fmtPct } from '@/lib/format';
import { useMyWatchlist } from '@/features/watchlist/api';
import type { Quote } from '@/types/market';

/**
 * Breadth is computed ONLY from symbols we already track (no invented data):
 *  - DEMO provider: the full built-in directory (synthetic)
 *  - networked providers: index proxies + your watchlist (already cached → no extra API calls)
 */
export function useTrackedBreadth() {
  const provider = marketData();
  const { items } = useMyWatchlist();
  const symbols = useMemo(() => {
    const base = provider.usesNetwork ? [...INDEX_PROXIES.map((p) => p.symbol), ...items.rows.map((i) => i.symbol)] : UNIVERSE.map((u) => u.symbol);
    return [...new Set(base)];
  }, [provider.usesNetwork, items.rows]);
  const q = useQuotes(symbols);
  const stats = useMemo(() => {
    const quotes: Quote[] = Object.values(q.data ?? {});
    const adv = quotes.filter((x) => x.changePercent > 0.05).length;
    const dec = quotes.filter((x) => x.changePercent < -0.05).length;
    const flat = quotes.length - adv - dec;
    const avg = quotes.length ? quotes.reduce((s, x) => s + x.changePercent, 0) / quotes.length : 0;
    const strongUp = quotes.filter((x) => x.changePercent > 3).length;
    const strongDown = quotes.filter((x) => x.changePercent < -3).length;
    return { total: quotes.length, adv, dec, flat, avg, strongUp, strongDown };
  }, [q.data]);
  return { ...q, stats, freshness: provider.freshness };
}

export function BreadthPanel({ className }: { className?: string }) {
  const { stats, loading, data, freshness } = useTrackedBreadth();
  const pctAdv = stats.total ? (stats.adv / stats.total) * 100 : 0;
  const pctDec = stats.total ? (stats.dec / stats.total) * 100 : 0;
  return (
    <GlassCard collapseId="breadth" className={className} title="Market Breadth" icon={<BarChart3 />} badge={<FreshnessBadge freshness={freshness} />}>
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.6)] transition-all duration-700" style={{ width: `${pctAdv}%` }} />
            <div className="bg-slate-600/60 transition-all duration-700" style={{ width: `${100 - pctAdv - pctDec}%` }} />
            <div className="bg-gradient-to-r from-rose-400 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)] transition-all duration-700" style={{ width: `${pctDec}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { l: 'Advancing', v: stats.adv, c: 'text-bull' },
              { l: 'Unchanged', v: stats.flat, c: 'text-slate-300' },
              { l: 'Declining', v: stats.dec, c: 'text-bear' },
            ].map((x) => (
              <div key={x.l} className="rounded-xl border border-white/5 bg-white/[0.02] py-2">
                <div className={`num text-lg font-semibold ${x.c}`}>{x.v}</div>
                <div className="label">{x.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-slate-400">
            <span>
              &gt;+3%: <span className="text-bull">{stats.strongUp}</span>
            </span>
            <span>
              avg <span className={stats.avg >= 0 ? 'text-bull' : 'text-bear'}>{fmtPct(stats.avg)}</span>
            </span>
            <span>
              &lt;−3%: <span className="text-bear">{stats.strongDown}</span>
            </span>
          </div>
          <p className="mt-2 text-[10px] text-slate-600">Computed from {stats.total} tracked symbols, not the whole exchange.</p>
        </>
      )}
    </GlassCard>
  );
}

export function SentimentGauge({ className }: { className?: string }) {
  const gid = `sg-${useId().replace(/:/g, '')}`;
  const { stats, loading, data, freshness } = useTrackedBreadth();
  // score 0..100 from breadth ratio (60%) and average move (40%); purely descriptive
  const ratio = stats.adv + stats.dec ? stats.adv / (stats.adv + stats.dec) : 0.5;
  const moveScore = Math.max(0, Math.min(1, 0.5 + stats.avg / 4));
  const score = Math.round((ratio * 0.6 + moveScore * 0.4) * 100);
  const label = score >= 70 ? 'Risk-On' : score >= 55 ? 'Constructive' : score > 45 ? 'Neutral' : score > 30 ? 'Cautious' : 'Risk-Off';
  const angle = -90 + (score / 100) * 180;
  const color = score >= 55 ? '#22c55e' : score > 45 ? '#fbbf24' : '#f43f5e';
  return (
    <GlassCard collapseId="sentiment" className={className} title="Sentiment" icon={<Gauge />} badge={<FreshnessBadge freshness={freshness} />}>
      {loading && !data ? (
        <SkeletonRows rows={3} />
      ) : (
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 200 115" className="w-full max-w-[240px]">
            <defs>
              <linearGradient id={gid} x1="0" x2="1">
                <stop offset="0" stopColor="#f43f5e" />
                <stop offset="0.5" stopColor="#fbbf24" />
                <stop offset="1" stopColor="#22c55e" />
              </linearGradient>
            </defs>
            <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" strokeLinecap="round" />
            <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke={`url(#${gid})`} strokeWidth="14" strokeLinecap="round" opacity="0.85" />
            <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: '100px 100px', transition: 'transform 1s cubic-bezier(.2,.7,.2,1)' }}>
              <line x1="100" y1="100" x2="100" y2="32" stroke={color} strokeWidth="3" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
            </g>
            <circle cx="100" cy="100" r="7" fill="#0b0d14" stroke={color} strokeWidth="2" />
          </svg>
          <div className="-mt-1 text-center">
            <div className="num text-3xl font-bold" style={{ color, textShadow: `0 0 20px ${color}66` }}>
              {score}
            </div>
            <div className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{label}</div>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-600">Descriptive gauge of tracked-symbol breadth &amp; average move. Not a forecast.</p>
        </div>
      )}
    </GlassCard>
  );
}
