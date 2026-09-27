import type { EconomicRelease, MacroSeriesPoint } from '../../src/types/intel';
import { env } from './env';
import { cached } from './cache';
import { fetchJson, UpstreamError } from './http';

/** FRED (St. Louis Fed) — free key required (FRED_API_KEY). */
export const fredConfigured = () => Boolean(env('FRED_API_KEY'));
const base = 'https://api.stlouisfed.org/fred';

interface Obs {
  date: string;
  value: string;
}

async function observations(series: string, limit: number) {
  if (!fredConfigured()) throw new UpstreamError('FRED', 'FRED_API_KEY is not set');
  const qs = new URLSearchParams({ series_id: series, api_key: env('FRED_API_KEY'), file_type: 'json', sort_order: 'desc', limit: String(limit) });
  const r = await fetchJson<{ observations: Obs[] }>('FRED', `${base}/series/observations?${qs}`);
  return r.observations.filter((o) => o.value !== '.').map((o) => ({ date: o.date, value: Number(o.value) }));
}

const SERIES: { id: string; label: string; unit: string; yoy?: boolean }[] = [
  { id: 'FEDFUNDS', label: 'Fed funds rate (effective, monthly)', unit: '%' },
  { id: 'UNRATE', label: 'Unemployment rate', unit: '%' },
  { id: 'CPIAUCSL', label: 'CPI inflation (YoY)', unit: '%', yoy: true },
  { id: 'PCEPI', label: 'PCE inflation (YoY)', unit: '%', yoy: true },
  { id: 'A191RL1Q225SBEA', label: 'Real GDP growth (annualized, q/q)', unit: '%' },
  { id: 'DGS10', label: '10-year Treasury yield', unit: '%' },
  { id: 'DGS2', label: '2-year Treasury yield', unit: '%' },
  { id: 'T10Y2Y', label: '10Y–2Y yield curve', unit: 'pp' },
];

export async function macroDashboard(token: string | null) {
  return cached('fred:dashboard', 6 * 3600, token, async () => {
    const out: MacroSeriesPoint[] = [];
    for (const s of SERIES) {
      const obs = await observations(s.id, s.yoy ? 14 : 2);
      const url = `https://fred.stlouisfed.org/series/${s.id}`;
      if (s.yoy) {
        const yoy = (i: number) => (obs[i] && obs[i + 12] ? ((obs[i].value / obs[i + 12].value - 1) * 100) : null);
        out.push({ id: s.id, label: s.label, unit: s.unit, value: round(yoy(0)), date: obs[0]?.date ?? null, previous: round(yoy(1)), previousDate: obs[1]?.date ?? null, basis: `FRED ${s.id} index; year-over-year % computed by NEXUS from the official index values`, url });
      } else {
        out.push({ id: s.id, label: s.label, unit: s.unit, value: obs[0]?.value ?? null, date: obs[0]?.date ?? null, previous: obs[1]?.value ?? null, previousDate: obs[1]?.date ?? null, basis: `FRED series ${s.id}`, url });
      }
    }
    return out;
  });
}

const round = (n: number | null) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);

/** NEXUS priority rule: releases whose official names match major market-moving reports. */
const HIGH = /(Consumer Price Index|Producer Price|Employment Situation|Gross Domestic Product|Retail Sales|Advance Monthly Sales|Unemployment Insurance Weekly Claims|Personal Income and Outlays|Job Openings|FOMC)/i;

/**
 * FOMC meeting dates as published by the Federal Reserve (federalreserve.gov/monetarypolicy/fomccalendars.htm).
 * The decision is announced on the second day. Update yearly.
 */
const FOMC: [string, string][] = [
  ['2026-01-28', 'Jan 27–28'], ['2026-03-18', 'Mar 17–18'], ['2026-04-29', 'Apr 28–29'], ['2026-06-17', 'Jun 16–17'],
  ['2026-07-29', 'Jul 28–29'], ['2026-09-16', 'Sep 15–16'], ['2026-10-28', 'Oct 27–28'], ['2026-12-09', 'Dec 8–9'],
  ['2027-01-27', 'Jan 26–27'], ['2027-03-17', 'Mar 16–17'], ['2027-04-28', 'Apr 27–28'], ['2027-06-09', 'Jun 8–9'],
  ['2027-07-28', 'Jul 27–28'], ['2027-09-15', 'Sep 14–15'], ['2027-10-27', 'Oct 26–27'], ['2027-12-08', 'Dec 7–8'],
];

export function fomcReleases(from: string, to: string): EconomicRelease[] {
  return FOMC.filter(([d]) => d >= from && d <= to).map(([d, label]) => ({
    id: `fomc:${d}`,
    name: `FOMC rate decision (meeting ${label})`,
    date: d,
    time: 'Statement customarily 2:00 PM ET',
    priority: 'high',
    priorityBasis: 'FOMC decision day',
    source: 'Federal Reserve FOMC calendar',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
  }));
}

export async function releaseCalendar(from: string, to: string, token: string | null) {
  return cached(`fred:releases:${from}:${to}`, 6 * 3600, token, async () => {
    if (!fredConfigured()) throw new UpstreamError('FRED', 'FRED_API_KEY is not set');
    const qs = new URLSearchParams({
      api_key: env('FRED_API_KEY'),
      file_type: 'json',
      realtime_start: from,
      realtime_end: to,
      include_release_dates_with_no_data: 'true',
      sort_order: 'asc',
      limit: '500',
    });
    const r = await fetchJson<{ release_dates: { release_id: number; release_name: string; date: string }[] }>('FRED', `${base}/releases/dates?${qs}`);
    return r.release_dates
      .filter((x) => x.date >= from && x.date <= to)
      .map<EconomicRelease>((x) => ({
        id: `fred:${x.release_id}:${x.date}`,
        name: x.release_name,
        date: x.date,
        time: 'Time not published by source',
        priority: HIGH.test(x.release_name) ? 'high' : 'normal',
        priorityBasis: HIGH.test(x.release_name) ? 'NEXUS rule: major market-moving report' : 'NEXUS rule: standard release',
        source: 'FRED release calendar',
        url: `https://fred.stlouisfed.org/releases/${x.release_id}`,
      }));
  });
}
