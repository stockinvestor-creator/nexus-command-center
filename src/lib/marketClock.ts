import type { MarketSession } from '@/types/market';

/** NYSE full-day holidays (update yearly: https://www.nyse.com/markets/hours-calendars) */
const HOLIDAYS = new Set([
  '2025-01-01', '2025-01-09', '2025-01-20', '2025-02-17', '2025-04-18', '2025-05-26', '2025-06-19',
  '2025-07-04', '2025-09-01', '2025-11-27', '2025-12-25',
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25', '2026-06-19', '2026-07-03',
  '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31', '2027-06-18', '2027-07-05',
  '2027-09-06', '2027-11-25', '2027-12-24',
]);
/** 1:00 PM ET early closes */
const EARLY_CLOSE = new Set(['2025-07-03', '2025-11-28', '2025-12-24', '2026-11-27', '2026-12-24', '2027-11-26']);

export interface NyParts {
  date: string; // YYYY-MM-DD
  weekday: number; // 0 = Sun
  minutes: number; // minutes since midnight ET
  hh: number;
  mm: number;
  ss: number;
}

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
  hourCycle: 'h23',
});
const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function nyParts(d = new Date()): NyParts {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  const hh = Number(p.hour) % 24;
  const mm = Number(p.minute);
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: WD[p.weekday as string] ?? 0,
    hh,
    mm,
    ss: Number(p.second),
    minutes: hh * 60 + mm,
  };
}

export const isTradingDay = (p: NyParts) => p.weekday !== 0 && p.weekday !== 6 && !HOLIDAYS.has(p.date);

export function marketSession(d = new Date()): MarketSession {
  const p = nyParts(d);
  if (!isTradingDay(p)) return 'closed';
  const close = EARLY_CLOSE.has(p.date) ? 13 * 60 : 16 * 60;
  if (p.minutes >= 4 * 60 && p.minutes < 9 * 60 + 30) return 'pre';
  if (p.minutes >= 9 * 60 + 30 && p.minutes < close) return 'open';
  if (p.minutes >= close && p.minutes < 20 * 60) return 'after';
  return 'closed';
}

export const SESSION_LABEL: Record<MarketSession, string> = {
  pre: 'Pre-Market',
  open: 'Market Open',
  after: 'After Hours',
  closed: 'Market Closed',
};

/**
 * Epoch ms of the next time new end-of-day data is expected (~17:00 ET on the next trading day).
 * Used as the cache expiry for EOD data so we never re-request data that cannot have changed.
 */
export function nextEodRefresh(from = new Date()): number {
  const step = 15 * 60 * 1000;
  let t = from.getTime() + step;
  // walk forward in 15-minute steps (max ~5 days) until we hit 17:00 ET on a trading day
  for (let i = 0; i < 5 * 96; i++, t += step) {
    const p = nyParts(new Date(t));
    if (isTradingDay(p) && p.minutes >= 17 * 60 && p.minutes < 17 * 60 + 15) return t;
  }
  return from.getTime() + 12 * 3600 * 1000;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoFromUtcDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const utcDay = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

/** Is a YYYY-MM-DD date an NYSE trading day? */
export function isTradingDate(date: string): boolean {
  const wd = new Date(utcDay(date)).getUTCDay();
  return wd !== 0 && wd !== 6 && !HOLIDAYS.has(date);
}

export const isEarlyClose = (date: string) => EARLY_CLOSE.has(date);

/** Convert a New York wall-clock time (date + minutes after midnight) to epoch ms. */
export function etToUtcMs(date: string, minutes: number): number {
  const want = utcDay(date) + minutes * 60000;
  const guess = want + 5 * 3600000;
  const p = nyParts(new Date(guess));
  const got = utcDay(p.date) + p.minutes * 60000;
  return guess + (want - got);
}

/** Trading dates (ascending) from `start` through `end` inclusive. */
export function tradingDatesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = utcDay(start), e = utcDay(end); t <= e; t += 86400000) {
    const d = isoFromUtcDay(t);
    if (isTradingDate(d)) out.push(d);
  }
  return out;
}

/** The trading date whose session is current or most recently started. */
export function currentSessionDate(now = new Date()): string {
  const p = nyParts(now);
  if (isTradingDay(p) && p.minutes >= 9 * 60 + 30) return p.date;
  let t = utcDay(p.date) - 86400000;
  for (let i = 0; i < 10; i++, t -= 86400000) {
    const d = isoFromUtcDay(t);
    if (isTradingDate(d)) return d;
  }
  return p.date;
}
