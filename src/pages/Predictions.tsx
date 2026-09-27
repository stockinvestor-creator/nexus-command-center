import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarClock, Gauge, ListChecks, Plus, Target } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Field';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { PredictionForm } from '@/features/predictions/PredictionForm';
import { PredictionDetail } from '@/features/predictions/PredictionDetail';
import { PredictionRow } from '@/features/predictions/PredictionCard';
import { bandOf, bucket, CONF_BANDS, groupBy, sideOf, STATUS_META, TYPE_LABEL, type Bucket } from '@/features/predictions/api';
import { cn } from '@/lib/cn';
import { daysUntil, fmtPct } from '@/lib/format';
import { PREDICTION_STATUSES, type Prediction, type PredictionStatus, type PredictionType } from '@/types/db';

type Tab = 'timeline' | 'all' | 'scorecard' | 'calibration';

export default function Predictions() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'timeline';
  const openId = params.get('id');
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const [who, setWho] = useState<string>('all');
  const [creating, setCreating] = useState(params.get('new') === '1');
  const { rows, loading } = useLiveTable('predictions', { order: { column: 'created_at', ascending: false } });
  const list = useMemo(() => rows.filter((p) => who === 'all' || p.created_by === who), [rows, who]);
  const selected = rows.find((p) => p.id === openId);
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v == null) next.delete(k);
    else next.set(k, v);
    setParams(next);
  };

  return (
    <div>
      <PageHeader
        title="Prediction Tracker"
        subtitle="Log calls before the fact, resolve them honestly, learn from the scorecard. Was the thesis actually right?"
        actions={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>New prediction</Button>}
      />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={tab}
            onChange={(t) => setParam('tab', t)}
            options={[
              { value: 'timeline', label: 'Timeline' },
              { value: 'all', label: 'All predictions', count: list.length },
              { value: 'scorecard', label: 'Scorecard' },
              { value: 'calibration', label: 'Calibration' },
            ]}
          />
          <Select
            className="ml-auto w-40"
            value={who}
            onChange={setWho}
            options={[{ value: 'all', label: 'Both operators' }, ...profiles.map((p) => ({ value: p.id, label: p.id === me ? `${p.display_name} (me)` : p.display_name }))]}
          />
        </div>
        {loading ? (
          <SkeletonRows rows={6} />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Target />} title="No predictions yet" body="Log a call before the catalyst — direction, expected move, confidence and what would prove you wrong." action={<Button size="sm" variant="outline" onClick={() => setCreating(true)}>Log the first one</Button>} />
        ) : (
          <>
            {tab === 'timeline' && <Timeline list={list} open={(id) => setParam('id', id)} />}
            {tab === 'all' && <AllList list={list} open={(id) => setParam('id', id)} />}
            {tab === 'scorecard' && <Scorecard list={list} />}
            {tab === 'calibration' && <Calibration list={list} />}
          </>
        )}
      </div>
      {creating && (
        <PredictionForm
          open
          onClose={() => { setCreating(false); setParam('new', null); }}
          prefill={{ symbol: params.get('symbol') ?? undefined, title: params.get('title') ?? undefined, type: (params.get('type') as PredictionType) ?? undefined, catalyst: params.get('catalyst') ?? undefined, link: params.get('link_url') ? { link_type: (params.get('link_type') as 'news' | 'filing' | 'event') ?? 'event', ref_id: params.get('link_ref') ?? params.get('link_url')!, url: params.get('link_url'), label: params.get('link_label') } : undefined }}
        />
      )}
      {selected && <PredictionDetail key={selected.id} p={selected} onClose={() => setParam('id', null)} />}
    </div>
  );
}

function Column({ title, icon, list, open, empty }: { title: string; icon: React.ReactNode; list: Prediction[]; open: (id: string) => void; empty: string }) {
  return (
    <GlassCard title={`${title} (${list.length})`} icon={icon}>
      {list.length ? <div className="space-y-2">{list.map((p) => <PredictionRow key={p.id} p={p} onOpen={() => open(p.id)} />)}</div> : <p className="text-xs text-slate-600">{empty}</p>}
    </GlassCard>
  );
}

