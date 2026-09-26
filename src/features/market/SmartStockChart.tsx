import { useState } from 'react';
import { StockChart } from '@/components/charts/StockChart';
import { useWatchToggle } from '@/features/watchlist/api';
import { lookupSymbol } from '@/services/market/symbols';
import type { Timeframe } from '@/types/market';
import { PriceAlertModal, usePriceAlerts } from './PriceAlertModal';

/**
 * NEXUS chart drawn with TradingView Lightweight Charts from the configured API provider's
 * REAL bars (e.g. Alpha Vantage end-of-day). Only rendered when the provider supports bars.
 */
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
        company={company ?? lookupSymbol(symbol)?.name}
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
