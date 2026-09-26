import { useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { TickerChip } from '@/components/ui/TickerChip';
import { marketData } from '@/services/market';
import { lookupUniverse } from '@/services/market/universe';
import type { StockShareMeta } from '@/types/db';

export function ShareStockModal({ open, onClose, onShare, initialSymbol }: { open: boolean; onClose: () => void; onShare: (meta: StockShareMeta, comment: string) => Promise<void>; initialSymbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol ?? '');
  const [company, setCompany] = useState<string | undefined>();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!symbol) return;
    setBusy(true);
    const p = marketData();
    const meta: StockShareMeta = { symbol, company: company ?? lookupUniverse(symbol)?.name };
    try {
      const [q, c] = await Promise.allSettled([p.getQuote(symbol), p.getCandles(symbol, '1M')]);
      if (q.status === 'fulfilled') {
        meta.price = q.value.price;
        meta.changePercent = q.value.changePercent;
        meta.freshness = q.value.freshness;
      }
      if (c.status === 'fulfilled') meta.spark = c.value.candles.map((x) => Math.round(x.close * 100) / 100).slice(-30);
      await onShare(meta, comment.trim());
      setSymbol('');
      setComment('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share a ticker"
      size="sm"
      footer={
        <Button variant="primary" onClick={share} loading={busy} disabled={!symbol} icon={<Send className="h-4 w-4" />}>
          Share to chat
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Ticker">
          {symbol ? (
            <div className="flex items-center gap-2">
              <TickerChip symbol={symbol} size="md" />
              <button onClick={() => setSymbol('')} className="text-xs text-slate-500 hover:text-white">
                change
              </button>
            </div>
          ) : (
            <SymbolSearch
              autoFocus
              onSelect={(m) => {
                setSymbol(m.symbol);
                setCompany(m.name === 'Open ticker directly' ? undefined : m.name);
              }}
            />
          )}
        </Field>
        <Field label="Your comment">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why are you sharing this?" rows={3} />
        </Field>
        <p className="text-[11px] text-slate-500">The card shows the current available price, today&apos;s move and a 1-month sparkline, with a button to open the full chart.</p>
      </div>
    </Modal>
  );
}
