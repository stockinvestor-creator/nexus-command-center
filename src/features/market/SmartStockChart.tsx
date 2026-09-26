import { useState } from 'react';
import { StockChart } from '@/components/charts/StockChart';
import { useWatchToggle } from '@/features/watchlist/api';
import { lookupUniverse } from '@/services/market/universe';
import type { Timeframe } from '@/types/market';
import { PriceAlertModal, usePriceAlerts } from './PriceAlertModal';

/** StockChart wired to the watchlist + price alerts. */
export function SmartStockChart({ symbol, company, initialTimeframe, className }: { symbol: string; company?: string; initialTimeframe?: Timeframe; className?: string }) {
  const { item, toggle } = useWatchToggle(symbol);
  const alerts = usePriceAlerts(symbol);
  const [alertOpen, setAlertOpen] = useState(false);
  const [lastPrice, setLastPrice] = useState<number | null>(null);
  return (
    <>
      <StockChart
        key={symbol}
        symbol={symbol}
        company={company ?? lookupUniverse(symbol)?.name}
        initialTimeframe={initialTimeframe}
        className={className}
        alertLevels={alerts.rows.filter((a) => a.active).map((a) => a.price)}
        watchlisted={Boolean(item)}
        onToggleWatchlist={toggle}
        onPriceAlert={(p) => {
          setLastPrice(p);
          setAlertOpen(true);
        }}
      />
      <PriceAlertModal symbol={symbol} open={alertOpen} onClose={() => setAlertOpen(false)} lastPrice={lastPrice} />
    </>
  );
}
