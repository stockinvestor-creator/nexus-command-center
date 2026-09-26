# Changelog

## 2.0.0 — Real market data or no market data (2026-09-26)

NEXUS no longer contains any code that generates, simulates or back-fills market data. Every market visual is an official TradingView widget. Values NEXUS draws itself only appear when a real API provider is configured, and always carry **source · status · last updated**. When no verified data exists, the UI says *Market data unavailable*.

### 1. Files modified (45)
`.env.example`, `README.md`,
`src/App.tsx`, `src/main.tsx`, `src/vite-env.d.ts`, `src/lib/env.ts`,
`src/types/market.ts`, `src/types/db.ts`,
`src/services/market/MarketDataProvider.ts`, `src/services/market/AlphaVantageProvider.ts`, `src/services/market/index.ts`,
`src/services/backend/localBackend.ts`,
`src/hooks/useMarket.ts`,
`src/store/marketStatusStore.ts`, `src/store/settingsStore.ts`,
`src/components/charts/StockChart.tsx`, `src/components/layout/CommandPalette.tsx`, `src/components/layout/TickerTape.tsx`, `src/components/layout/TopBar.tsx`, `src/components/widgets/TradingViewWidget.tsx`, `src/components/widgets/WidgetPanel.tsx`,
`src/features/auth/LoginPage.tsx`, `src/features/auth/SetupWizard.tsx`,
`src/features/chat/MessageItem.tsx`, `src/features/chat/RecentMessages.tsx`, `src/features/chat/ShareStockModal.tsx`, `src/features/chat/StockShareCard.tsx`, `src/features/chat/api.ts`,
`src/features/market/PriceAlertModal.tsx`, `src/features/market/SmartStockChart.tsx`, `src/features/market/SymbolSearch.tsx`, `src/features/market/usePriceAlertWatcher.ts`,
`src/features/trades/DashboardTrades.tsx`, `src/features/trades/TradeCard.tsx`, `src/features/trades/TradeDetail.tsx`, `src/features/trades/TradeForm.tsx`,
`src/features/watchlist/WatchlistMini.tsx`, `src/features/watchlist/api.ts`,
`src/pages/Catalysts.tsx`, `src/pages/CommandCenter.tsx`, `src/pages/Markets.tsx`, `src/pages/Messages.tsx`, `src/pages/Settings.tsx`, `src/pages/StockDetail.tsx`, `src/pages/Watchlist.tsx`

### 2. Files added (12)
| File | Purpose |
|---|---|
| `src/services/market/TradingViewProvider.ts` | Default provider (no NEXUS-side prices) + `UnconfiguredProvider` for missing/invalid/planned providers |
| `src/services/market/symbols.ts` | Reference directory (names + listing exchange, **no prices**) and `resolveSymbol()` → `NASDAQ:NVDA`; never guesses unknown exchanges |
| `src/components/ui/DataSource.tsx` | `DataSourceBadge` (SOURCE · STATUS · Updated), `TradingViewBadge`, `MarketUnavailable`, `UserEstimateTag` |
| `src/components/charts/TradingViewChart.tsx` | Official interactive TradingView chart for one exact symbol, with an expand option |
| `src/features/market/MarketMovers.tsx` | MARKET MOVERS: Top gainers / Top losers / Most active |
| `src/features/market/MarketScreener.tsx` | MARKET SCREENER with presets |
| `src/features/market/MarketHeatmap.tsx` | U.S. market heatmap (S&P 500 / Nasdaq 100 / Dow 30 / All US) |
| `src/features/market/MarketStatusPanel.tsx` | Schedule-based market status, ET clock, next open/close |
| `src/features/market/ProviderMovers.tsx` | Movers from an API provider (rendered only if the provider supports them) |
| `src/features/watchlist/WatchlistQuotes.tsx` | Watchlist prices via TradingView Market Quotes widget |
| `supabase/optional_cleanup_legacy_share_prices.sql` | **Optional** removal of old price fields from shared-stock messages |
| `CHANGELOG.md` | This file |

### 3. Files deleted (7)
`src/services/market/MockMarketDataProvider.ts`, `src/services/market/universe.ts` (contained seed "base prices"), `src/features/market/IndexCard.tsx`, `src/features/market/BreadthSentiment.tsx`, `src/features/market/MoversCard.tsx`, `src/components/charts/Sparkline.tsx`, `src/components/ui/FreshnessBadge.tsx`

### 4. Mock/demo market functionality removed
- `MockMarketDataProvider` (seeded random-walk prices, candles, intraday bars, quote "ticks", movers, company profile numbers) deleted; `mock` is no longer a provider option.
- Seed "base price / volatility" values removed from the symbol directory.
- Fake index cards (SPY/QQQ/DIA prices + sparklines), breadth panel and sentiment gauge deleted.
- The provider-driven fallback ticker tape was deleted; if TradingView can't load, an explicit unavailable strip is shown instead.
- The dashboard's custom chart (which charted mock candles by default) was replaced by TradingView widgets.
- Sparklines deleted everywhere (watchlist rows, trade detail, chat cards).
- Shared-stock messages no longer store `price`, `changePercent`, `freshness` or `spark`; old messages that contain them are ignored at render time.
- Trade P&L, trade "Now $x", watchlist price columns and price alerts appear only when a real quote provider exists; otherwise they show `—` / *Market data unavailable*.
- DEMO / LIVE freshness labels removed. The label set is now: TradingView market data · End of day · Delayed · Realtime · IEX only (reserved for Alpaca) · Market data unavailable.
- Browser-only backend (no Supabase) renamed in the UI from "Demo mode" to "Local mode"; it stores chat/watchlists only, never market data.

