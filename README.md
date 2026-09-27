# NEXUS · Private Market Command Center

A private, two-person, futuristic stock-market command center with realtime chat — built to run at **$0/month** on **Netlify (free)** + **Supabase (free)**, using only free/open-source tools.

- **React 19 + Vite + TypeScript + Tailwind CSS**
- **Framer Motion** for transitions, **Three.js / React Three Fiber** for a lazy-loaded ambient particle scene
- **Official TradingView widgets** for every market visual: charts, ticker tape, Market Movers, screener, heatmap, quotes, and interactive charts shared in chat
- **TradingView Lightweight Charts** for an optional NEXUS chart drawn only from a real API provider's bars (e.g. Alpha Vantage)
- **Supabase** for Auth, Postgres (with Row Level Security), Realtime (chat, presence, typing) and Storage (chat images)
- **Lucide** icons

**v3 intelligence release:** Morning Briefing · Why Is It Moving? · Prediction Tracker · Catalyst Intelligence (SEC EDGAR filings + 8-K triggers, company news, policy, FDA) · Portfolio Simulator + P&L + trade journal · shared research pages · stock compare · economic calendar + macro dashboard · safe link previews · watchlist alerts · away presence · global search. See §10.

> **Rule: real market data or no market data.** NEXUS never generates, simulates or back-fills prices. If a verified source isn't available, it shows *Market data unavailable* (or —).
>
> Without Supabase configured, the workspace (chat, watchlists, ideas) runs in a browser-only **local mode** for testing. Market data behaves exactly the same in both modes.

---

## 1. Quick start (local)

```bash
npm install
npm run dev        # http://localhost:5173  → first-run setup guide, then the app
npm run build      # typecheck + production build into dist/
```

Requires Node 20+ (Netlify is pinned to Node 22 in `netlify.toml`).

**Try realtime chat without Supabase (local mode):** open the app in two tabs; in the second tab go to *Settings → Local mode identity* and switch to *Operator B*. Chat, reactions, typing indicators, presence and notifications sync between the tabs.

---

## 2. Deploy for $0/month — exact steps

### Step 1 — Create a free Supabase project
1. <https://supabase.com/dashboard> → **New project** → choose the **Free** plan (no credit card).
2. Save the database password somewhere safe.

### Step 2 — Run the SQL migration
1. **SQL Editor → New query** → paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   It creates all tables, indexes, foreign keys, RLS policies, the whitelist, triggers, RPC functions, the realtime publication and a private `attachments` storage bucket. It is idempotent — safe to re-run after updates.
   Then run [`supabase/migrations/20260927_intelligence_release.sql`](supabase/migrations/20260927_intelligence_release.sql) the same way (v3 tables: simulator, research, briefings, predictions, annotations, notification prefs, intel cache). Additive and idempotent.
2. Whitelist your two emails (same SQL editor):
   ```sql
   insert into public.allowed_emails (email) values
     ('you@example.com'),
     ('partner@example.com');
   ```

### Step 3 — Create the two accounts and close registration
1. **Authentication → Users → Add user → Create new user** for each whitelisted email. Tick **Auto Confirm User**.
2. **Authentication → Sign In / Providers** → turn **off** “Allow new users to sign up”.

Registration is locked three ways: no sign-up screen exists in the app, public sign-ups are disabled in Supabase, and a database trigger rejects any `auth.users` insert whose email is not in `public.allowed_emails` (which is itself capped at 2 rows).

### Step 4 — Copy your Supabase URL and anon key
**Project Settings → API**: copy **Project URL** and the **anon public** key.
The anon key is designed to be public; RLS protects the data. **Never** put the `service_role` key in this app.

### Step 5 — Market data
Set `VITE_MARKET_DATA_PROVIDER=tradingview` (the default). All market visuals are official TradingView widgets; nothing else is needed and it costs $0.

