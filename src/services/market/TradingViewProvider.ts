import { BaseProvider } from './MarketDataProvider';

/**
 * TradingView (default, $0).
 *
 * TradingView's official embeddable widgets render their own licensed data inside iframes.
 * NEXUS never reads, scrapes or re-uses that data, so this provider exposes NO programmatic
 * quotes/bars/movers: every NEXUS-rendered number (outside a widget) shows "unavailable" and
 * all market visuals come from the embedded widgets themselves.
 */
export class TradingViewProvider extends BaseProvider {
  readonly id = 'tradingview';
  readonly name = 'TradingView widgets';
  readonly sourceLabel = 'TradingView';
  readonly description =
    'Market visuals (charts, ticker tape, movers, screener, heatmap) come from official TradingView widgets, which display TradingView’s own data. NEXUS does not extract prices from those widgets, so features that need a price inside NEXUS (price alerts, trade P&L) stay unavailable until a quote provider is configured.';
}

/** Placeholder used when VITE_MARKET_DATA_PROVIDER is missing, invalid, or not implemented yet. */
export class UnconfiguredProvider extends BaseProvider {
  readonly id: string;
  readonly name = 'Not configured';
  readonly sourceLabel = 'None';
  readonly description: string;
  readonly configurationError: string;

  constructor(requested: string, reason: string) {
    super();
    this.id = requested || 'none';
    this.configurationError = reason;
    this.description = reason;
  }
}
