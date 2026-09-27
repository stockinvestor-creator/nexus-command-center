import type { IntelEvent } from '../../src/types/intel';
import { env } from './env';
import { cached } from './cache';
import { fetchJson, UpstreamError } from './http';

/**
 * openFDA (free; optional OPENFDA_API_KEY raises limits). Drug recalls (enforcement) and
 * Drugs@FDA approval actions. openFDA reports firms/sponsors, not tickers: NEXUS never guesses a
 * ticker from a company name, so these events carry the firm name only.
 */
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
const iso = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const key = () => (env('OPENFDA_API_KEY') ? `&api_key=${encodeURIComponent(env('OPENFDA_API_KEY'))}` : '');

interface Enforcement {
  recall_number: string;
  reason_for_recall: string;
  recalling_firm: string;
  report_date: string;
  classification: string;
  product_description: string;
  status: string;
}
interface DrugsFda {
  application_number: string;
  sponsor_name: string;
  products?: { brand_name?: string; active_ingredients?: { name: string }[] }[];
  submissions?: { submission_type: string; submission_number: string; submission_status: string; submission_status_date: string; submission_class_code_description?: string }[];
}

async function openfda<T>(url: string): Promise<T[]> {
  try {
    const r = await fetchJson<{ results?: T[] }>('openFDA', url);
    return r.results ?? [];
  } catch (e) {
    // openFDA answers 404 when a search has no matches
    if (e instanceof UpstreamError && e.status === 404) return [];
    throw e;
  }
}

export async function fdaEvents(days: number, token: string | null) {
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  return cached(`fda:${days}`, 3 * 3600, token, async () => {
    const out: IntelEvent[] = [];
    const recalls = await openfda<Enforcement>(
      `https://api.fda.gov/drug/enforcement.json?search=report_date:[${ymd(from)}+TO+${ymd(to)}]&sort=report_date:desc&limit=40${key()}`,
    );
    for (const r of recalls) {
      out.push({
        id: `fda:recall:${r.recall_number}`,
        source: 'openFDA',
        kind: 'regulatory',
        tickers: [],
        company: r.recalling_firm,
        title: `${r.classification} drug recall — ${r.recalling_firm}`,
        summary: `Recall ${r.recall_number}: ${r.reason_for_recall}`.slice(0, 280),
        // FDA Enforcement Report search (the recall number is shown in the card for lookup)
        url: 'https://www.accessdata.fda.gov/scripts/ires/index.cfm',
        at: `${iso(r.report_date)}T00:00:00.000Z`,
        atPrecision: 'date',
        classifications: [{ category: 'FDA', label: 'Drug recall', basis: `openFDA enforcement report (${r.classification}, ${r.status})` }],
        tags: ['recall'],
      });
    }
    const approvals = await openfda<DrugsFda>(
      `https://api.fda.gov/drug/drugsfda.json?search=submissions.submission_status_date:[${ymd(from)}+TO+${ymd(to)}]+AND+submissions.submission_status:"AP"&limit=50${key()}`,
    );
    for (const a of approvals) {
      for (const s of a.submissions ?? []) {
        if (s.submission_status !== 'AP' || s.submission_status_date < ymd(from)) continue;
        const brand = a.products?.[0]?.brand_name ?? a.application_number;
        const kind = s.submission_type === 'ORIG' ? 'Original approval' : 'Supplement approval';
        out.push({
          id: `fda:ap:${a.application_number}:${s.submission_number}:${s.submission_type}`,
          source: 'openFDA',
          kind: 'regulatory',
          tickers: [],
          company: a.sponsor_name,
          title: `FDA ${kind.toLowerCase()}: ${brand} (${a.sponsor_name})`,
          summary: s.submission_class_code_description ? `Submission class: ${s.submission_class_code_description}` : undefined,
          url: `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${a.application_number.replace(/\D/g, '')}`,
          at: `${iso(s.submission_status_date)}T00:00:00.000Z`,
          atPrecision: 'date',
          classifications: [{ category: 'FDA', label: kind, basis: `Drugs@FDA submission ${s.submission_type} ${s.submission_number} status AP` }],
          tags: ['approval'],
        });
      }
    }
    return out.sort((x, y) => y.at.localeCompare(x.at));
  });
}
