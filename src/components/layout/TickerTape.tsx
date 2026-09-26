import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '@/store/settingsStore';
import { useQuote } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { fmtPct, fmtPrice, trendClass } from '@/lib/format';

const DEMO_TAPE = ['SPY', 'QQQ', 'DIA', 'IWM', 'NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD', 'MU', 'META', 'AMZN', 'PLTR', 'COIN'];
// networked free providers: keep the tape tiny to protect the daily API budget
const NET_TAPE = ['SPY', 'QQQ', 'DIA', 'IWM'];

const TapeItem = memo(function TapeItem({ symbol }: { symbol: string }) {
  const { data } = useQuote(symbol);
  return (
    <Link to={`/stock/${symbol}`} className="flex shrink-0 items-center gap-2 px-4 font-mono text-[11px] hover:bg-white/[0.03]">
      <span className="font-semibold text-slate-200">{symbol}</span>
      <span className="text-slate-400">{fmtPrice(data?.price)}</span>
      <span className={trendClass(data?.changePercent)}>{fmtPct(data?.changePercent)}</span>
    </Link>
  );
});

function CustomTape() {
  const provider = marketData();
  const symbols = provider.usesNetwork ? NET_TAPE : DEMO_TAPE;
  const items = [...symbols, ...symbols];
  return (
    <div className="relative flex h-9 items-center overflow-hidden">
      <div className="z-10 flex h-full items-center bg-void-900 pl-3 pr-2">
        <FreshnessBadge freshness={provider.freshness} />
      </div>
      <div className="flex animate-marquee whitespace-nowrap hover:[animation-play-state:paused]">
        {items.map((s, i) => (
          <TapeItem key={`${s}-${i}`} symbol={s} />
        ))}
      </div>
    </div>
  );
}

/** Ticker tape across the top: TradingView widget (if enabled) or our own provider-driven tape. */
export function TickerTape() {
  const widgetOn = useSettings((s) => s.widgets.tickerTape);
  const [failed, setFailed] = useState(false);
  const useWidget = widgetOn && !failed;
  return (
    <div className="relative z-20 shrink-0 overflow-hidden border-b border-white/[0.05] bg-void-900/60 backdrop-blur-md">
      {useWidget ? (
        <div className="relative h-[46px]">
          <div className="absolute left-0 top-0 z-10 flex h-full items-center bg-gradient-to-r from-void-900 via-void-900/90 to-transparent pl-3 pr-6">
            <FreshnessBadge freshness="DELAYED" note="TradingView ticker tape: real-time or delayed per exchange" />
          </div>
          <TradingViewWidget script="ticker-tape" config={tv.tickerTape()} lazy={false} onError={() => setFailed(true)} />
        </div>
      ) : (
        <CustomTape />
      )}
    </div>
  );
}
