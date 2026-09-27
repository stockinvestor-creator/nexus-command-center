import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { useQuote } from '@/hooks/useMarket';
import { fmtPrice, isoDay } from '@/lib/format';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { attempt, toast } from '@/store/toastStore';
import type { SimDirection } from '@/types/db';
import { openPosition } from './api';

export function PositionForm({ open, onClose, initialSymbol = '', tradeIdeaId }: { open: boolean; onClose: () => void; initialSymbol?: string; tradeIdeaId?: string | null }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [direction, setDirection] = useState<SimDirection>('long');
  const [shares, setShares] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(isoDay(0));
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const [thesis, setThesis] = useState('');
  const [catalyst, setCatalyst] = useState('');
  const [busy, setBusy] = useState(false);
  const sym = normalizeSymbol(symbol);
  const quote = useQuote(isValidSymbol(sym) ? sym : null);
  const num = (v: string) => (v.trim() === '' ? null : Number(v));

  const submit = async () => {
    const s = num(shares);
    const p = num(price);
    if (!isValidSymbol(sym)) return toast.error('Enter a valid ticker');
    if (!s || s <= 0 || !p || p <= 0) return toast.error('Shares and entry price must be positive');
    setBusy(true);
    const r = await attempt(() => openPosition({ symbol: sym, direction, shares: s, price: p, entryDate: date, target: num(target), stop: num(stop), thesis, catalyst, tradeIdeaId }), 'Could not open position');
    setBusy(false);
    if (r) {
      toast.success(`Simulated ${direction} ${sym} opened`);
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New simulated position"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" loading={busy} onClick={submit}>Open position</Button>
        </>
      }
    >
      <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[11px] text-amber-200">SIMULATED PORTFOLIO — no brokerage connection, no real money. Entry price is what you enter.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ticker"><Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="NVDA" autoFocus /></Field>
        <Field label="Direction"><Select value={direction} onChange={setDirection} options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} /></Field>
        <Field label="Shares"><Input type="number" min="0" step="any" value={shares} onChange={(e) => setShares(e.target.value)} /></Field>
        <Field
          label="Entry price"
          hint={
            quote.data ? (
              <button type="button" className="text-neon-cyan hover:underline" onClick={() => setPrice(String(quote.data!.price))}>
                Use {quote.data.provenance.source} quote {fmtPrice(quote.data.price)} ({quote.data.provenance.status.toLowerCase().replace('_', ' ')})
              </button>
            ) : (
              'Type your fill price (no verified quote provider for auto-fill)'
            )
          }
        >
          <Input type="number" min="0" step="any" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field label="Entry date"><Input type="date" value={date} max={isoDay(0)} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Catalyst"><Input value={catalyst} onChange={(e) => setCatalyst(e.target.value)} placeholder="Earnings, FDA, contract…" /></Field>
        <Field label="Target (optional)"><Input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Stop (optional)"><Input type="number" step="any" value={stop} onChange={(e) => setStop(e.target.value)} /></Field>
        <Field label="Thesis" className="sm:col-span-2"><Textarea value={thesis} onChange={(e) => setThesis(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
