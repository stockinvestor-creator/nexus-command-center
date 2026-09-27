import { Link } from 'react-router-dom';
import { AlertOctagon, Sparkles } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { TickerChip } from '@/components/ui/TickerChip';
import { SkeletonRows } from '@/components/ui/States';
import { fmtDateTime } from '@/lib/format';
import { snapshotOf, useMyBriefings } from './useBriefing';

/** TODAY'S BRIEFING — compact read-only summary of today's stored snapshot. */
export function BriefingWidget({ className }: { className?: string }) {
  const b = useMyBriefings('morning');
  const snap = snapshotOf(b.today);
  return (
    <GlassCard className={className} collapseId="dash-briefing" title="Today's briefing" icon={<Sparkles />} actions={<Link to="/briefing" className="text-[11px] text-neon-cyan hover:underline">Open</Link>}>
      {b.loading ? (
        <SkeletonRows rows={3} />
      ) : !snap ? (
        <p className="text-xs text-slate-500">
          Not generated yet today. <Link to="/briefing" className="text-neon-cyan hover:underline">Generate it →</Link>
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              ['Priority', snap.highPriority.length],
              ['Filings', snap.filings.length],
              ['News', snap.news.length],
              ['Econ', snap.economic.filter((r) => r.date === snap.date).length],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg border border-white/5 bg-white/[0.02] py-1.5">
                <p className="font-mono text-base text-slate-100">{v}</p>
                <p className="text-[10px] text-slate-500">{l}</p>
              </div>
            ))}
          </div>
          <ul className="mt-2 space-y-1">
            {snap.highPriority.slice(0, 4).map((h) => (
              <li key={h.id} className="flex items-center gap-1.5 text-xs">
                <AlertOctagon className={h.level === 'critical' ? 'h-3 w-3 text-rose-400' : 'h-3 w-3 text-amber-400'} />
                {h.symbol && <TickerChip symbol={h.symbol} />}
                <span className="min-w-0 flex-1 truncate text-slate-300" title={`Rule: ${h.rule}`}>{h.title}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-slate-600">
            Generated {fmtDateTime(snap.generatedAt)} {snap.changes.newHighPriority.length > 0 && <Badge tone="amber">{snap.changes.newHighPriority.length} new</Badge>}
          </p>
        </>
      )}
    </GlassCard>
  );
}