### 5. TradingView integrations
Ticker tape, Stock Screener (×3 for movers, ×1 for the screener), Stock Heatmap, Market Overview, Market Quotes (watchlists), Advanced Chart (Markets page, stock pages, chat cards, full-chart modal), Symbol Info, Symbol Profile, Mini Symbol Overview (trade detail), Hot Lists, Economic Calendar, Top Stories.
All are loaded lazily via `IntersectionObserver`, have a 20 s load timeout, and fail to *Chart/Market data temporarily unavailable*. Nothing is scraped or extracted.

### 6. Market Movers
`MarketMovers.tsx`: three official TradingView **Stock Screener** widgets (market `america`) preset to `top_gainers`, `top_losers`, `volume_leaders`, using the "Overview" column set (ticker/company, price, change %, change, volume, relative volume, market cap, sector — as supplied by TradingView). Three columns on wide screens; tabs on mobile. Placed directly under Market Status on the Command Center.

### 7. Market Screener
`MarketScreener.tsx` on the Markets page: TradingView Stock Screener with presets Top gainers, Top losers, Most active, Unusual volume, 52-week highs, 52-week lows, Largest caps. The widget toolbar exposes TradingView's column sets (overview / performance / …) and filters, including relative volume, market cap, sector and industry where TradingView provides them.

### 8. Heatmap
`MarketHeatmap.tsx`: official TradingView Stock Heatmap, grouped by sector, sized by market cap, colored by change; source switcher S&P 500 / Nasdaq 100 / Dow 30 / All US. On the Command Center and the Markets page.

### 9. Ticker tape
`TickerTape.tsx`: official TradingView ticker tape with AMEX:SPY, NASDAQ:QQQ, AMEX:DIA, AMEX:IWM, NASDAQ:AAPL, NVDA, MSFT, AMZN, META, GOOGL, TSLA, AMD, MU, AVGO, PLTR. Failure → "Market data temporarily unavailable".

### 10. Chat TradingView stock sharing
- `ShareStockModal.tsx`: search → resolved TradingView symbol (verified exchange badge, explicit exchange choice for unknown tickers, `EXCHANGE:TICKER` input), default interval, live preview, comment.
- Metadata stored in `messages.metadata.stock`: `{ symbol: "NASDAQ:NVDA", ticker: "NVDA", exchange: "NASDAQ", provider: "tradingview", sharedChart: true, interval: "D", company }`.
- `StockShareCard.tsx`: ticker, company, exchange, interactive TradingView chart (candles/line, intervals, volume, crosshair, zoom/pan), "TradingView market data" label, "Shared by …", and actions Full chart / Stock page / Watchlist / Reply (reactions via the message toolbar). Mounted only near the viewport and unmounted when scrolled far away. 280 px tall on mobile, 340 px on desktop.
- Works in DMs, groups and every channel; persists across refresh (rebuilt from metadata). Legacy share messages render as TradingView charts too.

### 11. Environment variables
- `VITE_MARKET_DATA_PROVIDER`: default is now `tradingview`. Valid values are `tradingview` and `alphavantage`. `alpaca` and `twelvedata` are recognised but not implemented (they show "not configured"). `mock` now shows "not configured".
- **Removed** `VITE_MARKET_DATA_API_KEY` (a secret must never be a `VITE_` variable). Alpha Vantage now always goes through the Netlify Function with the server-side `MARKET_DATA_API_KEY`.
- Documented future server-side `ALPACA_API_KEY` / `ALPACA_SECRET_KEY`.

### 12. Supabase changes
**None required. No new SQL.** Schema, RLS, auth, whitelist and data are untouched; shared charts use the existing `messages.metadata` JSON column.
Optional: `supabase/optional_cleanup_legacy_share_prices.sql` strips old price/sparkline fields from previous shared-stock messages (the app ignores them anyway).

### 13. Netlify changes
None to `netlify.toml` or `netlify/functions/market.ts`. Build is still `npm run build` → `dist`.

### Also
- Manual inputs are visually tagged: **User estimate** (probability, expected move, confidence), **Manual score** (catalyst/momentum/volatility/risk), **Team thesis**.
- Settings → Market Data Status shows provider, capability matrix, data status, API calls, last update, cache status and configuration errors.
- `main.tsx` / `App.tsx` / `lib/env.ts`: optional `VITE_HASH_ROUTER=true` build flag used only for the hosted preview page (hash routing, no first-run redirect). Your Netlify build doesn't set it.
- `localBackend.ts`: local mode keeps working in memory if browser storage is unavailable.
- The hosted preview page is updated to this version.
