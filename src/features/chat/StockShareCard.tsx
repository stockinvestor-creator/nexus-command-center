import { Link } from 'react-router-dom';
import { CornerUpLeft, ExternalLink, Maximize2, Star } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { StockShareMeta } from '@/types/db';
import { resolveSymbol } from '@/services/market/symbols';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { Modal } from '@/components/ui/Modal';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { useWatchToggle } from '@/features/watchlist/api';
import { useSettings } from '@/store/settingsStore';
import { cn } from '@/lib/cn';
import { WhyButton } from '@/features/why/WhyButton';

/**
 * Shared-chart message card. Rebuilt from message metadata on every load:
 * TradingView symbol → official interactive TradingView chart (lazy, unloads offscreen).
 * Legacy fields some old messages may still contain (price, sparkline…) are ignored.
 */
export function StockShareCard({ meta, sharedBy, onReply }: { meta: StockShareMeta; sharedBy?: string; onReply?: () => void }) {
  const resolved = resolveSymbol(meta.symbol) ?? resolveSymbol(meta.ticker ?? '');
  const tvSymbol = resolved?.tvSymbol ?? meta.symbol;
  const ticker = meta.ticker ?? resolved?.ticker ?? meta.symbol;
  const exchange = meta.exchange ?? resolved?.exchange ?? null;
  const company = meta.company ?? resolved?.name;
  const chartsOn = useSettings((s) => s.widgets.sharedCharts);
  const { item, toggle } = useWatchToggle(ticker);
  const [full, setFull] = useState(false);

  return (
    <div className="glass glow-border mt-1.5 w-full max-w-[640px] overflow-hidden" data-shared-chart={tvSymbol}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-bold tracking-wide text-white">${ticker}</span>
            <span className={cn('rounded border px-1.5 py-[1px] font-mono text-[9px] uppercase tracking-wider', exchange ? 'border-cyan-400/30 text-cyan-200' : 'border-amber-400/30 text-amber-200')}>
              {exchange ?? 'exchange unverified'}
            </span>
          </div>
          {company && <p className="truncate text-[11px] text-slate-400">{company}</p>}
        </div>
        <TradingViewBadge className="ml-auto" />
      </div>

      <div className="h-[280px] border-y border-white/[0.05] sm:h-[340px]">
        {chartsOn ? (
          <TradingViewChart symbol={tvSymbol} interval={meta.interval ?? 'D'} compact unloadOffscreen expandable={false} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">Shared charts are hidden in Settings.</div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1 px-2 py-2">
        {sharedBy && <span className="px-1 text-[11px] text-slate-500">Shared by {sharedBy}</span>}
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <WhyButton symbol={ticker} compact />
          <CardBtn onClick={() => setFull(true)} icon={<Maximize2 className="h-3.5 w-3.5" />}>
            Full chart
          </CardBtn>
          <Link to={`/stock/${encodeURIComponent(tvSymbol)}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/5 hover:text-neon-cyan">
            <ExternalLink className="h-3.5 w-3.5" /> Stock page
          </Link>
          <CardBtn onClick={toggle} icon={<Star className={cn('h-3.5 w-3.5', item && 'fill-amber-300 text-amber-300')} />}>
            {item ? 'Watching' : 'Watchlist'}
          </CardBtn>
          {onReply && (
            <CardBtn onClick={onReply} icon={<CornerUpLeft className="h-3.5 w-3.5" />}>
              Reply
            </CardBtn>
          )}
        </div>
      </div>

      {full && (
        <Modal open={full} onClose={() => setFull(false)} title={tvSymbol} size="xl">
          <div className="-mx-5 -my-4 h-[78dvh]">
            <TradingViewWidget script="advanced-chart" config={tv.advancedChart(tvSymbol, { interval: meta.interval ?? 'D' })} lazy={false} failureText="Chart temporarily unavailable" />
          </div>
        </Modal>
      )}
    </div>
  );
}

function CardBtn({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/5 hover:text-neon-cyan">
      {icon}
      {children}
    </button>
  );
}
