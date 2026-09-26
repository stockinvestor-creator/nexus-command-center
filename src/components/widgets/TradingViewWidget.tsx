import { memo, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Skeleton } from '@/components/ui/States';

export type TVScript =
  | 'ticker-tape'
  | 'stock-heatmap'
  | 'market-overview'
  | 'market-quotes'
  | 'screener'
  | 'symbol-info'
  | 'symbol-profile'
  | 'events'
  | 'timeline'
  | 'advanced-chart'
  | 'hotlists'
  | 'mini-symbol-overview';

interface Props {
  script: TVScript;
  config: Record<string, unknown>;
  className?: string;
  /** Load only when near the viewport (default true) */
  lazy?: boolean;
  /** Tear the widget down when it scrolls far away (used for charts inside chat) */
  unloadOffscreen?: boolean;
  /** Text shown if TradingView can't load */
  failureText?: string;
  onError?: () => void;
}

const LOAD_TIMEOUT_MS = 20_000;

/**
 * Official TradingView embed. The widget renders TradingView's own data inside its iframe;
 * NEXUS never reads, stores or substitutes that data. If TradingView can't load we show an
 * explicit "temporarily unavailable" state — never locally generated numbers.
 */
function TradingViewWidgetInner({ script, config, className, lazy = true, unloadOffscreen = false, failureText = 'Market data temporarily unavailable', onError }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!lazy);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const cfg = JSON.stringify(config);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // visibility management
  useEffect(() => {
    if (!lazy || !outer.current) return;
    const el = outer.current;
    const enter = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '250px' });
    enter.observe(el);
    let leave: IntersectionObserver | null = null;
    if (unloadOffscreen) {
      leave = new IntersectionObserver((es) => es.every((e) => !e.isIntersecting) && setNear(false), { rootMargin: '900px' });
      leave.observe(el);
    }
    return () => {
      enter.disconnect();
      leave?.disconnect();
    };
  }, [lazy, unloadOffscreen]);

  // mount / unmount the official embed
  useEffect(() => {
    const el = host.current;
    if (!near || !el) return;
    setLoaded(false);
    setFailed(false);
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
    let done = false;
    const fail = () => {
      if (done) return;
      done = true;
      setFailed(true);
      setLoaded(true);
      onErrorRef.current?.();
    };
    s.onload = () => {
      // the script injects an iframe; consider it loaded once that exists
      const check = () => {
        if (done) return;
        if (el.querySelector('iframe')) {
          done = true;
          window.setTimeout(() => setLoaded(true), 300);
        } else window.setTimeout(check, 250);
      };
      check();
    };
    s.onerror = fail;
    const timeout = window.setTimeout(() => {
      if (!el.querySelector('iframe')) fail();
    }, LOAD_TIMEOUT_MS);
    container.appendChild(s);
    el.appendChild(container);
    return () => {
      done = true;
      window.clearTimeout(timeout);
      el.innerHTML = '';
    };
  }, [near, script, cfg]);

  return (
    <div ref={outer} className={cn('relative h-full w-full', className)} data-tv-script={script} data-tv-symbol={String(config.symbol ?? '')}>
      {near && !loaded && <Skeleton className="absolute inset-0" />}
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-4 text-center">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <p className="text-xs text-slate-300">{failureText}</p>
          <p className="text-[10px] text-slate-500">TradingView could not be reached (offline or blocked by a browser extension).</p>
        </div>
      )}
      <div ref={host} className={cn('tv-embed h-full w-full transition-opacity duration-500', loaded && !failed ? 'opacity-100' : 'opacity-0')} />
    </div>
  );
}

export const TradingViewWidget = memo(TradingViewWidgetInner);

const base = { colorTheme: 'dark', isTransparent: true, locale: 'en' } as const;

/** Ticker-tape instruments (exchange-qualified). */
export const TAPE_SYMBOLS: { proName: string; title: string }[] = [
  { proName: 'AMEX:SPY', title: 'SPY' },
  { proName: 'NASDAQ:QQQ', title: 'QQQ' },
  { proName: 'AMEX:DIA', title: 'DIA' },
  { proName: 'AMEX:IWM', title: 'IWM' },
  { proName: 'NASDAQ:AAPL', title: 'AAPL' },
  { proName: 'NASDAQ:NVDA', title: 'NVDA' },
  { proName: 'NASDAQ:MSFT', title: 'MSFT' },
  { proName: 'NASDAQ:AMZN', title: 'AMZN' },
  { proName: 'NASDAQ:META', title: 'META' },
  { proName: 'NASDAQ:GOOGL', title: 'GOOGL' },
  { proName: 'NASDAQ:TSLA', title: 'TSLA' },
  { proName: 'NASDAQ:AMD', title: 'AMD' },
  { proName: 'NASDAQ:MU', title: 'MU' },
  { proName: 'NASDAQ:AVGO', title: 'AVGO' },
  { proName: 'NASDAQ:PLTR', title: 'PLTR' },
];

