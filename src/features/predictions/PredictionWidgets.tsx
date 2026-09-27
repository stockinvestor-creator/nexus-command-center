import { Link } from 'react-router-dom';
import { ListChecks, Target } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { SkeletonRows } from '@/components/ui/States';
import { useLiveTable } from '@/hooks/useLiveTable';
import { PredictionRow } from './PredictionCard';

export function OpenPredictionsWidget({ className }: { className?: string }) {
  const { rows, loading } = useLiveTable('predictions', { eq: { status: 'open' }, order: { column: 'resolution_date', ascending: true } });
  return (
    <GlassCard className={className} collapseId="dash-open-preds" title={`Open predictions · ${rows.length}`} icon={<Target />} actions={<Link to="/predictions?new=1" className="text-[11px] text-neon-cyan hover:underline">New</Link>}>
      {loading ? <SkeletonRows rows={3} /> : rows.length === 0 ? <p className="text-xs text-slate-500">No open predictions.</p> : <div className="space-y-1.5">{rows.slice(0, 5).map((p) => <PredictionRow key={p.id} p={p} compact />)}</div>}
    </GlassCard>
  );
}

export function ResolvedPredictionsWidget({ className }: { className?: string }) {
  const { rows, loading } = useLiveTable('predictions', { order: { column: 'resolved_at', ascending: false } });
  const resolved = rows.filter((p) => p.status !== 'open' && p.resolved_at).slice(0, 5);
  return (
    <GlassCard className={className} collapseId="dash-resolved-preds" title="Recently resolved" icon={<ListChecks />} actions={<Link to="/predictions?tab=scorecard" className="text-[11px] text-neon-cyan hover:underline">Scorecard</Link>}>
      {loading ? <SkeletonRows rows={3} /> : resolved.length === 0 ? <p className="text-xs text-slate-500">Nothing resolved yet.</p> : <div className="space-y-1.5">{resolved.map((p) => <PredictionRow key={p.id} p={p} compact />)}</div>}
    </GlassCard>
  );
}
