const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdSmall = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const num2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPrice = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : v < 1 ? usdSmall.format(v) : usd.format(v);

export const fmtNumber = (v: number | null | undefined, digits = 2): string =>
  v == null || !Number.isFinite(v)
    ? '—'
    : digits === 2
      ? num2.format(v)
      : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtCompact = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : compact.format(v);

export const fmtPct = (v: number | null | undefined, withSign = true): string =>
  v == null || !Number.isFinite(v) ? '—' : `${withSign && v > 0 ? '+' : ''}${v.toFixed(2)}%`;

export const fmtChange = (v: number | null | undefined): string =>
  v == null || !Number.isFinite(v) ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`;

export const trendClass = (v: number | null | undefined): string =>
  v == null || v === 0 ? 'text-slate-400' : v > 0 ? 'text-bull' : 'text-bear';

export function timeAgo(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fmtTime(iso: string | number): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function fmtDateTime(iso: string | number): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Formats a YYYY-MM-DD string without timezone drift. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return d;
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Days from today (local) until a YYYY-MM-DD date. Negative = past. */
export function daysUntil(d: string | null | undefined): number | null {
  if (!d) return null;
  const [y, m, day] = d.slice(0, 10).split('-').map(Number);
  if (!y || !m || !day) return null;
  const target = new Date(y, m - 1, day).getTime();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((target - today) / 86400000);
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const parseNum = (s: string): number | null => {
  if (s.trim() === '') return null;
  const n = Number(s.replace(/[$,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};
