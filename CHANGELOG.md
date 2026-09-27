# Changelog

## 3.0.0 — Intelligence release (2026-09-27)

Two specs in one release, built on v2 ("real market data or no market data"):
**(A)** Catalyst Intelligence, SEC feed + 8-K triggers, watchlist alerts, Portfolio Simulator + P&L, browser notifications, typing/away presence, shared research pages, compare, economic calendar, safe link previews, screener + Finviz shortcuts, FDA/policy/macro feeds, global search.
**(B)** Morning Briefing, Why Is It Moving?, Prediction Tracker (+ scorecard/calibration), all reusing the same data layer.

Nothing in this release generates prices, news, filings, timestamps, probabilities or explanations. Every external item links to its source and shows when NEXUS last checked it.

### 1. New SQL — run once
`supabase/migrations/20260927_intelligence_release.sql` (Supabase → SQL Editor → paste → Run).
- **Additive + idempotent**: `create table if not exists`, `create or replace function`, `drop policy if exists` → `create policy`. No existing table, column, row or policy is changed or dropped.
- Tables: `sim_accounts`, `sim_positions`, `sim_transactions` (append-only), `research_notes`, `research_note_history`, `event_annotations`, `notification_prefs`, `intel_cache`, `briefings`, `predictions`, `prediction_history`, `prediction_links`.
- Functions: `sim_open_position`, `sim_apply_transaction` (security invoker, owner check, average-cost + realized P&L), `log_research_note_history`, `guard_prediction_update` (immutable originals, lock after resolution), `log_prediction_history`.
- RLS on every new table (members read; owners write; predictions editable only by their author and only while open; deletable only within 1 hour while open; notification prefs private; briefings written only by their owner).
- Added to the realtime publication.
- Verified in Postgres (PGlite) with two users: runs twice cleanly; simulator maths; RLS denials; history; locking.
- `supabase/schema.sql` is unchanged. Fresh installs: run `schema.sql`, then the migration.

### 2. New environment variables (Netlify → Site configuration → Environment variables; **no `VITE_` prefix**)
| Variable | Required? | Used by |
|---|---|---|
| `SEC_USER_AGENT` | **Yes, for SEC data** — e.g. `NEXUS Command Center you@example.com` | `sec`, `link-preview` |
| `MARKETAUX_API_KEY` | Optional (news shows "not configured" without it) | `news` |
| `FRED_API_KEY` | Optional (macro dashboard + release calendar) | `macro` |
| `OPENFDA_API_KEY` | Optional (openFDA works keyless at a lower limit) | `fda` |
| `MARKET_DATA_API_KEY` | Existing; now also enables the earnings calendar | `market` |

No new `VITE_` variables. No paid provider is required.

### 3. New Netlify Functions
`netlify/functions/sec.ts` · `news.ts` · `fda.ts` · `policy.ts` · `macro.ts` · `link-preview.ts` · `intel-status.ts`
(shared code in `netlify/lib/`). All require a signed-in Supabase session, keep keys server-side, cache in memory + the shared `intel_cache` table, and fall back to the last good copy **with its timestamp**. `market.ts` gained `EARNINGS_CALENDAR`.

### 4. Files added (64)
- **Functions / server:** `netlify/functions/{sec,news,fda,policy,macro,link-preview,intel-status}.ts`, `netlify/lib/{auth,cache,env,http,respond,safeFetch,sec,marketaux,fda,fred,policy}.ts`, `tsconfig.functions.json`
- **SQL:** `supabase/migrations/20260927_intelligence_release.sql`
- **Pages:** `src/pages/{Briefing,WhyMoving,Predictions,Portfolio,Research,Compare}.tsx` (and `Catalysts.tsx` rewritten as Catalyst Intelligence)
- **Briefing:** `src/features/briefing/{build.ts,useBriefing.ts,BriefingWidget.tsx}`
- **Why:** `src/features/why/{evidence.ts,WhyPanel.tsx,WhyDrawer.tsx,WhyButton.tsx,WhyQuick.tsx}`, `src/store/whyStore.ts`
- **Predictions:** `src/features/predictions/{api.ts,PredictionForm.tsx,ResolveModal.tsx,PredictionDetail.tsx,PredictionCard.tsx,PredictionWidgets.tsx}`
- **Portfolio:** `src/features/portfolio/{api.ts,PositionForm.tsx}`
- **Intel:** `src/types/intel.ts`, `src/services/intel/client.ts`, `src/hooks/useIntel.ts`, `src/features/intel/{EventCard,EventList,SourceStatus,EconomicCalendar,MacroDashboard}.tsx`, `src/features/intel/{annotations,time,useMyTickers,policySectors}.ts`
- **Research / markets:** `src/features/research/{ResearchSourceBar.tsx,api.ts}`, `src/features/market/ScreenerShortcuts.tsx`
- **Chat / notifications / search:** `src/features/chat/{ShareCardModal,SharedCardView}.tsx`, `src/features/notifications/{prefs.ts,useWatchlistAlerts.ts}`, `src/components/layout/GlobalSearch.tsx`
- **Moved:** `src/features/catalysts/ManualCatalysts.tsx` (the v2 catalyst feed, now the *Manual catalysts* tab)

