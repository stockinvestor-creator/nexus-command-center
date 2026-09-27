import { secured, intelResponse, status } from '../lib/respond';
import { fdaEvents } from '../lib/fda';

/** GET /.netlify/functions/fda?days=14 — drug recalls and Drugs@FDA approval actions (openFDA). */
export default secured(async (_req, { token, url }) => {
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get('days') ?? 14) || 14));
  try {
    const r = await fdaEvents(days, token);
    return intelResponse(r.value, [status('openFDA', true, { fetchedAt: r.fetchedAt, stale: r.stale })]);
  } catch (e) {
    return intelResponse([], [status('openFDA', true, null, (e as Error).message)]);
  }
});
