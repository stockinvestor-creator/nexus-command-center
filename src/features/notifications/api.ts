import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useSettings } from '@/store/settingsStore';
import type { NotificationType } from '@/types/db';

interface NotifyInput {
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
}

/** Create in-app notifications for specific users (never for yourself unless explicit). */
export async function notifyUsers(userIds: string[], n: NotifyInput, includeSelf = false): Promise<void> {
  const me = useAuth.getState().user?.id;
  if (!me) return;
  const targets = [...new Set(userIds)].filter((id) => includeSelf || id !== me);
  if (!targets.length) return;
  try {
    await backend.insertMany(
      'notifications',
      targets.map((user_id) => ({ user_id, actor_id: me, type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null })),
    );
  } catch (e) {
    // notifications are best-effort; never block the primary action
    console.warn('notify failed', e);
  }
}

/** Notify every other workspace member. */
export async function notifyOthers(n: NotifyInput): Promise<void> {
  const { profiles, user } = useAuth.getState();
  await notifyUsers(
    profiles.map((p) => p.id).filter((id) => id !== user?.id),
    n,
  );
}

export async function markNotificationRead(id: string) {
  await backend.update('notifications', id, { read_at: new Date().toISOString() });
}

export async function markAllNotificationsRead(ids: string[]) {
  const now = new Date().toISOString();
  await Promise.all(ids.map((id) => backend.update('notifications', id, { read_at: now })));
}

export async function deleteNotification(id: string) {
  await backend.remove('notifications', id);
}

/* ───── Browser notifications (only after explicit permission) ───── */

export const browserNotificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function requestBrowserPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!browserNotificationsSupported()) return 'unsupported';
  const res = await Notification.requestPermission();
  useSettings.getState().set({ browserNotifications: res === 'granted' });
  return res;
}

export function showBrowserNotification(title: string, body?: string | null, link?: string | null) {
  if (!browserNotificationsSupported()) return;
  if (Notification.permission !== 'granted' || !useSettings.getState().browserNotifications) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return; // in-app toast is enough
  try {
    const n = new Notification(title, { body: body ?? undefined, icon: '/favicon.svg', tag: link ?? title });
    n.onclick = () => {
      window.focus();
      if (link) window.history.pushState({}, '', link);
      window.dispatchEvent(new PopStateEvent('popstate'));
      n.close();
    };
  } catch {
    /* some mobile browsers only allow notifications from a service worker */
  }
}
