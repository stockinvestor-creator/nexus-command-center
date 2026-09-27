import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { notifyOthers } from '@/features/notifications/api';
import type { Candle } from '@/types/market';
import type { Insert, Patch, Prediction, PredictionDirection, PredictionLinkType, PredictionStatus, PredictionType } from '@/types/db';

export const TYPE_LABEL: Record<PredictionType, string> = {
  price_target: 'Price target',
  direction: 'Direction',
  earnings_reaction: 'Earnings reaction',
  catalyst_outcome: 'Catalyst outcome',
  fda_outcome: 'FDA outcome',
  sec_financing_outcome: 'SEC / financing outcome',
  macro_reaction: 'Macro reaction',
  short_thesis: 'Short thesis',
  long_thesis: 'Long thesis',
  volatility: 'Volatility',
  custom: 'Custom',
};
export const DIRECTION_LABEL: Record<PredictionDirection, string> = { bullish: 'Bullish', bearish: 'Bearish', neutral: 'Neutral', volatility: 'Volatility' };
export const STATUS_META: Record<PredictionStatus, { label: string; tone: 'cyan' | 'green' | 'amber' | 'red' | 'neutral' | 'violet' }> = {
  open: { label: 'OPEN', tone: 'cyan' },
  correct: { label: 'CORRECT', tone: 'green' },
  partial: { label: 'PARTIAL', tone: 'amber' },
  incorrect: { label: 'INCORRECT', tone: 'red' },
  invalidated: { label: 'INVALIDATED', tone: 'violet' },
  expired: { label: 'EXPIRED', tone: 'neutral' },
};
export const LINK_LABEL: Record<PredictionLinkType, string> = {
  trade_idea: 'Trade idea',
  position: 'Simulated position',
  catalyst: 'Catalyst',
  event: 'Event',
  news: 'News',
  filing: 'SEC filing',
  research: 'Research page',
};

const me = () => {
  const u = useAuth.getState().user;
  if (!u) throw new Error('Not signed in');
  return u.id;
};

export type PredictionDraft = Omit<Insert<'predictions'>, 'created_by'>;

export async function createPrediction(d: PredictionDraft, links: { link_type: PredictionLinkType; ref_id: string; label?: string | null; url?: string | null }[] = []) {
  const uid = me();
  const p = await backend.insert('predictions', { ...d, symbol: d.symbol ? d.symbol.toUpperCase() : null, created_by: uid });
  if (links.length) await backend.insertMany('prediction_links', links.map((l) => ({ ...l, prediction_id: p.id, created_by: uid })));
  const name = useAuth.getState().profile?.display_name ?? 'Your partner';
  void notifyOthers({ type: 'trade_update', title: `${name} logged a prediction${p.symbol ? ` on $${p.symbol}` : ''}: ${p.title.slice(0, 80)}`, link: `/predictions?id=${p.id}` });
  return p;
}

/** Edits are only accepted by the database while status = open; the history table records every change. */
export const editPrediction = (id: string, patch: Patch<'predictions'>) => backend.update('predictions', id, patch);

export async function resolvePrediction(p: Prediction, r: { status: Exclude<PredictionStatus, 'open'>; actual_outcome: string; actual_move: number | null; actual_price: number | null; actual_price_source: string | null; resolved_at: string; result_notes: string | null; lesson: string | null }) {
  const out = await backend.update('predictions', p.id, r);
  const name = useAuth.getState().profile?.display_name ?? 'Your partner';
  void notifyOthers({ type: 'trade_update', title: `${name} resolved a prediction as ${STATUS_META[r.status].label}: ${p.title.slice(0, 80)}`, link: `/predictions?id=${p.id}` });
  return out;
}

export const addLink = (predictionId: string, l: { link_type: PredictionLinkType; ref_id: string; label?: string | null; url?: string | null }) => backend.insert('prediction_links', { ...l, prediction_id: predictionId, created_by: me() });
export const removeLink = (id: string) => backend.remove('prediction_links', id);
export const deletePrediction = (id: string) => backend.remove('predictions', id);

/* ───────── auto-evaluation suggestion (only from REAL bars) ───────── */
export interface Suggestion {
  status: 'correct' | 'incorrect' | 'partial';
  actualPrice: number;
  actualMove: number | null;
  basis: string;
}

/**
 * Suggest a result ONLY when the prediction is objectively checkable (price target / direction with a
 * baseline) and real provider bars cover the resolution date. The user must still confirm it.
 */