function Timeline({ list, open }: { list: Prediction[]; open: (id: string) => void }) {
  const openList = list.filter((p) => p.status === 'open');
  const pastDue = openList.filter((p) => p.resolution_date && (daysUntil(p.resolution_date) ?? 0) < 0);
  const upcoming = openList.filter((p) => p.resolution_date && (daysUntil(p.resolution_date) ?? -1) >= 0 && (daysUntil(p.resolution_date) ?? 99) <= 14).sort((a, b) => (a.resolution_date ?? '').localeCompare(b.resolution_date ?? ''));
  const rest = openList.filter((p) => !pastDue.includes(p) && !upcoming.includes(p));
  const recent = list.filter((p) => p.status !== 'open' && p.resolved_at && Date.now() - Date.parse(p.resolved_at) < 30 * 86400_000).sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''));
  const expired = list.filter((p) => p.status === 'expired');
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Column title="Past due — needs resolution" icon={<CalendarClock />} list={pastDue} open={open} empty="Nothing past due." />
      <Column title="Resolving in the next 14 days" icon={<CalendarClock />} list={upcoming} open={open} empty="Nothing due soon." />
      <Column title="Other open predictions" icon={<Target />} list={rest} open={open} empty="No other open predictions." />
      <Column title="Recently resolved (30 days)" icon={<ListChecks />} list={recent} open={open} empty="Nothing resolved recently." />
      {expired.length > 0 && <Column title="Expired" icon={<ListChecks />} list={expired.slice(0, 10)} open={open} empty="" />}
    </div>
  );
}

function AllList({ list, open }: { list: Prediction[]; open: (id: string) => void }) {
  const [status, setStatus] = useState<PredictionStatus | 'all'>('all');
  const shown = list.filter((p) => status === 'all' || p.status === status);
  return (
    <div className="space-y-2">
      <Tabs value={status} onChange={setStatus} size="xs" options={[{ value: 'all', label: 'All' }, ...PREDICTION_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: list.filter((p) => p.status === s).length }))]} />
      <div className="grid gap-2 lg:grid-cols-2">{shown.map((p) => <PredictionRow key={p.id} p={p} onOpen={() => open(p.id)} />)}</div>
    </div>
  );
}

const pct = (v: number | null) => (v == null ? '—' : `${v.toFixed(0)}%`);

function BucketTable({ title, rows }: { title: string; rows: Bucket[] }) {
  return (
    <GlassCard title={title} icon={<BarChart3 />}>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-600">No scored predictions yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead className="font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <tr><th className="py-1 text-left">Group</th><th className="text-right">n</th><th className="text-right">Correct</th><th className="text-right">Partial</th><th className="text-right">Incorrect</th><th className="text-right">Accuracy</th><th className="text-right">Avg conf.</th></tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.key} className="border-t border-white/[0.04]">
                <td className="py-1.5 text-slate-300">{b.key}</td>
                <td className="text-right font-mono text-slate-400">{b.n}</td>
                <td className="text-right font-mono text-bull">{b.correct}</td>
                <td className="text-right font-mono text-amber-300">{b.partial}</td>
                <td className="text-right font-mono text-bear">{b.incorrect}</td>
                <td className={cn('text-right font-mono', b.n < 5 ? 'text-slate-500' : 'text-slate-100')} title={b.n < 5 ? 'Fewer than 5 scored predictions' : undefined}>{pct(b.accuracy)}{b.n < 5 ? '*' : ''}</td>
                <td className="text-right font-mono text-slate-400">{pct(b.avgConfidence)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </GlassCard>
  );
}

