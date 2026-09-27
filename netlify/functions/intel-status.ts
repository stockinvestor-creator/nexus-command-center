import { secured } from '../lib/respond';
import { json } from '../lib/http';
import { env } from '../lib/env';
import { secConfigured } from '../lib/sec';
import { marketauxConfigured } from '../lib/marketaux';
import { fredConfigured } from '../lib/fred';
import { readDaily } from '../lib/cache';

/** Which server-side sources are configured (booleans only — never returns key values). */
export default secured(async (_req, { token }) =>
  json(200, {
    sec: secConfigured(),
    marketaux: marketauxConfigured(),
    marketauxUsedToday: await readDaily('marketaux', token).catch(() => 0),
    fred: fredConfigured(),
    openfda: true,
    openfdaKey: Boolean(env('OPENFDA_API_KEY')),
    federalRegister: true,
    alphaVantage: Boolean(env('MARKET_DATA_API_KEY')),
    generatedAt: Date.now(),
  }),
);
