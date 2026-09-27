import { secured } from '../lib/respond';
import { json } from '../lib/http';
import { fomcReleases, fredConfigured, macroDashboard, releaseCalendar } from '../lib/fred';

/**
 * GET /.netlify/functions/macro?action=dashboard            key US macro series (FRED)
 * GET /.netlify/functions/macro?action=calendar&from&to     scheduled releases (FRED) + FOMC dates (Federal Reserve)
 */
const isDate = (s: string | null) => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

export default secured(async (_req, { token, url }) => {
  const action = url.searchParams.get('action') ?? 'dashboard';
  if (action === 'calendar') {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!isDate(from) || !isDate(to)) return json(400, { error: 'from/to must be YYYY-MM-DD' });
    const fomc = fomcReleases(from!, to!);
    if (!fredConfigured()) return json(200, { releases: fomc, sources: [{ source: 'FRED', configured: false, ok: false, checkedAt: null, error: 'FRED_API_KEY is not set in Netlify' }, { source: 'Federal Reserve FOMC calendar', configured: true, ok: true, checkedAt: Date.now() }], generatedAt: Date.now() });
    try {
      const r = await releaseCalendar(from!, to!, token);
      const releases = [...r.value, ...fomc].sort((a, b) => a.date.localeCompare(b.date) || (a.priority === 'high' ? -1 : 1));
      return json(200, { releases, sources: [{ source: 'FRED', configured: true, ok: !r.stale, checkedAt: r.fetchedAt, error: r.stale ? 'Showing cached calendar' : undefined }, { source: 'Federal Reserve FOMC calendar', configured: true, ok: true, checkedAt: Date.now() }], generatedAt: Date.now() });
    } catch (e) {
      return json(200, { releases: fomc, sources: [{ source: 'FRED', configured: true, ok: false, checkedAt: null, error: (e as Error).message }, { source: 'Federal Reserve FOMC calendar', configured: true, ok: true, checkedAt: Date.now() }], generatedAt: Date.now() });
    }
  }
  if (!fredConfigured()) return json(200, { series: [], sources: [{ source: 'FRED', configured: false, ok: false, checkedAt: null, error: 'FRED_API_KEY is not set in Netlify' }], generatedAt: Date.now() });
  try {
    const r = await macroDashboard(token);
    return json(200, { series: r.value, sources: [{ source: 'FRED', configured: true, ok: !r.stale, checkedAt: r.fetchedAt, error: r.stale ? 'Showing cached data' : undefined }], generatedAt: Date.now() });
  } catch (e) {
    return json(200, { series: [], sources: [{ source: 'FRED', configured: true, ok: false, checkedAt: null, error: (e as Error).message }], generatedAt: Date.now() });
  }
});