Optional: for **end-of-day** quotes *inside* NEXUS (enables price alerts and open-trade P&L), get a free key at <https://www.alphavantage.co/support/#api-key>, set `VITE_MARKET_DATA_PROVIDER=alphavantage`, and add the key as `MARKET_DATA_API_KEY` (server-side only).

### Step 6 — Deploy on Netlify
1. Push this folder to a GitHub repo.
2. <https://app.netlify.com/start> → **Import from Git** → pick the repo. Build settings come from `netlify.toml`
   (`npm run build`, publish `dist`, functions in `netlify/functions`).
3. **Site configuration → Environment variables** — add:

   | Variable | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | public |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | public by design (RLS) |
   | `VITE_MARKET_DATA_PROVIDER` | `tradingview` (or `alphavantage`) | public setting; `mock` is no longer valid |
   | `MARKET_DATA_API_KEY` | your Alpha Vantage key | **server-side only**; only if using `alphavantage` (also enables the earnings calendar) |
   | `SEC_USER_AGENT` | `NEXUS Command Center you@example.com` | **server-side**; required for SEC filings (SEC fair-access policy) |
   | `MARKETAUX_API_KEY` | free key from marketaux.com | **server-side**; optional (company news) |
   | `FRED_API_KEY` | free key from fred.stlouisfed.org | **server-side**; optional (macro dashboard + release calendar) |
   | `OPENFDA_API_KEY` | free key from open.fda.gov | **server-side**; optional (works without) |

   Never create `VITE_` variables for secrets — anything prefixed `VITE_` ends up in browser JavaScript.

4. **Deploys → Trigger deploy**.
5. Back in Supabase: **Authentication → URL Configuration** → set **Site URL** to your Netlify URL (used by password-reset emails).

Done. Sign in with either account.

---

## 3. Market data: sources and labels

| What you see | Source | Label |
|---|---|---|
| Ticker tape, Market Movers (Top gainers / losers / most active), Market Screener, U.S. heatmap, market overview, stock charts, symbol info, company profile, watchlist quotes, charts shared in chat | Official **TradingView** widgets. The data is TradingView's, rendered inside their iframe. NEXUS never reads, copies or alters it. | **TradingView market data**. Depending on the exchange this can be delayed; NEXUS never calls it realtime. |
| Quotes / bars / movers drawn by NEXUS itself (only when an API provider is configured) | e.g. **Alpha Vantage** free tier via the Netlify Function | **SOURCE · STATUS · Updated …**, e.g. `ALPHA VANTAGE · END OF DAY · Updated Sep 25`. Cached data is marked `cached` with its timestamp. |
| Market status (open / pre / after / closed) | Published NYSE hours and holidays (`src/lib/marketClock.ts`) | "Schedule-based" |
| Probability, expected move, confidence, catalyst/momentum/volatility/risk scores, theses | You and your partner | **User estimate**, **Manual score**, **Team thesis** |

Failure behaviour (never a fallback to invented data):
- TradingView can't load → *Chart temporarily unavailable* / *Market data temporarily unavailable* (the ticker and exchange stay visible).
- Provider rate limit → *Market data rate limit reached*; previously cached data, if any, is shown **with its timestamp**.
- Provider can't serve a capability (e.g. TradingView has no NEXUS-side quotes) → the value shows `—` / *Market data unavailable*, and features that need it (price alerts, open P&L) say so.

## 4. Market-data providers (and adding Alpaca later)

`VITE_MARKET_DATA_PROVIDER` picks the provider behind the `MarketDataProvider` interface (`src/services/market/MarketDataProvider.ts`):

```ts
getQuote(symbol)   getQuotes(symbols)   getBars(symbol, timeframe)
getTopGainers()    getTopLosers()       getMostActive()
searchSymbols(q)   getCompanyProfile(symbol)   getMarketStatus()
capabilities: { quotes, bars, movers, search, profile }
```

