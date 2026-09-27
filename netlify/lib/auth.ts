import { isLocalDev, supabaseAnon, supabaseUrl } from './env';

const verified = new Map<string, number>();

export interface AuthResult {
  ok: boolean;
  /** Caller's Supabase JWT (used to read/write the shared intel_cache under RLS) */
  token: string | null;
}

/**
 * Only signed-in workspace members may use NEXUS functions (protects free API budgets and keys).
 * Local `netlify dev` without Supabase configured is allowed so the app can be developed offline.
 */
export async function authorize(req: Request): Promise<AuthResult> {
  const url = supabaseUrl();
  const anon = supabaseAnon();
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!url || !anon) return { ok: isLocalDev(), token: null };
  if (!token) return { ok: false, token: null };
  const until = verified.get(token);
  if (until && until > Date.now()) return { ok: true, token };
  try {
    const r = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!r.ok) return { ok: false, token: null };
    verified.set(token, Date.now() + 5 * 60_000);
    if (verified.size > 100) verified.delete(verified.keys().next().value as string);
    return { ok: true, token };
  } catch {
    return { ok: false, token: null };
  }
}
