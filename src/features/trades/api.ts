import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { notifyOthers } from '@/features/notifications/api';
import type { Insert, Patch, TradeIdea, TradeReaction, TradeReactionEmoji, TradeStatus } from '@/types/db';

const me = () => {
  const u = useAuth.getState().user;
  if (!u) throw new Error('Not signed in');
  return u.id;
};
const myName = () => useAuth.getState().profile?.display_name ?? 'Someone';

export const STATUS_META: Record<TradeStatus, { label: string; tone: 'neutral' | 'cyan' | 'violet' | 'green' | 'red' | 'amber' | 'blue' }> = {
  watching: { label: 'Watching', tone: 'neutral' },
  planning: { label: 'Planning', tone: 'blue' },
  entered: { label: 'Entered', tone: 'cyan' },
  won: { label: 'Won', tone: 'green' },
  lost: { label: 'Lost', tone: 'red' },
  closed: { label: 'Closed', tone: 'violet' },
  canceled: { label: 'Canceled', tone: 'amber' },
};

export type TradeDraft = Omit<Insert<'trade_ideas'>, 'created_by'>;

export async function createTrade(draft: TradeDraft): Promise<TradeIdea> {
  const uid = me();
  const t = await backend.insert('trade_ideas', { ...draft, created_by: uid });
  await backend.insert('trade_events', { trade_id: t.id, user_id: uid, event_type: 'created', detail: {} });
  await notifyOthers({
    type: 'trade_update',
    title: `${myName()} posted a ${t.direction.toUpperCase()} idea on $${t.symbol}`,
    body: t.thesis?.slice(0, 140) ?? null,
    link: `/war-room?trade=${t.id}`,
  });
  return t;
}

const FIELD_LABELS: Partial<Record<keyof TradeIdea, string>> = {
  symbol: 'ticker', direction: 'direction', entry: 'entry', position_size: 'size', thesis: 'thesis', catalyst: 'catalyst',
  target: 'target', downside: 'downside', stop: 'stop', expected_move: 'expected move', probability: 'probability',
  catalyst_date: 'catalyst date', time_horizon: 'horizon', exit_price: 'exit price',
};

export async function updateTrade(prev: TradeIdea, patch: Patch<'trade_ideas'>): Promise<TradeIdea> {
  const uid = me();
  const next = await backend.update('trade_ideas', prev.id, patch);
  const changed = (Object.keys(patch) as (keyof TradeIdea)[]).filter((k) => k !== 'status' && k !== 'updated_at' && prev[k] !== next[k]);
  if (patch.status && patch.status !== prev.status) {
    await backend.insert('trade_events', { trade_id: prev.id, user_id: uid, event_type: 'status', detail: { from: prev.status, to: patch.status } });
    await notifyOthers({
      type: 'trade_update',
      title: `${myName()} moved $${prev.symbol} → ${STATUS_META[patch.status].label}`,
      link: `/war-room?trade=${prev.id}`,
    });
  }
  if (changed.length) {
    await backend.insert('trade_events', {
      trade_id: prev.id,
      user_id: uid,
      event_type: 'edited',
      detail: { fields: changed.map((k) => FIELD_LABELS[k] ?? String(k)) },
    });
    if (!patch.status) {
      await notifyOthers({ type: 'trade_update', title: `${myName()} updated the $${prev.symbol} idea`, link: `/war-room?trade=${prev.id}` });
    }
  }
  return next;
}

export const deleteTrade = (id: string) => backend.remove('trade_ideas', id);

export async function addTradeComment(trade: TradeIdea, content: string) {
  const uid = me();
  const c = await backend.insert('trade_comments', { trade_id: trade.id, user_id: uid, content });
  await backend.insert('trade_events', { trade_id: trade.id, user_id: uid, event_type: 'comment', detail: { excerpt: content.slice(0, 80) } });
  await notifyOthers({
    type: 'trade_update',
    title: `${myName()} commented on $${trade.symbol}`,
    body: content.slice(0, 140),
    link: `/war-room?trade=${trade.id}`,
  });
  return c;
}

export const deleteTradeComment = (id: string) => backend.remove('trade_comments', id);

export async function toggleTradeReaction(tradeId: string, emoji: TradeReactionEmoji, existing: TradeReaction[]) {
  const uid = me();
  const mine = existing.find((r) => r.trade_id === tradeId && r.user_id === uid && r.emoji === emoji);
  if (mine) await backend.remove('trade_reactions', mine.id);
  else await backend.insert('trade_reactions', { trade_id: tradeId, user_id: uid, emoji });
}

/** Unrealized / realized P&L using whatever quote is available. Position size = shares. */
export function tradePnl(t: TradeIdea, price: number | null | undefined) {
  const exit = t.status === 'won' || t.status === 'lost' || t.status === 'closed' ? t.exit_price ?? null : null;
  const mark = exit ?? price ?? null;
  if (t.entry == null || mark == null) return null;
  const dir = t.direction === 'long' ? 1 : -1;
  const pct = ((mark - t.entry) / t.entry) * 100 * dir;
  const dollars = t.position_size != null ? (mark - t.entry) * t.position_size * dir : null;
  return { pct, dollars, realized: exit != null, mark };
}
