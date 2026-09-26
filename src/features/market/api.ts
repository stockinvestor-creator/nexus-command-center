import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import type { TickerNote } from '@/types/db';

export type ScoreKey = 'catalyst_score' | 'momentum_score' | 'volatility_score' | 'risk_score';

export async function saveTickerNote(symbol: string, patch: Partial<Pick<TickerNote, 'thesis' | ScoreKey>>): Promise<TickerNote> {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  return backend.upsert('ticker_notes', { symbol: symbol.toUpperCase(), ...patch, updated_by: uid }, ['symbol']);
}

export async function createPriceAlert(symbol: string, condition: 'above' | 'below', price: number) {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  return backend.insert('price_alerts', { user_id: uid, symbol: symbol.toUpperCase(), condition, price });
}

export const deletePriceAlert = (id: string) => backend.remove('price_alerts', id);
export const rearmPriceAlert = (id: string) => backend.update('price_alerts', id, { active: true, triggered_at: null });