### 5. Files changed (36)
`package.json` (v3.0.0; build also typechecks functions), `package-lock.json` (`@types/node`), `netlify/functions/market.ts`,
`src/App.tsx` (routes), `src/types/db.ts` (new row types + chat `SharedCard`), `src/lib/format.ts`,
`src/services/backend/{types,supabaseBackend,localBackend,localSeed}.ts` (RPC; local-mode emulation of the new triggers/RPCs; away presence),
`src/components/layout/{AppShell,CommandPalette,Sidebar,nav}.tsx|ts` (grouped nav, global search, Why drawer), `src/components/ui/Avatar.tsx` (away dot), `src/components/widgets/TradingViewWidget.tsx` (screener `market: 'us'` fix),
`src/features/chat/{MessageItem,LinkPreview,StockShareCard,ChannelList,api}.tsx|ts` (shared cards, safe previews, Why button),
`src/features/market/{MarketMovers,ProviderMovers}.tsx`, `src/features/watchlist/WatchlistMini.tsx`,
`src/pages/{Catalysts,CommandCenter,Markets,Messages,Settings,StockDetail,Watchlist}.tsx`,
`src/providers/RealtimeProvider.tsx` (alert categories, watchlist alerts, idle → away), `src/store/realtimeStore.ts`, `.env.example`, `README.md`, `CHANGELOG.md`.

### 6. Files removed
None. (`src/pages/Catalysts.tsx`'s v2 content moved to `src/features/catalysts/ManualCatalysts.tsx`.)

### 7. Local setup
```bash
npm install
cp .env.example .env.local        # optional: Supabase + keys
npm run dev                       # UI at http://localhost:5173 (local mode works without Supabase)
# To run the data functions locally too:
npx netlify-cli dev               # serves functions at /.netlify/functions/*; reads server-side vars from .env / Netlify
npm run build                     # typecheck app + functions, then production build
```
Without the functions running, intel panels say *Data functions not deployed* — they never show sample data.

### 8. Git commands
```bash
git add .
git commit -m "Add catalyst intelligence portfolio and collaboration features, morning briefing, prediction tracking and movement intelligence"
git push
```

### 9. Netlify changes
1. Add the environment variables in §2 (at minimum `SEC_USER_AGENT`). Scope: all (functions need them at runtime).
2. No build-setting changes: `netlify.toml` already points functions to `netlify/functions` (esbuild bundles `netlify/lib` automatically).
3. Run the SQL migration in Supabase **before** or right after this deploy.
4. One production deploy (≈15 of the 300 free monthly credits).

### 10. Verification done
- `npm run build` (app + functions typecheck, Vite build) passes.
- Server functions exercised with the real code and upstream responses replaced by documented-format fixtures: SEC submissions + Atom (exact times only from the Atom feed), 8-K item classification, Marketaux budget guard, FRED calendar/series, Federal Register, openFDA, SSRF blocks (loopback, RFC1918, link-local/metadata, IPv6 ULA, mapped IPv4, redirects, non-standard ports, credentials).
- 58 browser checks (Playwright) against the production build + fixture functions: briefing generation/sections/rate-limit, simulator maths (+$50 on 5 @ 110 vs 100), prediction create → resolve → lock → history → scorecard, Why verdicts (CONFIRMED / NO CONFIRMED CATALYST FOUND / Potentially related), chat cards + Finviz preview without fetching, research history, compare, global search, markets additions, stock page, alert settings, and no horizontal overflow at 390 px on five pages.
- Not verifiable from the build sandbox (no internet): live TradingView rendering and live SEC/Marketaux/FRED/Federal Register/openFDA responses. Check these after deploying.

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
