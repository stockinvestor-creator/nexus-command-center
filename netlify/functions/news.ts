import { secured, intelResponse, status, tickersParam } from '../lib/respond';
import { json } from '../lib/http';
import { marketauxConfigured, newsForTickers } from '../lib/marketaux';

/** GET /.netlify/functions/news?tickers=NVDA,MU — headlines tagged to those tickers (Marketaux). */
export default secured(async (_req, { token, url }) => {
  const tickers = tickersParam(url);
  if (!tickers.length) return json(400, { error: 'tickers required' });
  if (!marketauxConfigured()) return intelResponse([], [status('Marketaux', false, null, 'MARKETAUX_API_KEY is not set in Netlify')]);
  const r = await newsForTickers(tickers, token);
  return intelResponse(r.events, [status('Marketaux', true, r, r.events.length === 0 && r.errors.length ? r.errors[0] : undefined)]);
});
