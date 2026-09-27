import { secured, intelResponse, status, tickersParam } from '../lib/respond';
import { json } from '../lib/http';
import { currentFeed, secConfigured, watchlistFilings } from '../lib/sec';

/**
 * GET /.netlify/functions/sec?action=watchlist&tickers=NVDA,MU      filings for tickers (newest first)
 * GET /.netlify/functions/sec?action=latest&form=8-K                 latest filings market-wide (exact times)
 */
const LATEST_FORMS = new Set(['8-K', '10-Q', '10-K', 'S-1', 'S-3', '424B5', '424B4', '424B3', 'DEF 14A', 'DEFA14A', 'PRE 14A', 'SC 13D', 'SC 13G', 'SCHEDULE 13D', 'SCHEDULE 13G']);

export default secured(async (_req, { token, url }) => {
  const action = url.searchParams.get('action') ?? 'watchlist';
  if (!secConfigured()) return intelResponse([], [status('SEC EDGAR', false, null, 'SEC_USER_AGENT is not set in Netlify (SEC requires "App name contact@email")')]);
  if (action === 'latest') {
    const form = (url.searchParams.get('form') ?? '8-K').toUpperCase();
    if (!LATEST_FORMS.has(form)) return json(400, { error: 'Unsupported form' });
    try {
      const r = await currentFeed(form, token);
      return intelResponse(r.events, [status('SEC EDGAR', true, r)]);
    } catch (e) {
      return intelResponse([], [status('SEC EDGAR', true, null, (e as Error).message)]);
    }
  }
  const tickers = tickersParam(url);
  if (!tickers.length) return json(400, { error: 'tickers required' });
  const r = await watchlistFilings(tickers, token, Number(url.searchParams.get('per') ?? 15) || 15);
  return intelResponse(r.events, [status('SEC EDGAR', true, r, r.events.length === 0 && r.errors.length ? r.errors[0] : undefined)]);
});
