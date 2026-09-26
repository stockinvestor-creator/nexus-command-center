import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { cn } from '@/lib/cn';

/**
 * Official interactive TradingView chart for one exact symbol (e.g. "NASDAQ:NVDA").
 * Candles/bars/line (style menu), intervals incl. intraday, volume, crosshair, zoom/pan and
 * drawing tools are all provided by TradingView. `compact` is for chat cards.
 */
export function TradingViewChart({
  symbol,
  className,
  compact,
  interval = 'D',
  unloadOffscreen,
  expandable = true,
}: {
  symbol: string;
  className?: string;
  compact?: boolean;
  interval?: string;
  unloadOffscreen?: boolean;
  expandable?: boolean;
}) {
  const [full, setFull] = useState(false);
  return (
    <>
      <div className={cn('relative h-full w-full', className)}>
        <TradingViewWidget
          key={`${symbol}:${compact ? 'c' : 'f'}`}
          script="advanced-chart"
          config={tv.advancedChart(symbol, { interval, compact })}
          unloadOffscreen={unloadOffscreen}
          failureText="Chart temporarily unavailable"
        />
        {expandable && (
          <button
            onClick={() => setFull(true)}
            className="absolute bottom-2 right-2 z-10 inline-flex items-center gap-1 rounded-lg border border-white/10 bg-void-900/80 px-2 py-1 text-[11px] text-slate-300 backdrop-blur transition hover:border-neon-cyan/40 hover:text-neon-cyan"
            aria-label="Expand chart"
          >
            <Maximize2 className="h-3 w-3" /> Expand
          </button>
        )}
      </div>
      {full && (
        <Modal open={full} onClose={() => setFull(false)} title={symbol} size="xl">
          <div className="-mx-5 -my-4 h-[78dvh]">
            <TradingViewWidget script="advanced-chart" config={tv.advancedChart(symbol, { interval })} lazy={false} failureText="Chart temporarily unavailable" />
          </div>
        </Modal>
      )}
    </>
  );
}
