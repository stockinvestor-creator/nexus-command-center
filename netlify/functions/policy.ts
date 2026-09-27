import { secured, intelResponse, status } from '../lib/respond';
import { federalRegister, fedPress } from '../lib/policy';
import type { IntelEvent, IntelSourceStatus } from '../../src/types/intel';

/** GET /.netlify/functions/policy — Federal Register rules/orders by market-relevant agencies + Fed press releases. */
export default secured(async (_req, { token }) => {
  const events: IntelEvent[] = [];
  const sources: IntelSourceStatus[] = [];
  const [fr, fed] = await Promise.allSettled([federalRegister(token), fedPress(token)]);
  if (fr.status === 'fulfilled') {
    events.push(...fr.value.value);
    sources.push(status('Federal Register', true, { fetchedAt: fr.value.fetchedAt, stale: fr.value.stale }));
  } else sources.push(status('Federal Register', true, null, (fr.reason as Error).message));
  if (fed.status === 'fulfilled') {
    events.push(...fed.value.value);
    sources.push(status('Federal Reserve', true, { fetchedAt: fed.value.fetchedAt, stale: fed.value.stale }));
  } else sources.push(status('Federal Reserve', true, null, (fed.reason as Error).message));
  events.sort((a, b) => b.at.localeCompare(a.at));
  return intelResponse(events, sources);
});
