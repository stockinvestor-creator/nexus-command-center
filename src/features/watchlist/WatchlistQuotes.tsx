import { useMemo } from 'react';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { EmptyState } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { useSettings } from '@/store/settingsStore';
import { tvSymbolFor } from '@/services/market/symbols';

/**
 * Prices for the user's watchlist, rendered by TradingView's official Market Quotes widget.
 * Supabase stores only the tickers; every price/change/volume shown here comes from TradingView.
 */
export function WatchlistQuotes({ title, tickers, heightClass = 'h-[360px]' }: { title: string; tickers: string[]; heightClass?: string }) {
  const enabled = useSettings((s) => s.widgets.watchlistQuotes);
  const toggle = useSettings((s) => s.toggleWidget);
  const symbols = useMemo(() => tickers.slice(0, 40).map((t) => ({ name: tvSymbolFor(t), displayName: t })), [tickers]);
  if (!enabled)
    return (
      <EmptyState
        title="Quotes hidden"
        action={
          <Button size="sm" variant="outline" onClick={() => toggle('watchlistQuotes')}>
            Show TradingView quotes
          </Button>
        }
      />
    );
  if (!symbols.length) return <EmptyState title="Add tickers to see TradingView quotes" />;
  return (
    <div className={heightClass}>
      <TradingViewWidget key={symbols.map((s) => s.name).join(',')} script="market-quotes" config={tv.marketQuotes(title, symbols)} failureText="Watchlist quotes temporarily unavailable" />
    </div>
  );
}
