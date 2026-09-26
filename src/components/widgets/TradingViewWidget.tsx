import { memo, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/States';

export type TVScript =
  | 'ticker-tape'
  | 'stock-heatmap'
  | 'market-overview'
  | 'symbol-info'
  | 'events'
  | 'timeline'
  | 'advanced-chart'
  | 'hotlists'
  | 'mini-symbol-overview';

interface Props {
  script: TVScript;
  config: Record<string, unknown>;
  className?: string;
  /** Load only when scrolled into view (default true) */
  lazy?: boolean;
  /** Called if the TradingView script can't load (offline, ad-blocker, network policy) */
  onError?: () => void;
}

/**
 * Official TradingView embed (free). We only embed it — its data is never extracted or reused.
 * Widgets load lazily when they enter the viewport.
 */
function TradingViewWidgetInner({ script, config, className, lazy = true, onError }: Props) {
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(!lazy);
  const [loaded, setLoaded] = useState(false);
  const cfg = JSON.stringify(config);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (inView || !host.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(host.current);
    return () => io.disconnect();
  }, [inView]);

  useEffect(() => {
    const el = host.current;
    if (!inView || !el) return;
    setLoaded(false);
    el.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    container.appendChild(widget);
    const s = document.createElement('script');
    s.src = `https://s3.tradingview.com/external-embedding/embed-widget-${script}.js`;
    s.async = true;
    s.type = 'text/javascript';
    s.innerHTML = cfg;
    s.onload = () => window.setTimeout(() => setLoaded(true), 400);
    s.onerror = () => {
      setLoaded(true);
      setFailed(true);
      onErrorRef.current?.();
    };
    container.appendChild(s);
    el.appendChild(container);
    return () => {
      el.innerHTML = '';
    };
  }, [inView, script, cfg]);

  return (
    <div className={cn('relative h-full w-full', className)}>
      {!loaded && <Skeleton className="absolute inset-0" />}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-slate-500">
          TradingView couldn&apos;t load (offline or blocked by an extension).
        </div>
      )}
      <div ref={host} className={cn('tv-embed h-full w-full transition-opacity duration-500', loaded ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetInner);

const base = { colorTheme: 'dark', isTransparent: true, locale: 'en' };

/** Presets for each free widget */
export const tv = {
  tickerTape: () => ({
    ...base,
    symbols: [
      { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
      { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
      { proName: 'FOREXCOM:DJI', title: 'Dow 30' },
      { proName: 'AMEX:IWM', title: 'Russell 2000' },
      { proName: 'TVC:VIX', title: 'VIX' },
      { proName: 'NASDAQ:NVDA', title: 'NVDA' },
      { proName: 'NASDAQ:AAPL', title: 'AAPL' },
      { proName: 'NASDAQ:TSLA', title: 'TSLA' },
      { proName: 'NASDAQ:MU', title: 'MU' },
      { proName: 'BITSTAMP:BTCUSD', title: 'BTC' },
      { proName: 'TVC:US10Y', title: 'US10Y' },
      { proName: 'TVC:USOIL', title: 'Crude' },
    ],
    showSymbolLogo: true,
    displayMode: 'adaptive',
  }),
  heatmap: () => ({
    ...base,
    exchanges: [],
    dataSource: 'SPX500',
    grouping: 'sector',
    blockSize: 'market_cap_basic',
    blockColor: 'change',
    hasTopBar: false,
    isDataSetEnabled: false,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    width: '100%',
    height: '100%',
  }),
  marketOverview: () => ({
    ...base,
    dateRange: '1D',
    showChart: true,
    width: '100%',
    height: '100%',
    largeChartUrl: '',
    showSymbolLogo: true,
    showFloatingTooltip: true,
    plotLineColorGrowing: 'rgba(34, 211, 238, 1)',
    plotLineColorFalling: 'rgba(244, 63, 94, 1)',
    gridLineColor: 'rgba(148, 163, 184, 0.06)',
    scaleFontColor: 'rgba(148, 163, 184, 0.8)',
    belowLineFillColorGrowing: 'rgba(34, 211, 238, 0.12)',
    belowLineFillColorFalling: 'rgba(244, 63, 94, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(34, 211, 238, 0)',
    belowLineFillColorFallingBottom: 'rgba(244, 63, 94, 0)',
    symbolActiveColor: 'rgba(34, 211, 238, 0.12)',
    tabs: [
      {
        title: 'Indices',
        symbols: [
          { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' },
          { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
          { s: 'FOREXCOM:DJI', d: 'Dow 30' },
          { s: 'AMEX:IWM', d: 'Russell 2000 ETF' },
        ],
      },
      {
        title: 'Mega caps',
        symbols: [
          { s: 'NASDAQ:NVDA' },
          { s: 'NASDAQ:AAPL' },
          { s: 'NASDAQ:MSFT' },
          { s: 'NASDAQ:AMZN' },
          { s: 'NASDAQ:META' },
          { s: 'NASDAQ:GOOGL' },
        ],
      },
      {
        title: 'Macro',
        symbols: [{ s: 'TVC:VIX' }, { s: 'TVC:US10Y' }, { s: 'TVC:DXY' }, { s: 'TVC:USOIL' }, { s: 'TVC:GOLD' }, { s: 'BITSTAMP:BTCUSD' }],
      },
    ],
  }),
  symbolInfo: (symbol: string) => ({ ...base, symbol, width: '100%' }),
  economicCalendar: () => ({ ...base, width: '100%', height: '100%', importanceFilter: '0,1', countryFilter: 'us' }),
  topStories: () => ({ ...base, feedMode: 'market', market: 'stock', displayMode: 'regular', width: '100%', height: '100%' }),
  advancedChart: (symbol: string) => ({
    ...base,
    autosize: true,
    symbol,
    interval: 'D',
    timezone: 'America/New_York',
    theme: 'dark',
    style: '1',
    backgroundColor: 'rgba(0,0,0,0)',
    gridColor: 'rgba(148, 163, 184, 0.06)',
    hide_side_toolbar: false,
    allow_symbol_change: true,
    support_host: 'https://www.tradingview.com',
  }),
  hotlists: () => ({
    ...base,
    exchange: 'US',
    dateRange: '1D',
    showChart: true,
    width: '100%',
    height: '100%',
    showSymbolLogo: true,
    showFloatingTooltip: true,
    plotLineColorGrowing: 'rgba(34, 211, 238, 1)',
    plotLineColorFalling: 'rgba(244, 63, 94, 1)',
    gridLineColor: 'rgba(148, 163, 184, 0.06)',
    scaleFontColor: 'rgba(148, 163, 184, 0.8)',
    symbolActiveColor: 'rgba(34, 211, 238, 0.12)',
  }),
};
