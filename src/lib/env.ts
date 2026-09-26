/** Central, typed access to environment configuration. Never put secrets in VITE_ vars. */
const trim = (v: string | undefined) => (v ?? '').trim();

export const env = {
  supabaseUrl: trim(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: trim(import.meta.env.VITE_SUPABASE_ANON_KEY),
  marketProvider: (trim(import.meta.env.VITE_MARKET_DATA_PROVIDER) || 'mock').toLowerCase(),
  /** Dev-only convenience. On Netlify use the server-side MARKET_DATA_API_KEY instead. */
  marketApiKey: trim(import.meta.env.VITE_MARKET_DATA_API_KEY),
};

export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey && /^https?:\/\//.test(env.supabaseUrl),
);

/** localStorage flag: first-run setup wizard has been shown */
export const SETUP_SEEN_KEY = 'ncc.setupSeen';
