import { useMemo } from 'react';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import type { NotificationType } from '@/types/db';

export const PREF_KEYS = ['messages', 'mentions', 'watchlist_catalyst', 'sec_filing', 'trade_update', 'partner_catalyst', 'price_alert'] as const;
export type PrefKey = (typeof PREF_KEYS)[number];

export const PREF_META: Record<PrefKey, { label: string; description: string }> = {
  messages: { label: 'New messages', description: 'Channel and DM messages from your partner' },
  mentions: { label: 'Mentions', description: '@mentions and $ticker mentions of your watchlist' },
  watchlist_catalyst: { label: 'Watchlist catalyst', description: 'Ticker-tagged news in a material category (management change, offering, FDA, earnings, regulatory…)' },
  sec_filing: { label: 'New SEC filing', description: 'A new 8-K / offering / proxy / 13D filing on a watched ticker' },
  trade_update: { label: 'Trade & prediction updates', description: 'New trade ideas, status changes, predictions logged or resolved' },
  partner_catalyst: { label: 'Partner-shared catalyst', description: 'Your partner shares a catalyst or filing to chat' },
  price_alert: { label: 'Price alerts', description: 'Your price alerts (needs a verified quote provider)' },
};

export const DEFAULT_PREFS: Record<PrefKey, boolean> = { messages: true, mentions: true, watchlist_catalyst: true, sec_filing: true, trade_update: true, partner_catalyst: true, price_alert: true };

export const prefForType = (t: NotificationType): PrefKey | null =>
  t === 'message' ? 'messages' : t === 'mention' || t === 'ticker_mention' ? 'mentions' : t === 'catalyst' ? 'partner_catalyst' : t === 'trade_update' ? 'trade_update' : t === 'price_alert' ? 'price_alert' : null;

/** Current user's notification preferences (row created on first change). */
export function useNotificationPrefs() {
  const uid = useAuth((s) => s.user?.id);
  const t = useLiveTable(uid ? 'notification_prefs' : null, { eq: { user_id: uid ?? '' } });
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...((t.rows[0]?.prefs ?? {}) as Partial<Record<PrefKey, boolean>>) }), [t.rows]);
  const set = async (k: PrefKey, v: boolean) => {
    if (!uid) return;
    await backend.upsert('notification_prefs', { user_id: uid, prefs: { ...prefs, [k]: v } }, ['user_id']);
  };
  return { prefs, set, loading: t.loading };
}
