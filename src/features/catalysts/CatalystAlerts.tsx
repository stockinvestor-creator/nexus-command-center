import { Link } from 'react-router-dom';
import { ClickRow } from '@/components/ui/ClickRow';
import { Zap } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { TickerChip } from '@/components/ui/TickerChip';
import { useLiveTable } from '@/hooks/useLiveTable';
import { daysUntil, fmtDate } from '@/lib/format';
import { BIAS_META } from './api';

export function CatalystAlerts({ className }: { className?: string }) {
  const { rows, loading } = useLiveTable('catalysts', { order: { column: 'catalyst_date', ascending: true } });
  const upcoming = rows
    .filter((c) => (c.status === 'upcoming' || c.status === 'active') && (daysUntil(c.catalyst_date) ?? 999) >= -1)
    .slice(0, 7);
  return (
    <GlassCard
      collapseId="cat-alerts"
      className={className}
      title="Catalyst Alerts"
      icon={<Zap />}
      actions={
        <Link to="/catalysts" className="text-[11px] text-neon-cyan hover:underline">
          Feed
        </Link>
      }
    >
      {loading ? (
        <SkeletonRows rows={4} />
      ) : upcoming.length === 0 ? (
        <EmptyState icon={<Zap />} title="No upcoming catalysts" body="Log earnings, FDA dates, filings and contracts in the Catalyst Feed." />
      ) : (
        <ul className="space-y-1.5">
          {upcoming.map((c) => {
            const d = daysUntil(c.catalyst_date);
            return (
              <li key={c.id}>
                <ClickRow to={`/catalysts?focus=${c.id}`} className="flex items-start gap-2.5 rounded-xl border border-white/[0.04] bg-white/[0.015] p-2.5 transition hover:border-neon-cyan/20">
                  <div className="flex w-11 shrink-0 flex-col items-center rounded-lg border border-white/5 bg-black/20 py-1">
                    <span className="num text-sm font-semibold text-white">{d == null ? '—' : d <= 0 ? 'NOW' : d}</span>
                    <span className="font-mono text-[8px] uppercase text-slate-500">{d != null && d > 0 ? 'days' : ''}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TickerChip symbol={c.symbol} />
                      <Badge tone="violet">{c.catalyst_type}</Badge>
                      <Badge tone={BIAS_META[c.bias].tone}>{BIAS_META[c.bias].label}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-slate-300">{c.headline}</p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {fmtDate(c.catalyst_date)} · conf {c.confidence}%{c.expected_move != null ? ` · ±${c.expected_move}%` : ''}
                    </p>
                  </div>
                </ClickRow>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