function Scorecard({ list }: { list: Prediction[] }) {
  const all = bucket('All', list);
  const byStatus = PREDICTION_STATUSES.map((s) => [s, list.filter((p) => p.status === s).length] as const);
  const moves = list.filter((p) => p.expected_move != null && p.actual_move != null && p.status !== 'open');
  const avgExp = moves.length ? moves.reduce((s, p) => s + Math.abs(p.expected_move!), 0) / moves.length : null;
  const avgAct = moves.length ? moves.reduce((s, p) => s + Math.abs(p.actual_move!), 0) / moves.length : null;
  const avgConfAll = list.length ? list.reduce((s, p) => s + p.confidence, 0) / list.length : null;
  return (
    <div className="space-y-3">
      <GlassCard title="Scorecard" icon={<Gauge />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Tile label="Total predictions" value={String(list.length)} />
          <Tile label="Scored (correct/partial/incorrect)" value={String(all.n)} />
          <Tile label="Accuracy" value={pct(all.accuracy)} hint={`correct ÷ scored, n = ${all.n}`} />
          <Tile label="Avg confidence (all)" value={pct(avgConfAll)} hint={`n = ${list.length}`} />
          <Tile label="Avg |expected| vs |actual| move" value={avgExp == null ? '—' : `${fmtPct(avgExp, false)} vs ${fmtPct(avgAct, false)}`} hint={`n = ${moves.length} with both values`} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {byStatus.map(([s, n]) => <Badge key={s} tone={STATUS_META[s].tone}>{STATUS_META[s].label} {n}</Badge>)}
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Invalidated and expired predictions are excluded from accuracy and shown separately. Partial is never counted as correct. Groups with fewer than 5 scored predictions are marked *. These are descriptive counts of your own history — no statistical significance is implied.
        </p>
      </GlassCard>
      <div className="grid gap-3 lg:grid-cols-2">
        <BucketTable title="By confidence band" rows={CONF_BANDS.map(([lo, hi]) => bucket(`${lo}–${hi}%`, list.filter((p) => bandOf(p.confidence) === `${lo}–${hi}`))).filter((b) => b.n > 0)} />
        <BucketTable title="By prediction type" rows={groupBy(list, (p) => TYPE_LABEL[p.prediction_type])} />
        <BucketTable title="By long / short" rows={groupBy(list, sideOf)} />
        <BucketTable title="By catalyst" rows={groupBy(list, (p) => p.catalyst?.trim().slice(0, 40) || null).slice(0, 12)} />
        <BucketTable title="By ticker" rows={groupBy(list, (p) => p.symbol).slice(0, 15)} />
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-0.5 font-mono text-base text-slate-100">{value}</p>
      {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
    </div>
  );
}

function Calibration({ list }: { list: Prediction[] }) {
  const rows = CONF_BANDS.map(([lo, hi]) => ({ lo, hi, b: bucket(`${lo}–${hi}%`, list.filter((p) => p.confidence >= lo && p.confidence <= hi)) }));
  return (
    <GlassCard title="Calibration" icon={<Gauge />} badge={<Badge tone="violet">User confidence vs. outcomes</Badge>}>
      <p className="mb-4 text-xs text-slate-400">
        For each confidence band: the average confidence you stated vs. how often those calls were scored correct. A well-calibrated forecaster's 70% calls come true about 70% of the time. Confidence is your own input — NEXUS does not generate probabilities.
      </p>
      <div className="space-y-3">
        {rows.map(({ lo, hi, b }) => (
          <div key={lo}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-mono text-slate-300">{lo}–{hi}%</span>
              <span className="font-mono text-slate-500">n = {b.n}{b.n > 0 && b.n < 5 ? ' (small sample)' : ''}</span>
            </div>
            <div className="relative h-5 rounded bg-white/[0.04]">
              {b.avgConfidence != null && <div className="absolute inset-y-0 left-0 rounded bg-violet-400/25" style={{ width: `${b.avgConfidence}%` }} title={`Stated: ${b.avgConfidence.toFixed(0)}%`} />}
              {b.accuracy != null && <div className="absolute inset-y-1 left-0 rounded bg-neon-cyan/70" style={{ width: `${b.accuracy}%` }} title={`Hit rate: ${b.accuracy.toFixed(0)}%`} />}
              {b.n === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-600">no scored predictions</span>}
            </div>
            {b.n > 0 && <p className="mt-0.5 text-[10px] text-slate-500">stated {pct(b.avgConfidence)} · hit rate {pct(b.accuracy)}</p>}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-violet-400/40" /> Avg stated confidence</span>
        <span className="flex items-center gap-1"><span className="h-2 w-4 rounded bg-neon-cyan/70" /> Actual hit rate</span>
      </div>
    </GlassCard>
  );
}
