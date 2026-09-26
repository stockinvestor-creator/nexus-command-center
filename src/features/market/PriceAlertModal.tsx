import { useEffect, useState } from 'react';
import { BellRing, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import { fmtPrice, parseNum, timeAgo } from '@/lib/format';
import { attempt, toast } from '@/store/toastStore';
import { marketData } from '@/services/market';
import { createPriceAlert, deletePriceAlert, rearmPriceAlert } from './api';

export function usePriceAlerts(symbol: string) {
  const uid = useAuth((s) => s.user?.id);
  return useLiveTable(uid ? 'price_alerts' : null, {
    eq: { user_id: uid ?? '', symbol: symbol.toUpperCase() },
    order: { column: 'price' },
  });
}

export function PriceAlertModal({ symbol, open, onClose, lastPrice }: { symbol: string; open: boolean; onClose: () => void; lastPrice: number | null }) {
  const alerts = usePriceAlerts(symbol);
  const [condition, setCondition] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && lastPrice) setPrice((lastPrice * (condition === 'above' ? 1.05 : 0.95)).toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    const p = parseNum(price);
    if (!p || p <= 0) return toast.warning('Enter a valid price');
    setSaving(true);
    const row = await attempt(() => createPriceAlert(symbol, condition, p), 'Could not create alert');
    setSaving(false);
    if (row) {
      toast.success(`Alert set: $${symbol} ${condition} ${fmtPrice(p)}`);
      alerts.mutate((r) => (r.some((x) => x.id === row.id) ? r : [...r, row]));
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Price alerts · ${symbol}`} size="sm">
      <p className="mb-4 text-xs text-slate-400">
        Alerts are checked in your browser against the latest <b>available</b> price from {marketData().name} ({marketData().freshness}). With end-of-day data, alerts can only trigger after the close.
      </p>
      <div className="grid grid-cols-[1fr_1.2fr] gap-3">
        <Field label="Condition">
          <Select value={condition} onChange={setCondition} options={[{ value: 'above', label: 'Crosses above' }, { value: 'below', label: 'Crosses below' }]} />
        </Field>
        <Field label="Price" hint={lastPrice ? `Last: ${fmtPrice(lastPrice)}` : undefined}>
          <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
      </div>
      <Button className="mt-4 w-full" variant="primary" loading={saving} onClick={save} icon={<BellRing className="h-4 w-4" />}>
        Create alert
      </Button>
      <div className="mt-6">
        <p className="label mb-2">Your alerts for {symbol}</p>
        {alerts.rows.length === 0 ? (
          <p className="text-xs text-slate-500">None yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.rows.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
                <span className="text-slate-400">{a.condition}</span>
                <span className="num text-white">{fmtPrice(a.price)}</span>
                {a.active ? <Badge tone="cyan">Armed</Badge> : <Badge tone="amber">Triggered {a.triggered_at ? timeAgo(a.triggered_at) : ''}</Badge>}
                <div className="ml-auto flex gap-1">
                  {!a.active && (
                    <Button size="xs" variant="ghost" onClick={() => void attempt(() => rearmPriceAlert(a.id))}>
                      Re-arm
                    </Button>
                  )}
                  <button
                    onClick={() => {
                      alerts.mutate((r) => r.filter((x) => x.id !== a.id));
                      void attempt(() => deletePriceAlert(a.id));
                    }}
                    className="rounded p-1 text-slate-500 hover:text-rose-300"
                    aria-label="Delete alert"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}
