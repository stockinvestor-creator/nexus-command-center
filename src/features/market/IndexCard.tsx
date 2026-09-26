import { memo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCandles, useQuote } from '@/hooks/useMarket';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { Sparkline } from '@/components/charts/Sparkline';
import { Skeleton } from '@/components/ui/States';
import { fmtChange, fmtCompact, fmtPct, fmtPrice, trendClass } from '@/lib/format';
import { cn } from '@/lib/cn';

function IndexCardInner({ symbol, label, proxy }: { symbol: string; label: string; proxy: string }) {
  const q = useQuote(symbol);
  const c = useCandles(symbol, '1M');
  const quote = q.data;
  const up = (quote?.changePercent ?? 0) >= 0;
  return (
    <Link to={`/stock/${symbol}`} className="block">
      <motion.div
        whileHover={{ y: -3 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={cn(
          'glass glow-border relative overflow-hidden p-4',
          'before:pointer-events-none after:pointer-events-none after:absolute after:-right-10 after:-top-10 after:h-32 after:w-32 after:rounded-full after:blur-3xl',
          up ? 'after:bg-emerald-500/10' : 'after:bg-rose-500/10',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold tracking-wide text-white">{label}</span>
          <FreshnessBadge freshness={quote?.freshness ?? 'DEMO'} stale={false} asOf={quote?.asOf} />
          <span className="ml-auto font-mono text-[10px] text-slate-500" title="Index levels require paid licences; we show the ETF that tracks it.">
            {proxy}
          </span>
        </div>
        {q.loading && !quote ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : q.error && !quote ? (
          <p className="mt-3 text-xs text-amber-400">{q.error.message}</p>
        ) : (
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <AnimatedNumber value={quote?.price} format={fmtPrice} className="text-2xl font-semibold text-white" />
              <div className={cn('num mt-0.5 text-xs', trendClass(quote?.changePercent))}>
                {fmtChange(quote?.change)} ({fmtPct(quote?.changePercent)})
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">Vol {fmtCompact(quote?.volume)}</div>
            </div>
            <Sparkline values={(c.data?.candles ?? []).map((x) => x.close)} width={120} height={44} />
          </div>
        )}
      </motion.div>
    </Link>
  );
}

export const IndexCard = memo(IndexCardInner);
