import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/AppShell';
import { IndexCard } from '@/features/market/IndexCard';
import { MoversCard } from '@/features/market/MoversCard';
import { BreadthPanel, SentimentGauge } from '@/features/market/BreadthSentiment';
import { SmartStockChart } from '@/features/market/SmartStockChart';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { WatchlistMini } from '@/features/watchlist/WatchlistMini';
import { CatalystAlerts } from '@/features/catalysts/CatalystAlerts';
import { RecentMessages } from '@/features/chat/RecentMessages';
import { ActiveTrades, PortfolioTracker } from '@/features/trades/DashboardTrades';
import { useMyWatchlist } from '@/features/watchlist/api';
import { INDEX_PROXIES } from '@/services/market/universe';
import { useSettings } from '@/store/settingsStore';
import { useAuth } from '@/store/authStore';
import { cn } from '@/lib/cn';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function CommandCenter() {
  const name = useAuth((s) => s.profile?.display_name?.split(' ')[0]);
  const symbol = useSettings((s) => s.dashboardSymbol);
  const set = useSettings((s) => s.set);
  const { items } = useMyWatchlist();
  const quick = useMemo(
    () => [...new Set(['SPY', 'QQQ', 'DIA', ...items.rows.filter((i) => i.favorite).map((i) => i.symbol), ...items.rows.map((i) => i.symbol)])].slice(0, 9),
    [items.rows],
  );

  return (
    <div className="pb-4">
      <PageHeader title="Command Center" subtitle={`${greeting()}${name ? `, ${name}` : ''}. Here's the board.`} />
      <div className="grid grid-cols-1 gap-3 px-3 sm:px-5 lg:grid-cols-12">
        {INDEX_PROXIES.map((p) => (
          <div key={p.symbol} className="lg:col-span-4">
            <IndexCard symbol={p.symbol} label={p.label} proxy={p.proxy} />
          </div>
        ))}

        <div className="flex flex-col gap-2 lg:col-span-8">
          <div className="flex flex-wrap items-center gap-1.5">
            {quick.map((s) => (
              <button
                key={s}
                onClick={() => set({ dashboardSymbol: s })}
                className={cn(
                  'rounded-lg border px-2.5 py-1 font-mono text-[11px] transition',
                  s === symbol ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan shadow-glow' : 'border-white/10 text-slate-400 hover:text-white',
                )}
              >
                {s}
              </button>
            ))}
            <SymbolSearch className="ml-auto w-full sm:w-56" placeholder="Chart any ticker…" onSelect={(m) => set({ dashboardSymbol: m.symbol })} />
          </div>
          <div className="h-[520px]">
            <SmartStockChart symbol={symbol} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <SentimentGauge />
          <BreadthPanel />
        </div>

        <MoversCard className="lg:col-span-4" />
        <WatchlistMini className="lg:col-span-4" />
        <CatalystAlerts className="lg:col-span-4" />

        <RecentMessages className="lg:col-span-4" />
        <ActiveTrades className="lg:col-span-4" />
        <PortfolioTracker className="lg:col-span-4" />
      </div>
    </div>
  );
}
