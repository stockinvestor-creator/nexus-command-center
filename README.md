# NEXUS · Private Market Command Center

A private, two-person, futuristic stock-market command center with realtime chat — built to run at **$0/month** on **Netlify (free)** + **Supabase (free)**, using only free/open-source tools.

- **React 19 + Vite + TypeScript + Tailwind CSS**
- **Framer Motion** for transitions, **Three.js / React Three Fiber** for a lazy-loaded ambient particle scene
- **TradingView Lightweight Charts** for the fully custom chart (not an embed)
- **Supabase** for Auth, Postgres (with Row Level Security), Realtime (chat, presence, typing) and Storage (chat images)
- **Free TradingView widgets** for ticker tape, heatmap, market overview, calendar, news, advanced chart
- **Lucide** icons

> Works immediately with **zero configuration** in Demo Mode (synthetic data, data stored in your browser, two-tab realtime simulation). Connect Supabase to turn it into the real private two-person workspace.

---

## 1. Quick start (local)

```bash
npm install
npm run dev        # http://localhost:5173  → opens the first-run setup guide, then Demo Mode
npm run build      # typecheck + production build into dist/
```

Requires Node 20+ (Netlify is pinned to Node 22 in `netlify.toml`).

**Try realtime in Demo Mode:** open the app in two tabs; in the second tab go to *Settings → Demo identity* and switch to *Operator B*. Chat, reactions, typing indicators, presence and notifications sync between the tabs.

---

## 2. Deploy for $0/month — exact steps

### Step 1 — Create a free Supabase project
1. <https://supabase.com/dashboard> → **New project** → choose the **Free** plan (no credit card).
2. Save the database password somewhere safe.

### Step 2 — Run the SQL migration
1. **SQL Editor → New query** → paste the entire contents of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   It creates all tables, indexes, foreign keys, RLS policies, the whitelist, triggers, RPC functions, the realtime publication and a private `attachments` storage bucket. It is idempotent — safe to re-run after updates.
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

### Step 5 — (Optional) Free market-data key
The app works with DEMO data out of the box. For **real end-of-day** US equity data:
1. Get a free key at <https://www.alphavantage.co/support/#api-key> (25 requests/day, no card).
2. You will add it to Netlify as `MARKET_DATA_API_KEY` (server-side only, see below).

### Step 6 — Deploy on Netlify
1. Push this folder to a GitHub repo.
2. <https://app.netlify.com/start> → **Import from Git** → pick the repo. Build settings come from `netlify.toml`
   (`npm run build`, publish `dist`, functions in `netlify/functions`).
3. **Site configuration → Environment variables** — add:

   | Variable | Value | Notes |
   |---|---|---|
   | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | public |
   | `VITE_SUPABASE_ANON_KEY` | `eyJ...` | public by design (RLS) |
   | `VITE_MARKET_DATA_PROVIDER` | `mock` or `alphavantage` | |
   | `MARKET_DATA_API_KEY` | your Alpha Vantage key | **server-side only**; only if using `alphavantage` |
   | `VITE_MARKET_DATA_API_KEY` | *(leave empty)* | dev-only escape hatch; anything `VITE_` is visible in the browser |

4. **Deploys → Trigger deploy**.
5. Back in Supabase: **Authentication → URL Configuration** → set **Site URL** to your Netlify URL (used by password-reset emails).

Done. Sign in with either account.

---

## 3. Data freshness — what is LIVE, DELAYED, EOD or DEMO

Every market-data component shows a freshness badge.

| Badge | Where it appears | What it means |
|---|---|---|
| **DEMO** | All custom components when `VITE_MARKET_DATA_PROVIDER=mock` | Synthetic data generated in the browser. Realistic-looking, deterministic, **never real prices**. |
| **EOD** | All custom components when using Alpha Vantage free | End-of-day data (last close). Alpha Vantage's free tier does **not** include realtime or 15-min-delayed US equities (those are premium). |
| **DELAYED** | TradingView widgets (ticker tape, heatmap, overview, calendar, news, advanced chart, symbol info) | TradingView's free widgets are real-time for some exchanges and delayed for others (exchange licensing). We label them DELAYED to stay conservative. Their data is displayed as-is — never scraped or fed into our own charts. |
| **LIVE** | Not used by default | Reserved for a genuinely real-time provider if you add one (see §4). |

Other honesty choices:
- **Index cards** show the ETFs **SPY / QQQ / DIA** as clearly-labelled proxies for the S&P 500 / Nasdaq-100 / Dow (index levels themselves require paid licences).
- **Market breadth & sentiment** are computed **only from symbols the app already tracks** (whole directory in Demo; index proxies + your watchlist with a real provider) and say so on the card. They are descriptive, not forecasts.
- **Catalyst / Momentum / Volatility / Risk scores** on stock pages are **entered manually** by you and your partner. The app does not invent financial analysis.
- **Price alerts** are evaluated in the browser against the latest *available* price, so with EOD data they can only trigger after the close.

---

## 4. Switching market-data providers later

