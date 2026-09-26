import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useSettings } from '@/store/settingsStore';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { TradingViewBadge } from '@/components/ui/DataSource';

/**
 * Ticker tape across the top: the official TradingView ticker-tape widget only.
 * If TradingView can't load, an explicit unavailable strip is shown. No local prices, ever.
 */
export function TickerTape() {
  const enabled = useSettings((s) => s.widgets.tickerTape);
  const [failed, setFailed] = useState(false);
  if (!enabled) return null;
  return (
    <div className="relative z-20 shrink-0 overflow-hidden border-b border-white/[0.05] bg-void-900/60 backdrop-blur-md">
      {failed ? (
        <div className="flex h-9 items-center gap-2 px-4 text-xs text-slate-400">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          Market data temporarily unavailable. The TradingView ticker tape could not load.
        </div>
      ) : (
        <div className="relative h-[46px]">
          <div className="pointer-events-none absolute left-0 top-0 z-10 hidden h-full items-center bg-gradient-to-r from-void-900 via-void-900/90 to-transparent pl-3 pr-6 sm:flex">
            <TradingViewBadge />
          </div>
          <TradingViewWidget script="ticker-tape" config={tv.tickerTape()} lazy={false} onError={() => setFailed(true)} />
        </div>
      )}
    </div>
  );
}
