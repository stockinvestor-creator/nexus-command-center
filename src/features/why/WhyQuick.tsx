import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '@/components/ui/GlassCard';
import { useWhy } from '@/store/whyStore';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { useMyTickers } from '@/features/intel/useMyTickers';
import { cn } from '@/lib/cn';

/** Compact "ticker → Why?" input (used where rows are TradingView iframes, e.g. Market Movers). */
export function WhyQuickInput({ className, placeholder = 'Ticker' }: { className?: string; placeholder?: string }) {
  const [v, setV] = useState('');
  const open = useWhy((s) => s.open);
  const submit = () => {
    const s = normalizeSymbol(v);
    if (isValidSymbol(s)) {
      open(s);
      setV('');
    }
  };
  return (
    <form
      className={cn('flex items-center gap-1', className)}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder={placeholder} aria-label="Ticker for Why is it moving" className="h-7 w-20 rounded-md border border-white/10 bg-black/30 px-2 font-mono text-[11px] text-white outline-none focus:border-violet-400/50" />
      <button type="submit" className="inline-flex h-7 items-center gap-1 rounded-md border border-violet-400/30 bg-violet-400/10 px-2 font-mono text-[10px] font-semibold uppercase text-violet-200 hover:bg-violet-400/20">
        <HelpCircle className="h-3 w-3" /> Why?
      </button>
    </form>
  );
}

/** Command Center widget: WHY IS IT MOVING? */
export function WhyWidget({ className }: { className?: string }) {
  const { tickers } = useMyTickers();
  const open = useWhy((s) => s.open);
  return (
    <GlassCard className={className} collapseId="dash-why" title="Why is it moving?" icon={<HelpCircle />} actions={<Link to="/why" className="text-[11px] text-neon-cyan hover:underline">Open</Link>}>
      <WhyQuickInput placeholder="NVDA" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {tickers.slice(0, 12).map((t) => (
          <button key={t} onClick={() => open(t)} className="rounded-md border border-white/10 px-2 py-1 font-mono text-[11px] text-slate-300 hover:border-violet-400/40 hover:text-violet-200">
            {t}
          </button>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-slate-600">Sourced evidence only: company filings, tagged news, dated catalysts. No invented narratives.</p>
    </GlassCard>
  );
}
