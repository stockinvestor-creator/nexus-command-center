import { useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useRealtime } from '@/store/realtimeStore';
import { toast } from '@/store/toastStore';
import { showBrowserNotification } from '@/features/notifications/api';
import { usePriceAlertWatcher } from '@/features/market/usePriceAlertWatcher';

/**
 * One realtime room for the whole workspace (presence + typing), plus global listeners for
 * unread counts and notifications. Keeps Supabase Realtime usage to a handful of channels.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const profile = useAuth((s) => s.profile);
  const userId = useAuth((s) => s.user?.id);
  const location = useLocation();

  // presence + typing
  useEffect(() => {
    if (!profile) return;
    const room = backend.joinRoom({
      id: profile.id,
      name: profile.display_name,
      color: profile.avatar_color,
      online_at: new Date().toISOString(),
    });
    const st = useRealtime.getState();
    st.setRoom(room);
    const offP = room.onPresence((u) => useRealtime.getState().setOnline(u));
    const offT = room.onTyping((e) =>
      useRealtime.getState().addTyping(e.channelId, { userId: e.userId, name: e.name, at: Date.now() }),
    );
    const prune = window.setInterval(() => useRealtime.getState().pruneTyping(), 1500);
    return () => {
      offP();
      offT();
      window.clearInterval(prune);
      room.leave();
      useRealtime.getState().setRoom(null);
    };
  }, [profile]);

  // unread counts: refresh on any new message
  useEffect(() => {
    if (!userId) return;
    void useRealtime.getState().refreshUnread();
    let t = 0;
    const off = backend.subscribe('messages', (e) => {
      if (e.type !== 'INSERT') return;
      window.clearTimeout(t);
      t = window.setTimeout(() => void useRealtime.getState().refreshUnread(), 400);
    });
    return () => {
      off();
      window.clearTimeout(t);
    };
  }, [userId]);

  // notifications → toast + optional browser notification
  const path = location.pathname + location.search;
  useEffect(() => {
    if (!userId) return;
    return backend.subscribe(
      'notifications',
      (e) => {
        if (e.type !== 'INSERT' || !e.new || e.new.user_id !== userId) return;
        const n = e.new;
        if (n.link && path.startsWith(n.link)) return; // already looking at it
        toast.info(n.title, n.body ?? undefined, n.link ?? undefined);
        showBrowserNotification(n.title, n.body, n.link);
      },
      { column: 'user_id', value: userId },
    );
  }, [userId, path]);

  usePriceAlertWatcher();

  return <>{children}</>;
}
