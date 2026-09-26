import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Slider, Textarea } from '@/components/ui/Field';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { TickerChip } from '@/components/ui/TickerChip';
import { TRADE_STATUSES, type TradeDirection, type TradeIdea, type TradeStatus } from '@/types/db';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { parseNum } from '@/lib/format';
import { attempt, toast } from '@/store/toastStore';
import { createTrade, STATUS_META, updateTrade } from './api';

interface FormState {
  symbol: string;
  direction: TradeDirection;
  entry: string;
  position_size: string;
  thesis: string;
  catalyst: string;
  target: string;
  stop: string;
  downside: string;
  expected_move: string;
  probability: number;
  catalyst_date: string;
  time_horizon: string;
  status: TradeStatus;
  exit_price: string;
}

const empty = (symbol = ''): FormState => ({
  symbol,
  direction: 'long',
  entry: '',
  position_size: '',
  thesis: '',
  catalyst: '',
  target: '',
  stop: '',
  downside: '',
  expected_move: '',
  probability: 50,
  catalyst_date: '',
  time_horizon: '',
  status: 'watching',
  exit_price: '',
});

const fromTrade = (t: TradeIdea): FormState => ({
  symbol: t.symbol,
  direction: t.direction,
  entry: t.entry?.toString() ?? '',
  position_size: t.position_size?.toString() ?? '',
  thesis: t.thesis ?? '',
  catalyst: t.catalyst ?? '',
  target: t.target?.toString() ?? '',
  stop: t.stop?.toString() ?? '',
  downside: t.downside ?? '',
  expected_move: t.expected_move?.toString() ?? '',
  probability: t.probability ?? 50,
  catalyst_date: t.catalyst_date ?? '',
  time_horizon: t.time_horizon ?? '',
  status: t.status,
  exit_price: t.exit_price?.toString() ?? '',
});

export function TradeForm({ open, onClose, trade, defaultSymbol }: { open: boolean; onClose: () => void; trade?: TradeIdea | null; defaultSymbol?: string }) {
  const [f, setF] = useState<FormState>(empty(defaultSymbol));
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setF(trade ? fromTrade(trade) : empty(defaultSymbol));
  }, [open, trade, defaultSymbol]);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const symbol = normalizeSymbol(f.symbol);
    if (!isValidSymbol(symbol)) return toast.warning('Pick a valid ticker');
    const payload = {
      symbol,
      direction: f.direction,
      entry: parseNum(f.entry),
      position_size: parseNum(f.position_size),
      thesis: f.thesis.trim() || null,
      catalyst: f.catalyst.trim() || null,
      target: parseNum(f.target),
      stop: parseNum(f.stop),
      downside: f.downside.trim() || null,
      expected_move: parseNum(f.expected_move),
      probability: f.probability,
      catalyst_date: f.catalyst_date || null,
      time_horizon: f.time_horizon.trim() || null,
      status: f.status,
      exit_price: parseNum(f.exit_price),
    };
    setSaving(true);
    const ok = await attempt(() => (trade ? updateTrade(trade, payload) : createTrade(payload)), 'Could not save trade idea');
    setSaving(false);
    if (ok) {
      toast.success(trade ? 'Trade idea updated' : 'Trade idea posted to the War Room');
      onClose();
    }
  };

  const closedState = f.status === 'won' || f.status === 'lost' || f.status === 'closed';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={trade ? `Edit idea · $${trade.symbol}` : 'New trade idea'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save} icon={<Save className="h-4 w-4" />}>
            {trade ? 'Save changes' : 'Post idea'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticker">
          {f.symbol ? (
            <div className="flex items-center gap-2">
              <TickerChip symbol={normalizeSymbol(f.symbol)} size="md" />
              <button className="text-xs text-slate-500 hover:text-white" onClick={() => set('symbol', '')}>
                change
              </button>
            </div>
          ) : (
            <SymbolSearch onSelect={(m) => set('symbol', m.ticker)} placeholder="Search ticker…" />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Direction">
            <Select value={f.direction} onChange={(v) => set('direction', v)} options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} />
          </Field>
          <Field label="Status">
            <Select value={f.status} onChange={(v) => set('status', v)} options={TRADE_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <Field label="Proposed entry $">
            <Input inputMode="decimal" value={f.entry} onChange={(e) => set('entry', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Target $">
            <Input inputMode="decimal" value={f.target} onChange={(e) => set('target', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Stop $">
            <Input inputMode="decimal" value={f.stop} onChange={(e) => set('stop', e.target.value)} placeholder="0.00" />
          </Field>
          <Field label="Position size (shares)">
            <Input inputMode="decimal" value={f.position_size} onChange={(e) => set('position_size', e.target.value)} placeholder="100" />
          </Field>
          <Field label="Expected move % (user estimate)">
            <Input inputMode="decimal" value={f.expected_move} onChange={(e) => set('expected_move', e.target.value)} placeholder="8" />
          </Field>
          <Field label="Catalyst date">
            <Input type="date" value={f.catalyst_date} onChange={(e) => set('catalyst_date', e.target.value)} />
          </Field>
        </div>
        <Field label={`Probability (user estimate) · ${f.probability}%`}>
          <Slider value={f.probability} onChange={(v) => set('probability', v)} />
        </Field>
        <Field label="Time horizon">
          <Input value={f.time_horizon} onChange={(e) => set('time_horizon', e.target.value)} placeholder="e.g. 2–4 weeks, into earnings" />
        </Field>
        <Field label="Catalyst" className="sm:col-span-2">
          <Input value={f.catalyst} onChange={(e) => set('catalyst', e.target.value)} placeholder="What makes it move?" />
        </Field>
        <Field label="Thesis" className="sm:col-span-2">
          <Textarea value={f.thesis} onChange={(e) => set('thesis', e.target.value)} placeholder="Why this trade, why now…" rows={4} />
        </Field>
        <Field label="Downside scenario" className="sm:col-span-2">
          <Textarea value={f.downside} onChange={(e) => set('downside', e.target.value)} placeholder="What invalidates it? What's the damage?" rows={2} />
        </Field>
        {closedState && (
          <Field label="Exit price $" hint="Used for realized P&L">
            <Input inputMode="decimal" value={f.exit_price} onChange={(e) => set('exit_price', e.target.value)} />
          </Field>
        )}
      </div>
    </Modal>
  );
}