export type ScreenerPreset = 'top_gainers' | 'top_losers' | 'volume_leaders' | 'unusual_volume' | 'new_52_week_high' | 'new_52_week_low' | 'most_capitalized' | 'general';
export type HeatmapSource = 'SPX500' | 'NASDAQ100' | 'DJDJI' | 'AllUSA';

export const tv = {
  tickerTape: () => ({ ...base, symbols: TAPE_SYMBOLS, showSymbolLogo: true, displayMode: 'adaptive' }),
  heatmap: (dataSource: HeatmapSource = 'SPX500') => ({
    ...base,
    exchanges: [],
    dataSource,
    grouping: 'sector',
    blockSize: 'market_cap_basic',
    blockColor: 'change',
    hasTopBar: true,
    isDataSetEnabled: true,
    isZoomEnabled: true,
    hasSymbolTooltip: true,
    isMonoSize: false,
    width: '100%',
    height: '100%',
  }),
  /** TradingView Stock Screener with a preset view (US market). */
  screener: (defaultScreen: ScreenerPreset, defaultColumn: 'overview' | 'performance' | 'oscillators' | 'moving_averages' = 'overview', showToolbar = true) => ({
    ...base,
    width: '100%',
    height: '100%',
    market: 'america',
    defaultScreen,
    defaultColumn,
    showToolbar,
  }),
  marketOverview: () => ({
    ...base,
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
    belowLineFillColorGrowing: 'rgba(34, 211, 238, 0.12)',
    belowLineFillColorFalling: 'rgba(244, 63, 94, 0.12)',
    belowLineFillColorGrowingBottom: 'rgba(34, 211, 238, 0)',
    belowLineFillColorFallingBottom: 'rgba(244, 63, 94, 0)',
    symbolActiveColor: 'rgba(34, 211, 238, 0.12)',
    tabs: [
      {
        title: 'US index ETFs',
        symbols: [{ s: 'AMEX:SPY', d: 'S&P 500 (SPY)' }, { s: 'NASDAQ:QQQ', d: 'Nasdaq 100 (QQQ)' }, { s: 'AMEX:DIA', d: 'Dow 30 (DIA)' }, { s: 'AMEX:IWM', d: 'Russell 2000 (IWM)' }],
      },
      {
        title: 'Mega caps',
        symbols: [{ s: 'NASDAQ:NVDA' }, { s: 'NASDAQ:AAPL' }, { s: 'NASDAQ:MSFT' }, { s: 'NASDAQ:AMZN' }, { s: 'NASDAQ:META' }, { s: 'NASDAQ:GOOGL' }, { s: 'NASDAQ:TSLA' }],
      },
      {
        title: 'Sectors',
        symbols: [{ s: 'AMEX:XLK', d: 'Technology' }, { s: 'AMEX:XLF', d: 'Financials' }, { s: 'AMEX:XLE', d: 'Energy' }, { s: 'AMEX:XLV', d: 'Health care' }, { s: 'AMEX:XLI', d: 'Industrials' }, { s: 'AMEX:XLY', d: 'Consumer disc.' }],
      },
    ],
  }),
  /** Quotes table for an arbitrary list of symbols (used for watchlists). */
  marketQuotes: (title: string, symbols: { name: string; displayName: string }[]) => ({
    ...base,
    width: '100%',
    height: '100%',
    showSymbolLogo: true,
    symbolsGroups: [{ name: title, symbols }],
  }),
  symbolInfo: (symbol: string) => ({ ...base, symbol, width: '100%' }),
  symbolProfile: (symbol: string) => ({ ...base, symbol, width: '100%', height: '100%' }),
  miniSymbol: (symbol: string) => ({ ...base, symbol, width: '100%', height: '100%', dateRange: '3M', trendLineColor: 'rgba(34, 211, 238, 1)', underLineColor: 'rgba(34, 211, 238, 0.15)', underLineBottomColor: 'rgba(34, 211, 238, 0)' }),
  economicCalendar: () => ({ ...base, width: '100%', height: '100%', importanceFilter: '0,1', countryFilter: 'us' }),
  topStories: () => ({ ...base, feedMode: 'market', market: 'stock', displayMode: 'regular', width: '100%', height: '100%' }),
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
  /**
   * Full interactive TradingView chart: candles/line (style menu), intervals, volume,
   * crosshair, zoom/pan, drawing toolbar, fullscreen. `compact` hides the side toolbar (chat).
   */
  advancedChart: (symbol: string, opts: { interval?: string; compact?: boolean; allowSymbolChange?: boolean } = {}) => ({
    ...base,
    autosize: true,
    symbol,
    interval: opts.interval ?? 'D',
    timezone: 'America/New_York',
    theme: 'dark',
    style: '1',
    backgroundColor: 'rgba(7, 8, 13, 0)',
    gridColor: 'rgba(148, 163, 184, 0.06)',
    hide_top_toolbar: false,
    hide_side_toolbar: opts.compact ?? false,
    hide_legend: false,
    hide_volume: false,
    withdateranges: !opts.compact,
    allow_symbol_change: opts.allowSymbolChange ?? false,
    save_image: false,
    calendar: false,
    details: false,
    support_host: 'https://www.tradingview.com',
  }),
};
