import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LastPriceAnimationMode,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type MouseEventParams,
  type SeriesType,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AreaChart,
  BellPlus,
  Camera,
  CandlestickChart,
  LineChart,
  Maximize2,
  Minimize2,
  RotateCcw,
  Star,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useBars, useQuote } from '@/hooks/useMarket';
import { TIMEFRAMES, type Candle, type Timeframe } from '@/types/market';
import { cn } from '@/lib/cn';
import { fmtCompact, fmtPct, fmtPrice, trendClass } from '@/lib/format';
import { DataSourceBadge, MarketUnavailable, STATUS_LABEL } from '@/components/ui/DataSource';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { IconButton } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/States';

export type ChartType = 'candles' | 'line' | 'area';

export interface StockChartProps {
  symbol: string;
  company?: string;
  initialTimeframe?: Timeframe;
  className?: string;
  /** Price levels to draw as dashed alert lines */
  alertLevels?: number[];
  watchlisted?: boolean;
  onToggleWatchlist?: () => void;
  onPriceAlert?: (lastPrice: number | null) => void;
  compactHeader?: boolean;
}

const UP = '#22c55e';
const DOWN = '#f43f5e';
const CYAN = '#22d3ee';

const etTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
const etDay = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
const etFull = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' });
const etFullTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

interface Hover {
  candle: Candle;
  x: number;
  y: number;
}

