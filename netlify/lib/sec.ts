import type { IntelEvent } from '../../src/types/intel';
import { classify8K, classifyForm } from '../../src/types/intel';
import { env } from './env';
import { cached } from './cache';
import { decodeEntities, fetchJson, fetchText, mapLimit, stripTags, UpstreamError } from './http';

/**
 * SEC EDGAR — official endpoints only:
 *   https://www.sec.gov/files/company_tickers.json          ticker → CIK
 *   https://data.sec.gov/submissions/CIK##########.json      per-company filings (filing DATE)
 *   https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&output=atom   latest filings with exact acceptance TIME
 *
 * SEC requires a descriptive User-Agent with contact info (SEC_USER_AGENT) and ≤10 requests/second.
 * Timestamps: the submissions API is used for the filing DATE only; exact times come from the Atom
 * feed, whose timestamps carry an explicit UTC offset. We never guess a time.
 */

const UA = () => env('SEC_USER_AGENT');

export const secConfigured = () => /@/.test(UA());

function headers(): HeadersInit {
  if (!secConfigured()) throw new UpstreamError('SEC EDGAR', 'SEC_USER_AGENT is not set (SEC requires "App name contact@email")');
  return { 'User-Agent': UA(), Accept: 'application/json, application/atom+xml, text/xml' };
}

export const MATERIAL_FORMS = new Set([
  '8-K', '8-K/A', '10-Q', '10-Q/A', '10-K', '10-K/A', '20-F', '6-K', 'S-1', 'S-1/A', 'S-3', 'S-3/A', 'F-1', 'F-3', 'S-4', '425',
  '424B1', '424B2', '424B3', '424B4', '424B5', '424B7', 'DEF 14A', 'DEFA14A', 'PRE 14A', 'DEFM14A', 'PREM14A', 'DEFC14A',
  'SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A', 'SCHEDULE 13D', 'SCHEDULE 13D/A', 'SCHEDULE 13G', 'SCHEDULE 13G/A', 'SC TO-T', 'SC 14D9',
]);

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}
export interface TickerInfo {
  cik: string;
  title: string;
}

export async function tickerMap(token: string | null) {
  const r = await cached('sec:tickers', 24 * 3600, token, async () => {
    const raw = await fetchJson<Record<string, TickerRow>>('SEC EDGAR', 'https://www.sec.gov/files/company_tickers.json', { headers: headers() }, 9000);
    const out: Record<string, TickerInfo> = {};
    for (const row of Object.values(raw)) out[row.ticker.toUpperCase()] = { cik: String(row.cik_str).padStart(10, '0'), title: row.title };
    return out;
  });
  return r.value;
}

let reverse: { src: Record<string, TickerInfo>; map: Map<string, string> } | null = null;
function tickerByCik(map: Record<string, TickerInfo>, cik: string): string | undefined {
  if (!reverse || reverse.src !== map) {
    const m = new Map<string, string>();
    for (const [t, v] of Object.entries(map)) if (!m.has(v.cik)) m.set(v.cik, t);
    reverse = { src: map, map: m };
  }
  return reverse.map.get(cik.padStart(10, '0'));
}

interface Submissions {
  cik: string;
  name: string;
  tickers?: string[];
  sicDescription?: string;
  filings: {
    recent: {
      accessionNumber: string[];
      filingDate: string[];
      form: string[];
      items: string[];
      primaryDocument: string[];
      primaryDocDescription: string[];
    };
  };
}

const archiveUrl = (cik: string, acc: string, doc?: string) => {
  const c = String(Number(cik));
  const a = acc.replace(/-/g, '');
  return doc ? `https://www.sec.gov/Archives/edgar/data/${c}/${a}/${doc}` : `https://www.sec.gov/Archives/edgar/data/${c}/${a}/${acc}-index.htm`;
};

function describe(form: string, company: string, items: string[]) {
  if (form.startsWith('8-K') && items.length) return `${company} filed ${form} (Items ${items.join(', ')})`;
  return `${company} filed ${form}`;
}

