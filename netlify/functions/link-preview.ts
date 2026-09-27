import { createHash } from 'node:crypto';
import { secured } from '../lib/respond';
import { json } from '../lib/http';
import { cached } from '../lib/cache';
import { BlockedUrlError, checkUrl, parseMeta, safeFetchHtml } from '../lib/safeFetch';
import { filingByAccession, secConfigured } from '../lib/sec';

/**
 * GET /.netlify/functions/link-preview?url=https://…
 * Returns page metadata only (title, description, site, image). Never article bodies.
 * Special cases: SEC filing links (form/company/filed date from EDGAR), Finviz (no fetching —
 * Finviz is never scraped; the label is derived from the URL itself).
 */
export interface LinkPreview {
  url: string;
  finalUrl: string;
  domain: string;
  kind: 'page' | 'sec' | 'finviz' | 'none';
  title?: string;
  description?: string;
  siteName?: string;
  image?: string;
  sec?: { form: string; company: string; filingDate: string; items: string[] };
}

export default secured(async (_req, { token, url }) => {
  const raw = url.searchParams.get('url') ?? '';
  let u: URL;
  try {
    u = checkUrl(raw);
  } catch (e) {
    return json(400, { error: (e as Error).message });
  }
  const domain = u.hostname.replace(/^www\./, '');
  const key = `lp:${createHash('sha1').update(u.toString()).digest('hex')}`;

  // Finviz: never fetched (no scraping). Describe from the URL only.
  if (/(^|\.)finviz\.com$/i.test(u.hostname)) {
    const t = u.searchParams.get('t');
    const body: LinkPreview = { url: raw, finalUrl: raw, domain, kind: 'finviz', title: t ? `Finviz · ${t.toUpperCase()}` : `Finviz · ${u.pathname.replace(/^\//, '') || 'home'}` };
    return json(200, body);
  }

  // SEC filing: /Archives/edgar/data/<cik>/<accession-no-dashes>/...
  const secM = /(^|\.)sec\.gov$/i.test(u.hostname) ? /\/Archives\/edgar\/data\/(\d{1,10})\/(\d{18})/.exec(u.pathname) : null;
  if (secM && secConfigured()) {
    const accNo = secM[2];
    const accession = `${accNo.slice(0, 10)}-${accNo.slice(10, 12)}-${accNo.slice(12)}`;
    try {
      const f = await filingByAccession(secM[1], accession, token);
      if (f) {
        const body: LinkPreview = { url: raw, finalUrl: raw, domain, kind: 'sec', title: `${f.company} — ${f.form}`, sec: f, description: `Filed ${f.filingDate} · accession ${accession}` };
        return json(200, body);
      }
    } catch {
      /* fall through to a plain link */
    }
  }

  try {
    const r = await cached(key, 6 * 3600, token, async () => {
      const page = await safeFetchHtml(u.toString());
      const m = parseMeta(page.html, page.finalUrl);
      const body: LinkPreview = { url: raw, finalUrl: page.finalUrl, domain, kind: 'page', ...m };
      return body;
    });
    return json(200, r.value);
  } catch (e) {
    const body: LinkPreview = { url: raw, finalUrl: raw, domain, kind: 'none' };
    return json(e instanceof BlockedUrlError ? 400 : 200, e instanceof BlockedUrlError ? { error: e.message } : body);
  }
});
