/** Central, typed access to environment configuration. Never put secrets in VITE_ vars. */
const trim = (v: string | undefined) => (v ?? '').trim();

export const env = {
  supabaseUrl: trim(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: trim(import.meta.env.VITE_SUPABASE_ANON_KEY),
  /** Public setting only. Provider SECRETS live in Netlify (no VITE_ prefix) and are read by Netlify Functions. */
  marketProvider: (trim(import.meta.env.VITE_MARKET_DATA_PROVIDER) || 'tradingview').toLowerCase(),
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey && /^https?:\/\//.test(env.supabaseUrl),
);

/** localStorage flag: first-run setup wizard has been shown */
export const SETUP_SEEN_KEY = 'ncc.setupSeen';

/** Static demo preview (hash routing, widgets off by default, skip first-run redirect) */
export const isPreviewBuild = import.meta.env.VITE_HASH_ROUTER === 'true';