The UI talks only to the `MarketDataProvider` interface (`src/services/market/MarketDataProvider.ts`):

```ts
searchSymbols(query)            getQuote(symbol)
getCandles(symbol, timeframe)   getCompanyProfile(symbol)
getMarketMovers()
```

Included implementations:
- `MockMarketDataProvider` — zero-config DEMO data.
- `AlphaVantageProvider` (exported as `FreeMarketDataProvider`) — free tier, EOD.

**Switch:** set `VITE_MARKET_DATA_PROVIDER` and redeploy — or use *Settings → Market Data Status → Provider* to override per browser.

**Add a new provider** (e.g. a paid real-time feed later):
1. Create `src/services/market/YourProvider.ts` implementing `MarketDataProvider`. Set `freshness` honestly (`LIVE` / `DELAYED` / `EOD`), `dailyLimit`, and `refreshIntervalMs`.
2. Wrap network calls with `cached(key, ttlMs, fetcher)` from `requestCache.ts` — you get persistent caching, in-flight de-duplication, call counting and stale-data fallback for free.
3. If it needs a secret key, add a Netlify Function like `netlify/functions/market.ts` and call that instead of the vendor directly.
4. Register it in `build()` and `PROVIDER_OPTIONS` in `src/services/market/index.ts`.

---

## 5. Free-tier safety

| Service | Free allowance (checked Sept 2026) | This app's usage |
|---|---|---|
| Netlify | **300 credits / month**. Production deploy = 15 credits, bandwidth = 20 credits/GB, web requests = 2 credits/10k, functions = 10 credits/GB-hour. If you run out, the site **pauses until next month — you are never charged**. | First load ≈ 0.6 MB gzipped, then assets are cached as immutable → two users use well under 1 GB/month. The market proxy runs only a few times a day and is CDN-cached. **Main cost is deploys: ~20 production deploys/month fit in the free credits**, so batch your changes rather than pushing every small edit. |
| Supabase | 500 MB database, 1 GB file storage, 5 GB egress, 2 active projects; pauses after ~1 week of inactivity | Two users → tiny. One realtime room for presence/typing + a few table subscriptions. Chat images max 5 MB each. |
| Alpha Vantage | 25 requests / day | Quotes and 1M/3M charts share **one** daily-series call per symbol; 6M/1Y/5Y share **one** weekly call; everything cached until the next ~17:00 ET close; local symbol search first; daily budget guard stops at the limit and serves cache |

- No API is polled every second. The DEMO provider refreshes every 20 s (local, no network). Alpha Vantage is fetched only when the cache expires.
- If the API limit is reached or the network fails, the UI **falls back to cached data** and marks it `·CACHED`.
- *Settings → Market Data Status* shows provider, API calls used today, last successful update, data freshness, cache entries/size and hit/miss counts.
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
- Chat content is rendered as text tokens (no `dangerouslySetInnerHTML`). Link previews never fetch the target page (no third-party preview service); YouTube links get a thumbnail.

---

## 7. Project structure

```
supabase/schema.sql          tables, indexes, RLS, whitelist, triggers, RPC, realtime, storage
netlify/functions/market.ts  server-side Alpha Vantage proxy (key stays secret)
netlify.toml                 build, SPA redirects, headers, Node version
src/
  components/  layout (shell, sidebar, top bar, mobile nav, ticker tape, ⌘K palette),
               ui (glass cards, badges, modal, toasts…), charts (StockChart, Sparkline),
               effects (Three.js background), widgets (TradingView embeds)
  features/    auth, chat, market, watchlist, catalysts, trades, notifications
  hooks/       useLiveTable (query + realtime), useMarket, useMarketQuery, …
  lib/         env, supabase client, formatting, NYSE market clock, $TICKER parsing
  pages/       Command Center, Markets, Watchlist, Catalysts, War Room, Messages, Groups, Settings, Stock detail
  providers/   RealtimeProvider (presence, typing, unread, notifications, price alerts)
  services/    market providers + cache; data backend (Supabase or local Demo)
  store/       zustand stores (auth, settings, realtime, market status, toasts)
  styles/      Tailwind + glass/noise/glow utilities
  types/       strong row types for every table + market types
```

---

## 8. Keyboard & usage tips

- **⌘K / Ctrl+K** or **/** — jump to any ticker or page.
- Type **`$MU`** anywhere in chat, comments or notes → clickable ticker chip.
- **@DisplayName** mentions notify your partner.
- Chat: **Enter** send · **Shift+Enter** newline · paste an image to attach · 📈 button shares a live ticker card.
- Chart: drag to pan, wheel/pinch to zoom, **Reset**, **Fullscreen** (Esc exits), **PNG export**, ⭐ watchlist, 🔔 price alert.

## 9. Maintenance notes

- NYSE holidays are listed in `src/lib/marketClock.ts` through 2027 — extend yearly.
- To allow more than two accounts, edit `limit_allowed_emails()` in the SQL.
- Charts use TradingView Lightweight Charts™ (Apache-2.0); the required TradingView attribution logo/link is shown on every chart.
