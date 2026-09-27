/**
 * Normalized "intelligence event" model shared by the Netlify Functions (server) and the app.
 * Every event comes from a real, named source and links back to it. Nothing here is generated.
 *
 * This file must stay dependency-free (no "@/..." imports): Netlify Functions import it directly.
 */

export type IntelSource =
  | 'SEC EDGAR'
  | 'Marketaux'
  | 'openFDA'
  | 'Federal Register'
  | 'Federal Reserve'
  | 'FRED'
  | 'Alpha Vantage';

export type IntelKind = 'filing' | 'news' | 'regulatory' | 'policy' | 'macro' | 'earnings_date';

export type IntelCategory =
  | 'EARNINGS'
  | 'PERIODIC_REPORT'
  | 'MANAGEMENT'
  | 'FINANCING'
  | 'OFFERING'
  | 'M_AND_A'
  | 'LEGAL_REGULATORY'
  | 'CYBER'
  | 'OPERATIONAL'
  | 'RESTRUCTURING'
  | 'MATERIAL_AGREEMENT'
  | 'SHAREHOLDER'
  | 'OWNERSHIP'
  | 'GOVERNANCE'
  | 'FDA'
  | 'POLICY'
  | 'MACRO'
  | 'OTHER_MATERIAL'
  | 'UNCLASSIFIED'
  | 'NEWS';

export const CATEGORY_LABEL: Record<IntelCategory, string> = {
  EARNINGS: 'Earnings',
  PERIODIC_REPORT: 'Quarterly / annual report',
  MANAGEMENT: 'Management change',
  FINANCING: 'Financing',
  OFFERING: 'Offering / dilution',
  M_AND_A: 'M&A',
  LEGAL_REGULATORY: 'Government / legal',
  CYBER: 'Cyber / breach',
  OPERATIONAL: 'Operational',
  RESTRUCTURING: 'Restructuring',
  MATERIAL_AGREEMENT: 'Material agreement',
  SHAREHOLDER: 'Shareholder meeting / vote',
  OWNERSHIP: 'Ownership (13D/13G)',
  GOVERNANCE: 'Governance',
  FDA: 'FDA / regulatory',
  POLICY: 'Policy',
  MACRO: 'Macro',
  OTHER_MATERIAL: 'Other material event',
  UNCLASSIFIED: 'Unclassified material event',
  NEWS: 'News',
};

/**
 * A classification ALWAYS carries its basis, so the UI can show exactly why NEXUS put an event
 * in a bucket (e.g. "SEC 8-K Item 5.02" or "Headline keyword: “resigns”") — distinct from the raw source.
 */
export interface IntelClassification {
  category: IntelCategory;
  label: string;
  basis: string;
}

export interface IntelEvent {
  /** Stable id, e.g. "sec:0001045810-26-000123" or "mx:<uuid>" */
  id: string;
  source: IntelSource;
  /** Publisher when the source is an aggregator (e.g. "reuters.com via Marketaux") */
  publisher?: string;
  kind: IntelKind;
  tickers: string[];
  company?: string;
  title: string;
  /** Short snippet ONLY when the provider supplies one (never full article text) */
  summary?: string;
  url: string;
  /** ISO timestamp of publication/filing */
  at: string;
  /** Precision of `at`: "time" when the source states an exact time, "date" when only the date is known */
  atPrecision: 'time' | 'date';
  form?: string;
  accession?: string;
  /** SEC 8-K item numbers as reported by EDGAR, e.g. ["2.02","9.01"] */
  items?: string[];
  classifications: IntelClassification[];
  /** Industry / agency tags where the source provides them */
  tags?: string[];
}

export interface IntelSourceStatus {
  source: IntelSource | string;
  ok: boolean;
  /** When NEXUS last successfully retrieved from this source (epoch ms) */
  checkedAt: number | null;
  error?: string;
  configured: boolean;
}

export interface IntelResponse {
  events: IntelEvent[];
  sources: IntelSourceStatus[];
  /** Server time the response was assembled (epoch ms) */
  generatedAt: number;
}

export interface MacroSeriesPoint {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  date: string | null;
  previous: number | null;
  previousDate: string | null;
  /** How NEXUS derived the value, e.g. "FRED CPIAUCSL, year-over-year % computed from index" */
  basis: string;
  url: string;
}