| Value | Status |
|---|---|
| `tradingview` (default) | Implemented. No NEXUS-side prices (all capabilities `false`); every market visual is a TradingView widget. |
| `alphavantage` | Implemented. End-of-day quotes, bars, movers, search, profile via the Netlify proxy (25 calls/day, cached until the next close). |
| `alpaca`, `twelvedata` | Recognised but **not implemented**: shown as "not configured", never faked. |
| anything else (incl. `mock`) | "No verified market-data source configured". |

Unsupported methods throw `MarketDataUnavailableError` and the UI shows an unavailable state. There is no mock provider and no fallback to generated data.

**Adding Alpaca (or another provider) later**
1. Create `src/services/market/AlpacaProvider.ts` extending `BaseProvider`. Set `sourceLabel: 'Alpaca IEX'`, `status: 'REALTIME_IEX'` (Alpaca Basic = IEX exchange only, *not* the consolidated market; the badge reads "Realtime · IEX only"), and the `capabilities` you actually implement.
2. Keep keys server-side: add a Netlify Function (like `netlify/functions/market.ts`) that reads `ALPACA_API_KEY` / `ALPACA_SECRET_KEY` and verifies the Supabase session; call that from the provider. For streaming, mint short-lived tokens server-side rather than shipping keys.
3. Wrap REST calls with `cached(key, ttl, fetcher)` from `requestCache.ts` (dedupe, persistence, stale-with-timestamp).
4. Register it in `build()` / `PROVIDER_OPTIONS` in `src/services/market/index.ts`, then set `VITE_MARKET_DATA_PROVIDER=alpaca`.

Watchlist tickers, notes, theses, categories, risk levels and catalyst dates always live in Supabase; prices always come from the market-data layer.

## 4b. Sharing TradingView charts in chat

The 📈 button in any conversation (DMs, groups, every channel) opens **Share a TradingView chart**:
1. Search a ticker. Known listings resolve to an exchange-qualified symbol (`NASDAQ:NVDA`, `NYSE:IBM`). You can type `EXCHANGE:TICKER` directly. For unknown tickers NEXUS doesn't guess: pick the exchange or let TradingView resolve the bare ticker.
2. The message stores only `{ symbol, ticker, exchange, provider: "tradingview", sharedChart: true, interval, company }` in `messages.metadata.stock`. No prices, candles or chart points are stored.
3. Supabase Realtime delivers it; each browser renders the official interactive TradingView chart for that exact symbol (lazy-loaded near the viewport and unloaded when scrolled far away, so long chats stay smooth). After a refresh it rebuilds from the same metadata.

Older shared-stock messages may still contain price fields from the previous version; the app ignores them. `supabase/optional_cleanup_legacy_share_prices.sql` removes them if you want (optional).

## 5. Free-tier safety

| Service | Free allowance (checked Sept 2026) | This app's usage |
|---|---|---|
| Netlify | **300 credits / month**. Production deploy = 15 credits, bandwidth = 20 credits/GB, web requests = 2 credits/10k, functions = 10 credits/GB-hour. If you run out, the site **pauses until next month — you are never charged**. | First load ≈ 0.6 MB gzipped, then assets are cached as immutable → two users use well under 1 GB/month. The market proxy runs only a few times a day and is CDN-cached. **Main cost is deploys: ~20 production deploys/month fit in the free credits**, so batch your changes rather than pushing every small edit. |
| Supabase | 500 MB database, 1 GB file storage, 5 GB egress, 2 active projects; pauses after ~1 week of inactivity | Two users → tiny. One realtime room for presence/typing + a few table subscriptions. Chat images max 5 MB each. |
| TradingView widgets | Free embeds | Loaded lazily only when on screen |
| Alpha Vantage (optional) | 25 requests / day | Quotes and 1M/3M charts share **one** daily-series call per symbol; 6M/1Y/5Y share **one** weekly call; cached until the next ~17:00 ET close; budget guard stops at the limit |

