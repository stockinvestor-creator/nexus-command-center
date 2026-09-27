import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Slider, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useQuote } from '@/hooks/useMarket';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { fmtPrice, isoDay } from '@/lib/format';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { attempt, toast } from '@/store/toastStore';
import { PREDICTION_DIRECTIONS, PREDICTION_TYPES, type Prediction, type PredictionDirection, type PredictionLinkType, type PredictionType } from '@/types/db';
import { createPrediction, DIRECTION_LABEL, editPrediction, TYPE_LABEL } from './api';

export interface PredictionPrefill {
  symbol?: string;
  title?: string;
  type?: PredictionType;
  catalyst?: string;
  link?: { link_type: PredictionLinkType; ref_id: string; label?: string | null; url?: string | null };
}

/** Create (or edit while OPEN) a USER PREDICTION. Confidence is the author's own number — not a probability model. */
export function PredictionForm({ open, onClose, prefill, editing }: { open: boolean; onClose: () => void; prefill?: PredictionPrefill; editing?: Prediction }) {
  const e = editing;
  const [symbol, setSymbol] = useState(e?.symbol ?? prefill?.symbol ?? '');
  const [title, setTitle] = useState(e?.title ?? prefill?.title ?? '');
  const [type, setType] = useState<PredictionType>(e?.prediction_type ?? prefill?.type ?? 'direction');
  const [direction, setDirection] = useState<PredictionDirection>(e?.direction ?? 'bullish');
  const [expected, setExpected] = useState(e?.expected_move?.toString() ?? '');
  const [target, setTarget] = useState(e?.target_price?.toString() ?? '');
  const [downside, setDownside] = useState(e?.downside_price?.toString() ?? '');
  const [horizon, setHorizon] = useState(e?.time_horizon ?? '');
  const [catalyst, setCatalyst] = useState(e?.catalyst ?? prefill?.catalyst ?? '');
  const [predDate, setPredDate] = useState(e?.prediction_date ?? isoDay(0));
  const [resDate, setResDate] = useState(e?.resolution_date ?? isoDay(30));
  const [confidence, setConfidence] = useState(e?.confidence ?? 60);
  const [thesis, setThesis] = useState(e?.thesis ?? '');
  const [invalidation, setInvalidation] = useState(e?.invalidation ?? '');
  const [notes, setNotes] = useState(e?.notes ?? '');
  const [tradeId, setTradeId] = useState('');
  const [busy, setBusy] = useState(false);
  const uid = useAuth((s) => s.user?.id);
  const trades = useLiveTable(open && !e ? 'trade_ideas' : null, { order: { column: 'updated_at', ascending: false }, limit: 40 });
  const sym = normalizeSymbol(symbol);
  const quote = useQuote(!e && isValidSymbol(sym) ? sym : null);
  const n = (v: string) => (v.trim() === '' ? null : Number(v));

  const submit = async () => {
    if (!title.trim()) return toast.error('Give the prediction a title');
    if (symbol && !isValidSymbol(sym)) return toast.error('Invalid ticker');
    if (resDate && resDate < predDate) return toast.error('Resolution date must be after the prediction date');
    setBusy(true);
    const fields = {
      symbol: symbol ? sym : null,
      title: title.trim(),
      prediction_type: type,
      direction,
      expected_move: n(expected),
      target_price: n(target),
      downside_price: n(downside),
      time_horizon: horizon || null,
      catalyst: catalyst || null,
      prediction_date: predDate,
      resolution_date: resDate || null,
      confidence,
      thesis: thesis || null,
      invalidation: invalidation || null,
      notes: notes || null,
    };
    const links = [...(prefill?.link ? [prefill.link] : []), ...(tradeId ? [{ link_type: 'trade_idea' as const, ref_id: tradeId, label: trades.rows.find((t) => t.id === tradeId)?.symbol ?? null }] : []), ...(fields.symbol ? [{ link_type: 'research' as const, ref_id: fields.symbol, label: `${fields.symbol} research` }] : [])];
    const ok = await attempt(
      () =>
        e
          ? editPrediction(e.id, fields)
          : createPrediction(
              {
                ...fields,
                // baseline only from a VERIFIED quote; otherwise left empty
                baseline_price: quote.data?.price ?? null,
                baseline_source: quote.data ? `${quote.data.provenance.source} · ${quote.data.provenance.status}` : null,
                baseline_at: quote.data?.provenance.updatedAt ? new Date(quote.data.provenance.updatedAt).toISOString() : null,
              },
              links,
            ),
      'Could not save prediction',
    );
    setBusy(false);
    if (ok) {
      toast.success(e ? 'Prediction updated (change logged)' : 'Prediction logged');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={e ? 'Edit prediction (open only)' : 'New prediction'}
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" loading={busy} onClick={submit} disabled={Boolean(e && e.created_by !== uid)}>{e ? 'Save changes' : 'Log prediction'}</Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
        <Badge tone="violet">User prediction</Badge>
        {e ? 'Every edit is recorded in the history. Once resolved, core fields lock.' : 'The original is preserved; later edits are logged and resolution locks it.'}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2"><Input value={title} onChange={(ev) => setTitle(ev.target.value)} placeholder="MU beats and guides above consensus; stock +8% in a week" autoFocus /></Field>
        <Field label="Ticker (optional for macro)"><Input value={symbol} onChange={(ev) => setSymbol(ev.target.value.toUpperCase())} placeholder="MU" /></Field>
        <Field label="Type"><Select value={type} onChange={setType} options={PREDICTION_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} /></Field>
        <Field label="Direction"><Select value={direction} onChange={setDirection} options={PREDICTION_DIRECTIONS.map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))} /></Field>
        <Field label="Expected move (%)"><Input type="number" step="any" value={expected} onChange={(ev) => setExpected(ev.target.value)} placeholder="8" /></Field>
        <Field label="Target price"><Input type="number" step="any" value={target} onChange={(ev) => setTarget(ev.target.value)} /></Field>
        <Field label="Downside / invalidation price"><Input type="number" step="any" value={downside} onChange={(ev) => setDownside(ev.target.value)} /></Field>
        <Field label="Time horizon"><Input value={horizon} onChange={(ev) => setHorizon(ev.target.value)} placeholder="1 week after earnings" /></Field>
        <Field label="Catalyst"><Input value={catalyst} onChange={(ev) => setCatalyst(ev.target.value)} placeholder="Q3 earnings 9/24" /></Field>
        <Field label="Prediction date"><Input type="date" value={predDate} max={isoDay(0)} onChange={(ev) => setPredDate(ev.target.value)} disabled={Boolean(e)} /></Field>
        <Field label="Resolution date"><Input type="date" value={resDate} onChange={(ev) => setResDate(ev.target.value)} /></Field>
        <Field label={`Confidence: ${confidence}% (your own estimate — not a probability model)`} className="sm:col-span-2">
          <Slider value={confidence} onChange={setConfidence} min={0} max={100} step={5} />
        </Field>
        <Field label="Thesis" className="sm:col-span-2"><Textarea value={thesis} onChange={(ev) => setThesis(ev.target.value)} /></Field>
        <Field label="What would invalidate it?" className="sm:col-span-2"><Textarea value={invalidation} onChange={(ev) => setInvalidation(ev.target.value)} className="min-h-[56px]" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={notes} onChange={(ev) => setNotes(ev.target.value)} className="min-h-[56px]" /></Field>
        {!e && trades.rows.length > 0 && (
          <Field label="Link a trade idea (optional)">
            <Select value={tradeId} onChange={setTradeId} options={[{ value: '', label: '— none —' }, ...trades.rows.map((t) => ({ value: t.id, label: `${t.symbol} ${t.direction} · ${t.status}` }))]} />
          </Field>
        )}
        {!e && (
          <p className="text-[11px] text-slate-500 sm:col-span-2">
            Baseline price:{' '}
            {quote.data ? `${fmtPrice(quote.data.price)} from ${quote.data.provenance.source} (${quote.data.provenance.status.toLowerCase().replace('_', ' ')}) will be recorded.` : 'none — no verified quote provider, so automatic evaluation will not be available.'}
          </p>
        )}
      </div>
    </Modal>
  );
}