export interface EconomicRelease {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  /** "time not published by source" when unknown */
  time?: string;
  /** NEXUS priority rule (not a provider rating) */
  priority: 'high' | 'normal';
  priorityBasis: string;
  source: 'FRED release calendar' | 'Federal Reserve FOMC calendar';
  url: string;
}

export interface EarningsDate {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding?: string;
  estimate?: number | null;
  currency?: string;
  source: 'Alpha Vantage';
}

/** SEC 8-K items → categories. Source: SEC Form 8-K General Instructions (official item list). */
export const SEC_8K_ITEMS: Record<string, { title: string; category: IntelCategory }> = {
  '1.01': { title: 'Entry into a Material Definitive Agreement', category: 'MATERIAL_AGREEMENT' },
  '1.02': { title: 'Termination of a Material Definitive Agreement', category: 'OPERATIONAL' },
  '1.03': { title: 'Bankruptcy or Receivership', category: 'RESTRUCTURING' },
  '1.04': { title: 'Mine Safety — Reporting of Shutdowns and Patterns of Violations', category: 'OPERATIONAL' },
  '1.05': { title: 'Material Cybersecurity Incidents', category: 'CYBER' },
  '2.01': { title: 'Completion of Acquisition or Disposition of Assets', category: 'M_AND_A' },
  '2.02': { title: 'Results of Operations and Financial Condition', category: 'EARNINGS' },
  '2.03': { title: 'Creation of a Direct Financial Obligation', category: 'FINANCING' },
  '2.04': { title: 'Triggering Events That Accelerate a Financial Obligation', category: 'FINANCING' },
  '2.05': { title: 'Costs Associated with Exit or Disposal Activities', category: 'RESTRUCTURING' },
  '2.06': { title: 'Material Impairments', category: 'OTHER_MATERIAL' },
  '3.01': { title: 'Notice of Delisting or Failure to Satisfy a Listing Rule', category: 'LEGAL_REGULATORY' },
  '3.02': { title: 'Unregistered Sales of Equity Securities', category: 'FINANCING' },
  '3.03': { title: 'Material Modification to Rights of Security Holders', category: 'GOVERNANCE' },
  '4.01': { title: "Changes in Registrant's Certifying Accountant", category: 'GOVERNANCE' },
  '4.02': { title: 'Non-Reliance on Previously Issued Financial Statements', category: 'OTHER_MATERIAL' },
  '5.01': { title: 'Changes in Control of Registrant', category: 'M_AND_A' },
  '5.02': { title: 'Departure/Election of Directors or Officers; Compensatory Arrangements', category: 'MANAGEMENT' },
  '5.03': { title: 'Amendments to Articles of Incorporation or Bylaws', category: 'GOVERNANCE' },
  '5.04': { title: "Temporary Suspension of Trading Under Employee Benefit Plans", category: 'GOVERNANCE' },
  '5.05': { title: 'Amendments to Code of Ethics', category: 'GOVERNANCE' },
  '5.06': { title: 'Change in Shell Company Status', category: 'OTHER_MATERIAL' },
  '5.07': { title: 'Submission of Matters to a Vote of Security Holders', category: 'SHAREHOLDER' },
  '5.08': { title: 'Shareholder Director Nominations', category: 'SHAREHOLDER' },
  '6.01': { title: 'ABS Informational and Computational Material', category: 'OTHER_MATERIAL' },
  '7.01': { title: 'Regulation FD Disclosure', category: 'OTHER_MATERIAL' },
  '8.01': { title: 'Other Events', category: 'OTHER_MATERIAL' },
  '9.01': { title: 'Financial Statements and Exhibits', category: 'UNCLASSIFIED' },
};