export function eventFromFiling(p: { cik: string; company: string; ticker?: string; form: string; accession: string; filingDate: string; items: string[]; doc?: string; docDescription?: string; industry?: string }): IntelEvent {
  const cls = p.form.startsWith('8-K') ? classify8K(p.items) : classifyForm(p.form) ? [classifyForm(p.form)!] : [{ category: 'UNCLASSIFIED' as const, label: p.form, basis: `SEC form type ${p.form}` }];
  return {
    id: `sec:${p.accession}`,
    source: 'SEC EDGAR',
    kind: 'filing',
    tickers: p.ticker ? [p.ticker] : [],
    company: p.company,
    title: describe(p.form, p.company, p.items),
    summary: p.docDescription && p.docDescription !== p.form ? p.docDescription : undefined,
    url: archiveUrl(p.cik, p.accession, p.doc || undefined),
    at: `${p.filingDate}T00:00:00.000Z`,
    atPrecision: 'date',
    form: p.form,
    accession: p.accession,
    items: p.items,
    classifications: cls,
    tags: p.industry ? [p.industry] : undefined,
  };
}

/** Recent material filings for one company (filing dates; up to `limit`). */
export async function companyFilings(ticker: string, token: string | null, limit = 40): Promise<{ events: IntelEvent[]; fetchedAt: number; stale: boolean }> {
  const map = await tickerMap(token);
  const info = map[ticker.toUpperCase()];
  if (!info) return { events: [], fetchedAt: Date.now(), stale: false };
  const r = await cached(`sec:sub:${info.cik}`, 10 * 60, token, async () => {
    const s = await fetchJson<Submissions>('SEC EDGAR', `https://data.sec.gov/submissions/CIK${info.cik}.json`, { headers: headers() }, 9000);
    const rec = s.filings.recent;
    const out: IntelEvent[] = [];
    for (let i = 0; i < rec.form.length && out.length < 80; i++) {
      const form = rec.form[i];
      if (!MATERIAL_FORMS.has(form)) continue;
      out.push(
        eventFromFiling({
          cik: info.cik,
          company: s.name,
          ticker: ticker.toUpperCase(),
          form,
          accession: rec.accessionNumber[i],
          filingDate: rec.filingDate[i],
          items: (rec.items[i] || '').split(',').map((x) => x.trim()).filter(Boolean),
          doc: rec.primaryDocument[i],
          docDescription: rec.primaryDocDescription[i],
          industry: s.sicDescription,
        }),
      );
    }
    return out;
  });
  return { events: r.value.slice(0, limit), fetchedAt: r.fetchedAt, stale: r.stale };
}