export function suggestResolution(p: Prediction, bars: Candle[], source: string): Suggestion | null {
  if (!p.symbol || !bars.length) return null;
  const end = p.resolution_date ? Date.parse(`${p.resolution_date}T23:59:59Z`) / 1000 : null;
  const start = Date.parse(`${p.prediction_date}T00:00:00Z`) / 1000;
  const window = bars.filter((b) => b.time >= start && (end == null || b.time <= end));
  if (!window.length) return null;
  const last = window[window.length - 1];
  if (end != null && Date.now() / 1000 < end && last.time < end - 86400 * 4) return null;
  const closeDate = new Date(last.time * 1000).toISOString().slice(0, 10);
  const move = p.baseline_price ? ((last.close - p.baseline_price) / p.baseline_price) * 100 : null;
  const basis = `${source} close ${last.close.toFixed(2)} on ${closeDate}${p.baseline_price ? ` vs baseline ${p.baseline_price.toFixed(2)} (${p.baseline_source ?? 'recorded at creation'})` : ''}`;
  if (p.prediction_type === 'price_target' && p.target_price) {
    const bull = p.direction !== 'bearish';
    const hit = window.some((b) => (bull ? b.high >= p.target_price! : b.low <= p.target_price!));
    const downsideHit = p.downside_price ? window.some((b) => (bull ? b.low <= p.downside_price! : b.high >= p.downside_price!)) : false;
    return { status: hit ? (downsideHit ? 'partial' : 'correct') : 'incorrect', actualPrice: last.close, actualMove: move, basis: `${basis}; target ${hit ? 'touched' : 'not touched'} between ${p.prediction_date} and ${closeDate}${downsideHit ? '; downside level also touched' : ''}` };
  }
  if ((p.prediction_type === 'direction' || p.prediction_type === 'long_thesis' || p.prediction_type === 'short_thesis') && move != null && (p.direction === 'bullish' || p.direction === 'bearish')) {
    const right = p.direction === 'bullish' ? move > 0 : move < 0;
    const exp = p.expected_move ? Math.abs(p.expected_move) : null;
    const status = !right ? 'incorrect' : exp && Math.abs(move) < exp / 2 ? 'partial' : 'correct';
    return { status, actualPrice: last.close, actualMove: move, basis: `${basis}; direction ${right ? 'matched' : 'did not match'}${exp ? `, expected ±${exp}%` : ''}` };
  }
  return null;
}

/* ───────── scorecard maths ───────── */
export const FINAL: PredictionStatus[] = ['correct', 'partial', 'incorrect'];
export interface Bucket {
  key: string;
  n: number;
  correct: number;
  partial: number;
  incorrect: number;
  accuracy: number | null;
  avgConfidence: number | null;
}
/** Accuracy = correct ÷ (correct + partial + incorrect). Partial counted separately, never as a win. */
export function bucket(key: string, list: Prediction[]): Bucket {
  const scored = list.filter((p) => FINAL.includes(p.status));
  const c = scored.filter((p) => p.status === 'correct').length;
  return {
    key,
    n: scored.length,
    correct: c,
    partial: scored.filter((p) => p.status === 'partial').length,
    incorrect: scored.filter((p) => p.status === 'incorrect').length,
    accuracy: scored.length ? (c / scored.length) * 100 : null,
    avgConfidence: scored.length ? scored.reduce((s, p) => s + p.confidence, 0) / scored.length : null,
  };
}
export function groupBy(list: Prediction[], f: (p: Prediction) => string | null): Bucket[] {
  const m = new Map<string, Prediction[]>();
  for (const p of list) {
    const k = f(p);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.entries()].map(([k, v]) => bucket(k, v)).filter((b) => b.n > 0).sort((a, b) => b.n - a.n);
}
export const CONF_BANDS: [number, number][] = [[0, 20], [21, 40], [41, 60], [61, 80], [81, 100]];
export const bandOf = (c: number) => {
  const b = CONF_BANDS.find(([lo, hi]) => c >= lo && c <= hi) ?? CONF_BANDS[CONF_BANDS.length - 1];
  return `${b[0]}–${b[1]}`;
};
export const sideOf = (p: Prediction) => (p.direction === 'bullish' || p.prediction_type === 'long_thesis' ? 'Long / bullish' : p.direction === 'bearish' || p.prediction_type === 'short_thesis' ? 'Short / bearish' : null);
