import type { IntelEvent } from '../../src/types/intel';
import { cached } from './cache';
import { decodeEntities, fetchJson, fetchText, stripTags } from './http';

/**
 * Official policy / regulatory sources (no keys needed):
 *   Federal Register API (rules, proposed rules, presidential documents, notices by agency)
 *   Federal Reserve press-release RSS
 */
export const POLICY_AGENCIES: { slug: string; name: string; sectors: string[] }[] = [
  { slug: 'securities-and-exchange-commission', name: 'SEC', sectors: ['Financials', 'Crypto'] },
  { slug: 'food-and-drug-administration', name: 'FDA', sectors: ['Healthcare', 'Biotechnology', 'Pharmaceuticals'] },
  { slug: 'industry-and-security-bureau', name: 'Commerce BIS (export controls)', sectors: ['Semiconductors', 'Hardware', 'Technology'] },
  { slug: 'trade-representative-office-of-united-states', name: 'USTR (tariffs / trade)', sectors: ['Industrials', 'Consumer', 'Technology'] },
  { slug: 'foreign-assets-control-office', name: 'Treasury OFAC (sanctions)', sectors: ['Energy', 'Financials'] },
  { slug: 'federal-reserve-system', name: 'Federal Reserve', sectors: ['Financials', 'Banks'] },
  { slug: 'energy-department', name: 'Department of Energy', sectors: ['Energy', 'Oil & gas'] },
  { slug: 'centers-for-medicare-medicaid-services', name: 'CMS', sectors: ['Managed care', 'Healthcare'] },
  { slug: 'defense-department', name: 'Department of Defense', sectors: ['Defense', 'Aerospace'] },
  { slug: 'federal-trade-commission', name: 'FTC (competition)', sectors: ['Internet', 'Software', 'Retail'] },
];

interface FrDoc {
  document_number: string;
  title: string;
  type: string;
  abstract?: string | null;
  html_url: string;
  publication_date: string;
  agencies?: { slug?: string; name?: string }[];
}

function toEvent(d: FrDoc): IntelEvent {
  const agencies = (d.agencies ?? []).map((a) => a.slug ?? '').filter(Boolean);
  const matched = POLICY_AGENCIES.filter((a) => agencies.includes(a.slug));
  return {
    id: `fr:${d.document_number}`,
    source: 'Federal Register',
    kind: 'policy',
    tickers: [],
    company: (d.agencies ?? []).map((a) => a.name).filter(Boolean).join(', ') || undefined,
    title: d.title,
    summary: d.abstract ? (d.abstract.length > 280 ? `${d.abstract.slice(0, 277)}…` : d.abstract) : undefined,
    url: d.html_url,
    at: `${d.publication_date}T00:00:00.000Z`,
    atPrecision: 'date',
    classifications: [{ category: 'POLICY', label: d.type, basis: `Federal Register document type “${d.type}”` }],
    tags: [...new Set(matched.flatMap((a) => [a.name, ...a.sectors]))],
  };
}

export async function federalRegister(token: string | null) {
  return cached('policy:fr', 60 * 60, token, async () => {
    const qs = new URLSearchParams({ per_page: '60', order: 'newest' });
    for (const t of ['RULE', 'PRORULE', 'PRESDOCU']) qs.append('conditions[type][]', t);
    for (const a of POLICY_AGENCIES) qs.append('conditions[agencies][]', a.slug);
    for (const f of ['document_number', 'title', 'type', 'abstract', 'html_url', 'publication_date', 'agencies']) qs.append('fields[]', f);
    let docs: FrDoc[];
    try {
      docs = (await fetchJson<{ results?: FrDoc[] }>('Federal Register', `https://www.federalregister.gov/api/v1/documents.json?${qs}`)).results ?? [];
    } catch {
      // fall back to the unfiltered newest documents and filter by agency locally
      const q2 = new URLSearchParams({ per_page: '100', order: 'newest' });
      for (const f of ['document_number', 'title', 'type', 'abstract', 'html_url', 'publication_date', 'agencies']) q2.append('fields[]', f);
      const all = (await fetchJson<{ results?: FrDoc[] }>('Federal Register', `https://www.federalregister.gov/api/v1/documents.json?${q2}`)).results ?? [];
      const slugs = new Set(POLICY_AGENCIES.map((a) => a.slug));
      docs = all.filter((d) => (d.agencies ?? []).some((a) => a.slug && slugs.has(a.slug)));
    }
    return docs.map(toEvent);
  });
}

export async function fedPress(token: string | null) {
  return cached('policy:fed', 30 * 60, token, async () => {
    const xml = await fetchText('Federal Reserve', 'https://www.federalreserve.gov/feeds/press_all.xml');
    const out: IntelEvent[] = [];
    for (const raw of xml.split('<item>').slice(1)) {
      const body = raw.split('</item>')[0];
      const title = decodeEntities((/<title>([\s\S]*?)<\/title>/.exec(body)?.[1] ?? '').trim());
      const link = decodeEntities((/<link>([\s\S]*?)<\/link>/.exec(body)?.[1] ?? '').trim());
      const pub = (/<pubDate>([\s\S]*?)<\/pubDate>/.exec(body)?.[1] ?? '').trim();
      const desc = stripTags(/<description>([\s\S]*?)<\/description>/.exec(body)?.[1] ?? '');
      const d = new Date(pub);
      if (!title || !link || Number.isNaN(d.getTime())) continue;
      out.push({
        id: `fed:${link}`,
        source: 'Federal Reserve',
        kind: 'policy',
        tickers: [],
        company: 'Federal Reserve',
        title,
        summary: desc ? desc.slice(0, 280) : undefined,
        url: link,
        at: d.toISOString(),
        atPrecision: 'time',
        classifications: [{ category: /monetary policy|fomc/i.test(title) ? 'MACRO' : 'POLICY', label: 'Federal Reserve press release', basis: 'Federal Reserve press-release feed' }],
        tags: ['Federal Reserve', 'Financials', 'Banks'],
      });
    }
    return out.slice(0, 40);
  });
}
