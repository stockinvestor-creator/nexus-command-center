import { useState } from 'react';
import { BadgeCheck, CircleHelp, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Select, Textarea } from '@/components/ui/Field';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import type { ResolvedSymbol } from '@/types/market';
import type { StockShareMeta } from '@/types/db';

const INTERVALS = [
  { value: '5', label: '5 min' },
  { value: '15', label: '15 min' },
  { value: '60', label: '1 hour' },
  { value: 'D', label: '1 day' },
  { value: 'W', label: '1 week' },
];

/**
 * Share an interactive TradingView chart into chat. The message stores only the
 * TradingView symbol + display settings; the receiver's browser renders the official widget.
 */
export function ShareStockModal({
  open,
  onClose,
  onShare,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onShare: (meta: StockShareMeta, comment: string) => Promise<void>;
  initial?: ResolvedSymbol | null;
}) {
  const [sym, setSym] = useState<ResolvedSymbol | null>(initial ?? null);
  const [interval, setInterval] = useState('D');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!sym) return;
    setBusy(true);
    try {
      const meta: StockShareMeta = {
        symbol: sym.tvSymbol,
        ticker: sym.ticker,
        exchange: sym.exchange,
        provider: 'tradingview',
        sharedChart: true,
        interval,
        ...(sym.name ? { company: sym.name } : {}),
      };
      await onShare(meta, comment.trim());
      setSym(initial ?? null);
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
      title="Share a TradingView chart"
      size="md"
      footer={
        <Button variant="primary" onClick={share} loading={busy} disabled={!sym} icon={<Send className="h-4 w-4" />}>
          Share {sym ? sym.tvSymbol : 'chart'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Symbol" hint="Pick the exact TradingView symbol, e.g. NASDAQ:NVDA or NYSE:IBM.">
          {sym ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
              <span className="font-mono text-sm font-semibold text-neon-cyan">{sym.tvSymbol}</span>
              {sym.verified ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300">
                  <BadgeCheck className="h-3.5 w-3.5" /> exchange known
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                  <CircleHelp className="h-3.5 w-3.5" /> exchange not verified — TradingView will resolve
                </span>
              )}
              <span className="truncate text-xs text-slate-400">{sym.name}</span>
              <button onClick={() => setSym(null)} className="ml-auto text-xs text-slate-500 hover:text-white">
                change
              </button>
            </div>
          ) : (
            <SymbolSearch inline autoFocus onSelect={setSym} />
          )}
        </Field>
        {sym && (
          <>
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <Field label="Default interval">
                <Select value={interval} onChange={setInterval} options={INTERVALS} />
              </Field>
              <TradingViewBadge className="mb-2.5" />
            </div>
            <div className="h-[260px] overflow-hidden rounded-xl border border-white/10">
              <TradingViewChart symbol={sym.tvSymbol} interval={interval} compact expandable={false} />
            </div>
          </>
        )}
        <Field label="Your comment">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why are you sharing this?" rows={2} />
        </Field>
      </div>
    </Modal>
  );
}
