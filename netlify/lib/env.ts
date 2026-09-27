/** Server-side environment access (Netlify Functions only — never bundled into the browser). */
export const env = (k: string): string => ((typeof process !== 'undefined' ? process.env[k] : undefined) ?? '').trim();

export const supabaseUrl = () => (env('VITE_SUPABASE_URL') || env('SUPABASE_URL')).replace(/\/$/, '');
export const supabaseAnon = () => env('VITE_SUPABASE_ANON_KEY') || env('SUPABASE_ANON_KEY');
/** `netlify dev` sets NETLIFY_DEV=true */
export const isLocalDev = () => env('NETLIFY_DEV') === 'true';