/** Form type → category (applies to the form itself, not its content). */
export function classifyForm(form: string): IntelClassification | null {
  const f = form.toUpperCase();
  const c = (category: IntelCategory, label: string) => ({ category, label, basis: `SEC form type ${form}` });
  if (f === '10-Q' || f === '10-K' || f === '10-Q/A' || f === '10-K/A' || f === '20-F' || f === '40-F') return c('PERIODIC_REPORT', f.startsWith('10-Q') ? 'Quarterly report' : 'Annual report');
  if (f.startsWith('S-1') || f.startsWith('S-3') || f.startsWith('F-1') || f.startsWith('F-3')) return c('OFFERING', 'Registration statement');
  if (f.startsWith('424B')) return c('OFFERING', 'Prospectus (offering)');
  if (f === 'DEF 14A' || f === 'DEFA14A' || f === 'PRE 14A' || f === 'DEFM14A' || f === 'PREM14A' || f === 'DEFC14A') return c('SHAREHOLDER', f.includes('M14A') ? 'Merger proxy' : 'Proxy statement');
  if (f.startsWith('SC 13D') || f.startsWith('SCHEDULE 13D') || f === '13D') return c('OWNERSHIP', 'Activist / 5%+ ownership (13D)');
  if (f.startsWith('SC 13G') || f.startsWith('SCHEDULE 13G') || f === '13G') return c('OWNERSHIP', 'Passive 5%+ ownership (13G)');
  if (f === 'SC TO-T' || f === 'SC 14D9' || f === 'S-4' || f === '425') return c('M_AND_A', 'M&A-related filing');
  return null;
}

/** 8-K items → classifications (basis = the SEC item number itself). */
export function classify8K(items: string[]): IntelClassification[] {
  const out: IntelClassification[] = [];
  for (const raw of items) {
    const it = raw.trim();
    const def = SEC_8K_ITEMS[it];
    if (!def || it === '9.01') continue; // 9.01 = exhibits only
    out.push({ category: def.category, label: def.title, basis: `SEC 8-K Item ${it}` });
  }
  if (!out.length) out.push({ category: 'UNCLASSIFIED', label: 'Unclassified material event', basis: items.length ? `SEC 8-K items ${items.join(', ')}` : 'SEC 8-K (no item numbers reported)' });
  return out;
}

/**
 * Headline keyword rules for NEWS. Conservative: a match only says the headline CONTAINS the
 * words; the basis shows the exact keyword so users see it is text matching, not a verified fact.
 */
const NEWS_RULES: { category: IntelCategory; label: string; re: RegExp }[] = [
  { category: 'MANAGEMENT', label: 'Executive change mentioned', re: /\b(resign(s|ed|ation)?|steps? down|ousted|appoint(s|ed)|names? (new )?(ceo|cfo|chief)|ceo (exit|departure))\b/i },
  { category: 'OFFERING', label: 'Offering mentioned', re: /\b(public offering|registered direct|private placement|at-the-market|atm (offering|program)|priced .* offering|share sale)\b/i },
  { category: 'FINANCING', label: 'Financing mentioned', re: /\b(convertible notes?|notes offering|credit facility|term loan|debt financing|raises \$)\b/i },
  { category: 'M_AND_A', label: 'M&A mentioned', re: /\b(to acquire|acquisition of|acquires|merger|to merge|buyout|takeover|tender offer)\b/i },
  { category: 'LEGAL_REGULATORY', label: 'Legal / regulatory mentioned', re: /\b(lawsuit|sues|sued|class action|investigation|probe|subpoena|settle(s|ment)|fined?|penalt(y|ies)|antitrust|indict(ed|ment))\b/i },
  { category: 'CYBER', label: 'Cyber incident mentioned', re: /\b(data breach|cyber ?attack|ransomware|hack(ed|ers)?|security incident)\b/i },
  { category: 'OPERATIONAL', label: 'Operational event mentioned', re: /\b(recall(s|ed)?|plant (fire|explosion|shutdown)|halts? production|outage|contract (win|awarded|loss|terminated))\b/i },
  { category: 'RESTRUCTURING', label: 'Restructuring mentioned', re: /\b(layoffs?|job cuts|restructur(e|ing)|bankruptcy|chapter 11|going concern)\b/i },
  { category: 'FDA', label: 'FDA mentioned', re: /\b(fda|pdufa|complete response letter|crl|clinical hold|phase (1|2|3|i|ii|iii) (trial|data|results))\b/i },
  { category: 'EARNINGS', label: 'Earnings mentioned', re: /\b(earnings|quarterly results|q[1-4] (results|revenue|profit)|guidance|eps)\b/i },
];

export function classifyHeadline(title: string): IntelClassification[] {
  const out: IntelClassification[] = [];
  for (const r of NEWS_RULES) {
    const m = r.re.exec(title);
    if (m) out.push({ category: r.category, label: r.label, basis: `Headline keyword: “${m[0]}”` });
  }
  return out.length ? out : [{ category: 'NEWS', label: 'News', basis: 'Provider-tagged to ticker' }];
}
