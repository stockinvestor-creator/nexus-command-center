import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useBars } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { attempt, toast } from '@/store/toastStore';
import { isoDay } from '@/lib/format';
import type { Prediction, PredictionStatus } from '@/types/db';
import { resolvePrediction, STATUS_META, suggestResolution } from './api';

type Final = Exclude<PredictionStatus, 'open'>;

export function ResolveModal({ p, onClose }: { p: Prediction; onClose: () => void }) {
  const [status, setStatus] = useState<Final>('correct');
  const [outcome, setOutcome] = useState('');
  const [move, setMove] = useState('');
  const [price, setPrice] = useState('');
  const [priceSource, setPriceSource] = useState<string | null>(null);
  const [date, setDate] = useState(isoDay(0));
  const [notes, setNotes] = useState('');
  const [lesson, setLesson] = useState('');
  const [busy, setBusy] = useState(false);
  const days = Math.ceil((Date.now() - Date.parse(p.prediction_date)) / 86400_000);
  const canBars = marketData().capabilities.bars && Boolean(p.symbol);
  const bars = useBars(canBars ? p.symbol : null, days <= 25 ? '1M' : days <= 80 ? '3M' : days <= 170 ? '6M' : '1Y');
  const suggestion = bars.data ? suggestResolution(p, bars.data.bars, bars.data.provenance.source) : null;

  const apply = () => {
    if (!suggestion) return;
    setStatus(suggestion.status);
    setPrice(suggestion.actualPrice.toFixed(2));
    setPriceSource(`${bars.data!.provenance.source} · ${bars.data!.provenance.status}`);
    if (suggestion.actualMove != null) setMove(suggestion.actualMove.toFixed(2));
    setOutcome((o) => o || suggestion.basis);
  };

  const submit = async () => {
    if (!outcome.trim()) return toast.error('Describe the actual outcome');
    setBusy(true);
    const ok = await attempt(
      () =>
        resolvePrediction(p, {
          status,
          actual_outcome: outcome.trim(),
          actual_move: move ? Number(move) : null,
          actual_price: price ? Number(price) : null,
          actual_price_source: price ? priceSource ?? 'Entered by user' : null,
          resolved_at: new Date(`${date}T12:00:00`).toISOString(),
          result_notes: notes || null,
          lesson: lesson || null,
        }),
      'Could not resolve',
    );
    setBusy(false);
    if (ok) {
      toast.success(`Resolved as ${STATUS_META[status].label} — prediction locked`);
      onClose();
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Resolve prediction"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" loading={busy} onClick={submit}>Resolve & lock</Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-300">{p.title}</p>
      {canBars && (
        <div className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2 text-xs">
          {bars.loading ? (
            <span className="text-slate-500">Checking provider bars…</span>
          ) : suggestion ? (
            <div className="flex flex-wrap items-center gap-2">
              <Wand2 className="h-3.5 w-3.5 text-neon-cyan" />
              <span className="text-slate-300">Suggested: <b>{STATUS_META[suggestion.status].label}</b></span>
              <span className="text-slate-500">— {suggestion.basis}</span>
              <Button size="xs" variant="outline" className="ml-auto" onClick={apply}>Use suggestion</Button>
            </div>
          ) : (
            <span className="text-slate-500">No automatic suggestion: {bars.error ? bars.error.message : 'this prediction type or the available bars cannot be checked objectively.'}</span>
          )}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Result">
          <Select value={status} onChange={setStatus} options={(['correct', 'partial', 'incorrect', 'invalidated', 'expired'] as Final[]).map((s) => ({ value: s, label: STATUS_META[s].label }))} />
        </Field>
        <Field label="Resolution date"><Input type="date" value={date} max={isoDay(0)} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Actual outcome" className="sm:col-span-2"><Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} className="min-h-[56px]" /></Field>
        <Field label="Actual move (%)"><Input type="number" step="any" value={move} onChange={(e) => setMove(e.target.value)} /></Field>
        <Field label="Actual price" hint={priceSource ? `Source: ${priceSource}` : price ? 'Entered by you' : undefined}>
          <Input type="number" step="any" value={price} onChange={(e) => { setPrice(e.target.value); setPriceSource(null); }} />
        </Field>
        <Field label="Resolution notes" className="sm:col-span-2"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[56px]" /></Field>
        <Field label="Lesson learned" className="sm:col-span-2"><Textarea value={lesson} onChange={(e) => setLesson(e.target.value)} className="min-h-[56px]" /></Field>
      </div>
    </Modal>
  );
}
