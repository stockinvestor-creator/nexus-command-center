import { Link } from 'react-router-dom';
import { CandlestickChart } from 'lucide-react';
import type { StockShareMeta } from '@/types/db';
import { useCandles, useQuote } from '@/hooks/useMarket';
import { Sparkline } from '@/components/charts/Sparkline';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { fmtPct, fmtPrice, trendClass } from '@/lib/format';
import { lookupUniverse } from '@/services/market/universe';

/** Rich ticker card inside chat. Shows the CURRENT available price, plus the price at share time. */
export function StockShareCard({ meta }: { meta: StockShareMeta }) {
  const { data: q } = useQuote(meta.symbol);
  const { data: c } = useCandles(meta.symbol, '1M');
  const spark = c?.candles.map((x) => x.close) ?? meta.spark ?? [];
  const company = meta.company ?? lookupUniverse(meta.symbol)?.name;
  return (
    <div className="glass glow-border mt-1.5 w-full max-w-sm overflow-hidden p-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-white">${meta.symbol}</span>
            {q && <FreshnessBadge freshness={q.freshness} asOf={q.asOf} />}
          </div>
          {company && <p className="truncate text-[11px] text-slate-500">{company}</p>}
        </div>
        <Sparkline values={spark} width={96} height={36} />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <AnimatedNumber value={q?.price ?? meta.price} format={fmtPrice} className="text-xl font-semibold text-white" />
        <span className={`num text-xs ${trendClass(q?.changePercent ?? meta.changePercent)}`}>{fmtPct(q?.changePercent ?? meta.changePercent)} today</span>
      </div>
      {meta.price != null && <p className="font-mono text-[10px] text-slate-500">At share: {fmtPrice(meta.price)} ({meta.freshness})</p>}
      <Link
        to={`/stock/${meta.symbol}`}
        className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 py-1.5 text-xs font-medium text-neon-cyan transition hover:bg-neon-cyan/20"
      >
        <CandlestickChart className="h-3.5 w-3.5" /> Open full chart
      </Link>
    </div>
  );
}
