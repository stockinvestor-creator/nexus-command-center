import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { WhyButton } from '@/features/why/WhyButton';
import { useLiveTable } from '@/hooks/useLiveTable';
import { intelView, intelKeys, useSecFilings } from '@/hooks/useIntel';
import { resolveSymbol } from '@/services/market/symbols';
import { eventTimeLabel } from '@/features/intel/time';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { fmtDate } from '@/lib/format';

const MAX = 4;

/**
 * Stock compare: TradingView renders every price/performance number (one chart overlaying the
 * symbols + a quotes table + per-symbol profile). NEXUS adds only your own notes and SEC filings.
 */
export default function Compare() {
  const [params, setParams] = useSearchParams();
  const symbols = useMemo(
    () => [...new Set((params.get('symbols') ?? '').split(',').map(normalizeSymbol).filter(isValidSymbol))].slice(0, MAX),
    [params],
  );
  const set = (list: string[]) => setParams(list.length ? { symbols: list.join(',') } : {});
  const resolved = symbols.map((s) => resolveSymbol(s) ?? { ticker: s, tvSymbol: s, exchange: null });
  const [main, ...rest] = resolved;
  const research = useLiveTable(symbols.length ? 'research_notes' : null, { in: { column: 'symbol', values: symbols } });
  const watch = useLiveTable(symbols.length ? 'watchlist_items' : null, { in: { column: 'symbol', values: symbols } });
  const filings = useSecFilings(symbols);
  const fv = intelView(filings, intelKeys.sec(symbols));

  const chartConfig = main
    ? {
        ...tv.advancedChart(main.tvSymbol, { interval: 'D' }),
        compareSymbols: rest.map((r) => ({ symbol: r.tvSymbol, position: 'SameScale' })),
        style: '2',
      }
    : null;

  return (
    <div>
      <PageHeader title="Compare" subtitle={`Up to ${MAX} tickers side by side. Prices and performance come from TradingView.`} />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {symbols.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-200">
              {s}
              <button onClick={() => set(symbols.filter((x) => x !== s))} aria-label={`Remove ${s}`} className="text-cyan-300/70 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {symbols.length < MAX && <SymbolSearch className="w-52" placeholder="Add ticker…" onSelect={(r) => set([...symbols, r.ticker])} />}
        </div>
        {!main ? (
          <GlassCard title="Pick tickers" icon={<GitCompare />}><p className="text-sm text-slate-500">Add two to four tickers to compare.</p></GlassCard>
        ) : (
          <>
            <GlassCard title="Relative performance" icon={<GitCompare />} badge={<TradingViewBadge />} bodyClassName="p-0">
              <div className="h-[460px]"><TradingViewWidget key={symbols.join(',')} script="advanced-chart" config={chartConfig!} /></div>
            </GlassCard>
            <GlassCard title="Quotes" icon={<GitCompare />} badge={<TradingViewBadge />} bodyClassName="p-0">
              <div className="h-[260px]">
                <TradingViewWidget key={`q-${symbols.join(',')}`} script="market-quotes" config={tv.marketQuotes('Compare', resolved.map((r) => ({ name: r.tvSymbol, displayName: r.ticker })))} />
              </div>
            </GlassCard>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))` }}>
              {resolved.map((r) => {
                const notes = research.rows.filter((n) => n.symbol === r.ticker);
                const w = watch.rows.find((x) => x.symbol === r.ticker);
                const last = fv.events.filter((e) => e.tickers.includes(r.ticker)).slice(0, 3);
                const bull = notes.find((n) => n.section === 'bull')?.content;
                const bear = notes.find((n) => n.section === 'bear')?.content;
                return (
                  <GlassCard key={r.ticker} title={r.ticker} actions={<WhyButton symbol={r.ticker} compact />}>
                    <div className="h-[280px] -mx-4 -mt-4 mb-3 border-b border-white/[0.05]">
                      <TradingViewWidget script="symbol-profile" config={tv.symbolProfile(r.tvSymbol)} />
                    </div>
                    <dl className="space-y-2 text-xs">
                      <div><dt className="text-slate-500">Your watchlist</dt><dd className="text-slate-300">{w ? `${w.category} · ${w.direction} · risk ${w.risk_level}${w.catalyst_date ? ` · catalyst ${fmtDate(w.catalyst_date)}` : ''}` : 'Not on a watchlist'}</dd></div>
                      <div><dt className="text-slate-500">Bull case (team notes)</dt><dd className="line-clamp-3 text-slate-300">{bull || '—'}</dd></div>
                      <div><dt className="text-slate-500">Bear case (team notes)</dt><dd className="line-clamp-3 text-slate-300">{bear || '—'}</dd></div>
                      <div>
                        <dt className="text-slate-500">Latest SEC filings</dt>
                        <dd>
                          {last.length ? (
                            <ul className="space-y-0.5">
                              {last.map((e) => (
                                <li key={e.id}><a href={e.url} target="_blank" rel="noopener noreferrer" className="text-slate-300 hover:text-neon-cyan">{e.form} · {eventTimeLabel(e).short}</a></li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-500">{fv.loading ? 'Loading…' : fv.error ? 'SEC unavailable' : 'None found'}</span>
                          )}
                        </dd>
                      </div>
                    </dl>
                    <Link to={`/research/${r.ticker}`} className="mt-3 inline-block text-[11px] text-neon-cyan hover:underline">Open research →</Link>
                  </GlassCard>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