/** Latest filings market-wide from the EDGAR "current events" Atom feed (exact acceptance times). */
export async function currentFeed(form: string, token: string | null): Promise<{ events: IntelEvent[]; fetchedAt: number; stale: boolean }> {
  const r = await cached(`sec:current:${form}`, 3 * 60, token, async () => {
    const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${encodeURIComponent(form)}&company=&dateb=&owner=include&start=0&count=100&output=atom`;
    const xml = await fetchText('SEC EDGAR', url, { headers: headers() }, 9000);
    return parseCurrentAtom(xml);
  });
  const map = await tickerMap(token).catch(() => ({}) as Record<string, TickerInfo>);
  const events = r.value.map((e) => {
    const t = e.cik ? tickerByCik(map, e.cik) : undefined;
    return { ...e.event, tickers: t ? [t] : [] };
  });
  return { events, fetchedAt: r.fetchedAt, stale: r.stale };
}

export function parseCurrentAtom(xml: string): { cik: string | null; event: IntelEvent }[] {
  const out: { cik: string | null; event: IntelEvent }[] = [];
  const entries = xml.split('<entry>').slice(1);
  for (const raw of entries) {
    const body = raw.split('</entry>')[0];
    const title = decodeEntities((/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? '').trim());
    const href = /<link[^>]*href="([^"]+)"/.exec(body)?.[1] ?? '';
    const updated = (/<updated>([^<]+)<\/updated>/.exec(body)?.[1] ?? '').trim();
    const summary = stripTags(/<summary[^>]*>([\s\S]*?)<\/summary>/.exec(body)?.[1] ?? '');
    const formTerm = /<category[^>]*term="([^"]+)"/.exec(body)?.[1] ?? '';
    // Title format: "8-K - NVIDIA CORP (0001045810) (Filer)"
    const tm = /^(.+?) - (.+?) \((\d{10})\) \((Filer|Subject|Reporting|Filed by)\)/.exec(title);
    if (!tm || !updated || !href) continue;
    if (tm[4] === 'Reporting' || tm[4] === 'Filed by') continue; // the company is the subject/filer, not the reporter
    const form = formTerm || tm[1];
    const acc = /AccNo:\s*([\d-]{20})/.exec(summary)?.[1] ?? /accession-number=([\d-]{20})/.exec(body)?.[1] ?? '';
    const filed = /Filed:\s*(\d{4}-\d{2}-\d{2})/.exec(summary)?.[1] ?? updated.slice(0, 10);
    const items = [...summary.matchAll(/Item (\d\.\d\d)/g)].map((m) => m[1]);
    const at = new Date(updated);
    if (!acc || Number.isNaN(at.getTime())) continue;
    const ev = eventFromFiling({ cik: tm[3], company: tm[2], form, accession: acc, filingDate: filed, items });
    ev.url = href;
    ev.at = at.toISOString();
    ev.atPrecision = 'time';
    out.push({ cik: tm[3], event: ev });
  }
  return out;
}

/** Filings for several tickers, newest first, with exact times filled in from the live feed where available. */
export async function watchlistFilings(tickers: string[], token: string | null, perTicker = 15) {
  const uniq = [...new Set(tickers.map((t) => t.toUpperCase()))].slice(0, 30);
  const results = await mapLimit(uniq, 4, (t) => companyFilings(t, token, perTicker));
  const events: IntelEvent[] = [];
  let oldest = Date.now();
  let stale = false;
  const errors: string[] = [];
  results.forEach((r) => {
    if (r.status === 'fulfilled') {
      events.push(...r.value.events);
      oldest = Math.min(oldest, r.value.fetchedAt);
      stale = stale || r.value.stale;
    } else errors.push((r.reason as Error).message);
  });
  // upgrade date-only filings with exact acceptance times from the current 8-K feed
  try {
    const feed = await currentFeed('8-K', token);
    const byAcc = new Map(feed.events.map((e) => [e.accession, e]));
    for (const e of events) {
      const hit = e.accession ? byAcc.get(e.accession) : undefined;
      if (hit) {
        e.at = hit.at;
        e.atPrecision = 'time';
      }
    }
  } catch {
    /* times stay date-only */
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return { events, fetchedAt: oldest, stale, errors };
}

/** Look up one filing by CIK + accession (used for SEC link previews). */
export async function filingByAccession(cik: string, accession: string, token: string | null): Promise<{ form: string; company: string; filingDate: string; items: string[] } | null> {
  const padded = cik.padStart(10, '0');
  const r = await cached(`sec:acc:${padded}`, 10 * 60, token, async () => {
    const s = await fetchJson<Submissions>('SEC EDGAR', `https://data.sec.gov/submissions/CIK${padded}.json`, { headers: headers() }, 9000);
    const rec = s.filings.recent;
    const out: Record<string, { form: string; company: string; filingDate: string; items: string[] }> = {};
    for (let i = 0; i < rec.form.length; i++) {
      out[rec.accessionNumber[i]] = { form: rec.form[i], company: s.name, filingDate: rec.filingDate[i], items: (rec.items[i] || '').split(',').map((x) => x.trim()).filter(Boolean) };
    }
    return out;
  });
  return r.value[accession] ?? null;
}