- No API is polled every second. Alpha Vantage is fetched only when the cache expires.
- If the API limit is reached or the network fails, previously cached data is shown **with its timestamp**, marked `cached`. Otherwise the value shows *Market data unavailable*.
- *Settings → Market Data Status* shows provider, capabilities, data status, API calls used today, last successful update, and cache entries/size and hit/miss counts.
- Supabase free projects pause after ~1 week of zero activity; click **Restore** in the dashboard if that happens.
- Netlify: to save credits you can turn off *Deploy Previews* / *Branch deploys* (Site configuration → Build & deploy) and test locally with `npm run dev` instead.

---

## 6. Security model

- **RLS on every table.** Access requires a JWT whose email is in `public.allowed_emails` (`public.is_member()`).
- Messages: only readable by channel members (public channels → all members); only authors can edit content (enforced by trigger); both can pin; only authors delete.
- Watchlists: both members can read (shared workspace), only owners write.
- Notifications: only the recipient can read; senders can't spoof `actor_id`.
- Storage: private bucket; users can only upload into their own `<user_id>/` folder; images served via short-lived signed URLs.
- Market API key never ships to the browser; the Netlify Function verifies the caller's Supabase session and only forwards a whitelist of read-only endpoints.
- Chat content is rendered as text tokens (no `dangerouslySetInnerHTML`).
- Link previews: fetched only by the `link-preview` Netlify Function for signed-in members. It blocks private/loopback/link-local/metadata addresses (checked again after DNS resolution and on every redirect, max 3), allows only ports 80/443, times out after 5 s, reads at most 512 KB of HTML, never executes page JavaScript and returns only title/description/site/image — never article bodies. Finviz links are never fetched. SEC filing links are described from EDGAR's official data.
- Every intel function (SEC, news, FDA, policy, macro, previews) verifies the caller's Supabase session and keeps its keys server-side. Nothing secret is ever in a `VITE_` variable.

---

## 7. Project structure

```
supabase/schema.sql          tables, indexes, RLS, whitelist, triggers, RPC, realtime, storage
supabase/migrations/         v3 additive migration (run once after schema.sql)
netlify/functions/           market (Alpha Vantage proxy), sec, news, fda, policy, macro, link-preview, intel-status
netlify/lib/                 shared server code: auth, cache (memory → intel_cache), SSRF-safe fetch, source clients
netlify.toml                 build, SPA redirects, headers, Node version
src/
  components/  layout (shell, sidebar, top bar, mobile nav, ticker tape, ⌘K palette),
               ui (glass cards, badges, modal, toasts…), charts (StockChart, Sparkline),
               effects (Three.js background), widgets (TradingView embeds)
  features/    auth, chat, market, watchlist, catalysts, trades, notifications,
               intel (event cards/lists, calendar, macro), briefing, why, predictions, portfolio, research
  hooks/       useLiveTable (query + realtime), useMarket, useMarketQuery, …
  lib/         env, supabase client, formatting, NYSE market clock, $TICKER parsing
  pages/       Command Center, Briefing, Catalysts, Why, Markets, Watchlist, Research, Compare, Portfolio,
               Predictions, War Room, Messages, Groups, Settings, Stock detail
  providers/   RealtimeProvider (presence, typing, unread, notifications, price alerts)
  services/    market providers (TradingView, Alpha Vantage) + symbol directory + cache; data backend (Supabase, or browser-only local mode)
  store/       zustand stores (auth, settings, realtime, market status, toasts)
  styles/      Tailwind + glass/noise/glow utilities
  types/       strong row types for every table + market types
```

---

## 8. Keyboard & usage tips

