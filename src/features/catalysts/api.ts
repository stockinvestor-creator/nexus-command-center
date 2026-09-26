import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { notifyOthers } from '@/features/notifications/api';
import type { Catalyst, CatalystBias, CatalystStatus, Impact, Insert, Patch } from '@/types/db';
import type { Tone } from '@/components/ui/Badge';

export type CatalystDraft = Omit<Insert<'catalysts'>, 'created_by'>;

export async function createCatalyst(draft: CatalystDraft): Promise<Catalyst> {
  const u = useAuth.getState();
  if (!u.user) throw new Error('Not signed in');
  const c = await backend.insert('catalysts', { ...draft, created_by: u.user.id });
  await notifyOthers({
    type: 'catalyst',
    title: `New ${c.catalyst_type} catalyst: $${c.symbol}`,
    body: c.headline,
    link: `/catalysts?focus=${c.id}`,
  });
  return c;
}

export const updateCatalyst = (id: string, patch: Patch<'catalysts'>) => backend.update('catalysts', id, patch);
export const deleteCatalyst = (id: string) => backend.remove('catalysts', id);

export const BIAS_META: Record<CatalystBias, { label: string; tone: Tone }> = {
  bullish: { label: 'Bullish', tone: 'green' },
  bearish: { label: 'Bearish', tone: 'red' },
  uncertain: { label: 'Uncertain', tone: 'amber' },
};
export const IMPACT_META: Record<Impact, { label: string; tone: Tone }> = {
  low: { label: 'Low impact', tone: 'neutral' },
  medium: { label: 'Med impact', tone: 'blue' },
  high: { label: 'High impact', tone: 'pink' },
};
export const CAT_STATUS_META: Record<CatalystStatus, { label: string; tone: Tone }> = {
  upcoming: { label: 'Upcoming', tone: 'cyan' },
  active: { label: 'Active', tone: 'green' },
  played_out: { label: 'Played out', tone: 'neutral' },
  invalidated: { label: 'Invalidated', tone: 'red' },
};