function StockChartInner({
  symbol,
  company,
  initialTimeframe = '3M',
  className,
  alertLevels = [],
  watchlisted,
  onToggleWatchlist,
  onPriceAlert,
  compactHeader,
}: StockChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
  const [type, setType] = useState<ChartType>('candles');
  const [full, setFull] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pulse, setPulse] = useState<{ x: number; y: number } | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const linesRef = useRef<IPriceLine[]>([]);
  const byTime = useRef(new Map<number, Candle>());

  const candlesQ = useBars(symbol, timeframe);
  const quoteQ = useQuote(symbol);
  const series = candlesQ.data;
  const candles = useMemo(() => series?.bars ?? [], [series]);
  const intraday = series?.intraday ?? false;

  /* ───── create chart once ───── */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(148, 197, 214, 0.75)',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 10,
        attributionLogo: true, // TradingView attribution required by the Lightweight Charts license
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.04)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(34, 211, 238, 0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0e7490' },
        horzLine: { color: 'rgba(34, 211, 238, 0.35)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#0e7490' },
      },
      rightPriceScale: { borderColor: 'rgba(148, 163, 184, 0.08)', scaleMargins: { top: 0.12, bottom: 0.22 } },
      timeScale: { borderColor: 'rgba(148, 163, 184, 0.08)', rightOffset: 4, minBarSpacing: 1.5 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      localization: { priceFormatter: (p: number) => (p < 1 ? p.toFixed(4) : p.toFixed(2)) },
    });
    chartRef.current = chart;

    const vol = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volRef.current = vol;

    const onMove = (param: MouseEventParams<Time>) => {
      if (!param.point || param.time == null) {
        setHover(null);
        return;
      }
      const c = byTime.current.get(param.time as number);
      if (c) setHover({ candle: c, x: param.point.x, y: param.point.y });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      mainRef.current = null;
      volRef.current = null;
      linesRef.current = [];
    };
  }, []);

  /* ───── time axis formatting (always US/Eastern) ───── */
  useEffect(() => {
    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: intraday,
        secondsVisible: false,
        tickMarkFormatter: (t: Time) => {
          const d = new Date((t as number) * 1000);
          return intraday && timeframe === '1D' ? etTime.format(d) : etDay.format(d);
        },
      },
      localization: {
        timeFormatter: (t: Time) => {
          const d = new Date((t as number) * 1000);
          return intraday ? `${etFullTime.format(d)} ET` : etFull.format(d);
        },
      },
    });
  }, [intraday, timeframe]);

  /* ───── main series by type ───── */
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (mainRef.current) {
      chart.removeSeries(mainRef.current);
      mainRef.current = null;
      linesRef.current = [];
    }
    if (type === 'candles') {
      mainRef.current = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        borderUpColor: UP,
        borderDownColor: DOWN,
        wickUpColor: 'rgba(34,197,94,0.7)',
        wickDownColor: 'rgba(244,63,94,0.7)',
        priceLineColor: CYAN,
        priceLineStyle: LineStyle.Dotted,
      });
    } else if (type === 'line') {
      mainRef.current = chart.addSeries(LineSeries, {
        color: CYAN,
        lineWidth: 2,
        priceLineColor: CYAN,
        priceLineStyle: LineStyle.Dotted,
        lastPriceAnimation: LastPriceAnimationMode.Continuous,
        crosshairMarkerBorderColor: CYAN,
        crosshairMarkerBackgroundColor: '#05060a',
      });
    } else {
      mainRef.current = chart.addSeries(AreaSeries, {
        lineColor: CYAN,
        topColor: 'rgba(34, 211, 238, 0.35)',
        bottomColor: 'rgba(139, 92, 246, 0.02)',
        lineWidth: 2,
        priceLineColor: CYAN,
        priceLineStyle: LineStyle.Dotted,
        lastPriceAnimation: LastPriceAnimationMode.Continuous,
      });
    }
  }, [type]);

  /* ───── pulsing last-price marker position ───── */
  const updatePulse = useCallback(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const last = candles[candles.length - 1];
    if (!chart || !main || !last) return setPulse(null);
    const x = chart.timeScale().timeToCoordinate(last.time as UTCTimestamp);
    const y = main.priceToCoordinate(last.close);
    setPulse(x == null || y == null ? null : { x, y });
  }, [candles]);

  /* ───── data ───── */
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current;
    const vol = volRef.current;
    if (!chart || !main || !vol) return;
    byTime.current = new Map(candles.map((c) => [c.time, c]));
    if (type === 'candles') {
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })));
    } else {
      main.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
    }
    vol.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? 'rgba(34,197,94,0.28)' : 'rgba(244,63,94,0.28)',
      })),
    );
    chart.timeScale().fitContent();
    requestAnimationFrame(updatePulse);
  }, [candles, type, updatePulse]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    ts.subscribeVisibleLogicalRangeChange(updatePulse);
    ts.subscribeSizeChange(updatePulse);
    return () => {
      ts.unsubscribeVisibleLogicalRangeChange(updatePulse);
      ts.unsubscribeSizeChange(updatePulse);
    };
  }, [updatePulse]);

  /* ───── alert price lines ───── */
  const alertKey = alertLevels.join(',');
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    linesRef.current.forEach((l) => main.removePriceLine(l));
    linesRef.current = alertLevels.map((price) =>
      main.createPriceLine({
        price,
        color: '#fbbf24',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'ALERT',
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertKey, type]);

  /* ───── fullscreen escape ───── */
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFull(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [full]);

  /* ───── toolbar actions ───── */
  const zoom = (factor: number) => {
    const ts = chartRef.current?.timeScale();
    const r = ts?.getVisibleLogicalRange();
    if (!ts || !r) return;
    const span = r.to - r.from;
    const center = r.to - span / 2;
    const next = Math.max(5, span * factor);
    ts.setVisibleLogicalRange({ from: center - next / 2, to: center + next / 2 });
  };
  const reset = () => {
    chartRef.current?.timeScale().fitContent();
    chartRef.current?.priceScale('right').applyOptions({ autoScale: true });
  };
  const screenshot = () => {
    const chart = chartRef.current;
    if (!chart) return;
    const canvas = chart.takeScreenshot();
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height + 36;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#07080d';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, 0, 36);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 16px "JetBrains Mono", monospace';
    ctx.fillText(`${symbol} · ${timeframe} · ${series ? `${series.provenance.source} ${STATUS_LABEL[series.provenance.status]}` : ''}`, 12, 24);
    ctx.fillStyle = '#64748b';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(`Exported ${new Date().toLocaleString()} · Charts by TradingView Lightweight Charts`, 260, 24);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${symbol}-${timeframe}-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }, 'image/png');
  };

  const first = candles[0];
  const last = candles[candles.length - 1];
  const rangeChange = first && last ? ((last.close - first.open) / first.open) * 100 : null;
  const quote = quoteQ.data;
  const price = quote?.price ?? last?.close ?? null;
  const provenance = series?.provenance ?? quote?.provenance ?? null;

  const TypeBtn = ({ t, icon, label }: { t: ChartType; icon: ReactNode; label: string }) => (
    <IconButton label={label} active={type === t} onClick={() => setType(t)}>
      {icon}
    </IconButton>
  );

  return (
    <div
      ref={wrapRef}
      className={cn(
        'glass glow-border flex flex-col overflow-hidden',
        full ? 'fixed inset-0 z-[70] rounded-none bg-void-900/95 backdrop-blur-2xl' : 'h-full min-h-[380px]',
        className,
      )}
    >
      {/* header */}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-white/[0.05] px-4 pb-3 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-wide text-white">{symbol}</span>
            {provenance && <DataSourceBadge provenance={provenance} />}
          </div>
          {!compactHeader && company && <p className="truncate text-xs text-slate-500">{company}</p>}
        </div>
        <div className="flex items-baseline gap-3">
          <AnimatedNumber value={price} format={fmtPrice} className="text-2xl font-semibold text-white [text-shadow:0_0_24px_rgba(34,211,238,0.35)]" />
          {quote && (
            <span className={cn('num text-sm', trendClass(quote.changePercent))}>
              {quote.change > 0 ? '+' : ''}
              {quote.change.toFixed(2)} ({fmtPct(quote.changePercent)})
            </span>
          )}
          {rangeChange != null && (
            <span className="hidden font-mono text-[11px] text-slate-500 sm:inline">
              {timeframe}: <span className={trendClass(rangeChange)}>{fmtPct(rangeChange)}</span>
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          {onToggleWatchlist && (
            <IconButton label={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'} active={watchlisted} onClick={onToggleWatchlist}>
              <Star className={cn('h-4 w-4', watchlisted && 'fill-current')} />
            </IconButton>
          )}
          {onPriceAlert && (
            <IconButton label="Set price alert" onClick={() => onPriceAlert(price)}>
              <BellPlus className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton label="Export PNG" onClick={screenshot}>
            <Camera className="h-4 w-4" />
          </IconButton>
          <IconButton label={full ? 'Exit fullscreen' : 'Fullscreen'} onClick={() => setFull((f) => !f)}>
            {full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </IconButton>
        </div>
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/20 p-0.5">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                'rounded-lg px-2 py-1 font-mono text-[11px] transition',
                tf === timeframe ? 'bg-neon-cyan/15 text-neon-cyan shadow-glow' : 'text-slate-400 hover:text-white',
              )}
            >
              {tf}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-black/20 p-0.5">
          <TypeBtn t="candles" label="Candlesticks" icon={<CandlestickChart className="h-4 w-4" />} />
          <TypeBtn t="line" label="Line" icon={<LineChart className="h-4 w-4" />} />
          <TypeBtn t="area" label="Area" icon={<AreaChart className="h-4 w-4" />} />
        </div>
        <div className="ml-auto flex items-center gap-0.5">
          <IconButton label="Zoom in" onClick={() => zoom(0.7)}>
            <ZoomIn className="h-4 w-4" />
          </IconButton>
          <IconButton label="Zoom out" onClick={() => zoom(1.4)}>
            <ZoomOut className="h-4 w-4" />
          </IconButton>
          <IconButton label="Reset chart" onClick={reset}>
            <RotateCcw className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* chart surface */}
      <div className="relative min-h-[240px] flex-1">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.07),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-[64px] font-bold tracking-widest text-white/[0.025] sm:text-[110px]">
          {symbol}
        </div>
        <div ref={containerRef} className={cn('absolute inset-0 transition-opacity duration-300', candlesQ.loading && !series && 'opacity-0')} />

        {pulse && !hover && (
          <span className="pointer-events-none absolute z-10" style={{ left: pulse.x - 5, top: pulse.y - 5 }}>
            <span className="absolute h-2.5 w-2.5 animate-pulse-ring rounded-full bg-cyan-300" />
            <span className="absolute h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_2px_rgba(34,211,238,0.9)]" />
          </span>
        )}

        <AnimatePresence>
          {hover && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute left-3 top-2 z-20 rounded-xl border border-white/10 bg-void-900/85 px-3 py-2 font-mono text-[11px] backdrop-blur-md"
            >
              <div className="mb-1 text-slate-400">
                {intraday ? etFullTime.format(new Date(hover.candle.time * 1000)) + ' ET' : etFull.format(new Date(hover.candle.time * 1000))}
              </div>
              <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5">
                <span className="text-slate-500">O</span>
                <span className="text-slate-200">{fmtPrice(hover.candle.open)}</span>
                <span className="text-slate-500">H</span>
                <span className="text-slate-200">{fmtPrice(hover.candle.high)}</span>
                <span className="text-slate-500">L</span>
                <span className="text-slate-200">{fmtPrice(hover.candle.low)}</span>
                <span className="text-slate-500">C</span>
                <span className={hover.candle.close >= hover.candle.open ? 'text-bull' : 'text-bear'}>{fmtPrice(hover.candle.close)}</span>
                <span className="text-slate-500">Chg</span>
                <span className={trendClass(hover.candle.close - hover.candle.open)}>
                  {fmtPct(((hover.candle.close - hover.candle.open) / hover.candle.open) * 100)}
                </span>
                <span className="text-slate-500">Vol</span>
                <span className="text-slate-200">{fmtCompact(hover.candle.volume)}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {candlesQ.loading && !series && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </div>
        )}
        {candlesQ.error && !series && (
          <div className="absolute inset-0 flex items-center justify-center">
            <MarketUnavailable reason={candlesQ.reason} message={candlesQ.error.message} />
          </div>
        )}
        {series && candles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">No bars for this timeframe.</div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.04] px-4 py-1.5 font-mono text-[10px] text-slate-500">
        <span className="truncate">{series?.provenance.note ?? (intraday ? 'Times shown in US/Eastern' : 'Daily/weekly bars')}</span>
        <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noopener noreferrer" className="shrink-0 hover:text-slate-300">
          Charts by TradingView
        </a>
      </div>
    </div>
  );
}

export const StockChart = memo(StockChartInner);