- **⌘K / Ctrl+K** or **/** — search everything: tickers, SEC forms (type `8-K`), catalysts, notes, predictions, chat.
- Type **`$MU`** anywhere in chat, comments or notes → clickable ticker chip.
- **@DisplayName** mentions notify your partner.
- Chat: **Enter** send · **Shift+Enter** newline · paste an image to attach · 📈 button shares a live ticker card.
- Chart: drag to pan, wheel/pinch to zoom, **Reset**, **Fullscreen** (Esc exits), **PNG export**, ⭐ watchlist, 🔔 price alert.

## 9. Maintenance notes

- NYSE holidays are listed in `src/lib/marketClock.ts` through 2027 — extend yearly.
- To allow more than two accounts, edit `limit_allowed_emails()` in the SQL.
- Charts use TradingView Lightweight Charts™ (Apache-2.0); the required TradingView attribution logo/link is shown on every chart.

---

## 10. Intelligence release (v3)

**What matters today? Why is this stock moving? Was my thesis actually right?**

| Feature | Where | Data |
|---|---|---|
| Morning Briefing | `/briefing` | Market overview (TradingView live + FRED values), today's US releases (FRED calendar + FOMC dates; times only when the source publishes them), watchlist catalysts, overnight SEC filings with trigger category, 24h watchlist news, simulated portfolio check (**PRICE UNAVAILABLE** without a verified quote provider), upcoming earnings, rules-based high-priority flags (each shows its rule), predictions due, what changed since the last briefing, sources used + timestamps. Stored daily in `briefings`; history by date; **Refresh** is limited to once per 5 minutes. `kind = 'eod'` is reserved for an end-of-day brief using the same pipeline. |
| Why Is It Moving? | `/why`, drawer from any **Why?** button (stock page, watchlist, movers, chat cards, positions, briefing) | Windows 1h/3h/Today/24h/3d/7d. Price action from TradingView (plus provider bars when configured). Evidence tiers **CONFIRMED / STRONGLY RELATED / POSSIBLY RELATED / NO CONFIRMED CATALYST FOUND** with the rule for each item. Tiers describe evidence, never causation; no narrative is generated. |
| Prediction Tracker | `/predictions` | USER PREDICTIONS with confidence as the author's own number (not a probability model). Originals immutable; every edit/resolution logged in `prediction_history`; resolved predictions lock (DB trigger). Scorecard with sample sizes, calibration by confidence band, timeline. A resolution is *suggested* only from real provider bars; the user confirms. |
| Catalyst Intelligence | `/catalysts` | SEC EDGAR (official endpoints; `SEC_USER_AGENT` required), 8-K item triggers, earnings/reports, shareholder meetings, company events (Marketaux), policy (Federal Register + Fed), FDA (openFDA — never mapped to tickers by guessing), saved items, manual catalysts (labelled **Manual catalyst**). Priority / note / bookmark are USER ANALYSIS, stored separately from the source facts. |
| Portfolio Simulator | `/portfolio` | Paper positions only. Average-cost and realized P&L maths run atomically in Postgres (`sim_open_position`, `sim_apply_transaction`). P&L dashboard with n shown on every statistic, trade journal (mistakes, lessons, screenshots), scenario calculator. |
| Research & Compare | `/research/:symbol`, `/compare?symbols=` | Shared thesis sections with history + "last edited by"; source bar (TradingView, SEC, Finviz, Yahoo, Nasdaq; IR only if you saved it). Compare renders TradingView charts/quotes. |
| Markets additions | `/markets` | Screener presets, NEXUS curated lists (labelled), Finviz shortcut links (links only — never scraped), economic calendar, macro dashboard. |
| Alerts & presence | Settings → Notifications | Categories: messages, mentions, watchlist catalyst, new SEC filing, trade/prediction updates, partner-shared catalyst, price alerts. Browser permission is requested only when you click. Presence shows **away** after 5 min idle / 60 s hidden (presence only — typing and away status are never written to the database). |
| Global search | ⌘K / Ctrl+K | Tickers, companies, SEC forms, catalysts, research notes, predictions, trade ideas, chat, and news/filings already loaded. |

**Free-tier budgets.** SEC: responses cached 10 min (tickers map 24 h) in memory and in the shared `intel_cache` table. Marketaux: max 12 tickers per request, per-ticker cache shared by both users with a TTL that scales with ticker count so round-the-clock use stays under ~90 requests/day; a hard guard stops at 95/day and serves the last cached copy with its timestamp. FRED/Federal Register/openFDA: 30–60 min caches. Every panel shows *SOURCE · checked N min ago*, and *Cached copy from …* when serving stale data.
