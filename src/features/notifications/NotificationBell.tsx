import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AtSign, Bell, BellRing, CheckCheck, DollarSign, MessageSquare, Swords, Trash2, Zap } from 'lucide-react';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { NotificationType } from '@/types/db';
import { EmptyState, Spinner } from '@/components/ui/States';
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from './api';
import { attempt } from '@/store/toastStore';

const ICONS: Record<NotificationType, typeof Bell> = {
  message: MessageSquare,
  mention: AtSign,
  ticker_mention: DollarSign,
  catalyst: Zap,
  trade_update: Swords,
  price_alert: BellRing,
  system: Bell,
};

export function NotificationBell() {
  const uid = useAuth((s) => s.user?.id);
  const { rows, loading, mutate } = useLiveTable(uid ? 'notifications' : null, {
    eq: { user_id: uid ?? '' },
    order: { column: 'created_at', ascending: false },
    limit: 40,
  });
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const unread = rows.filter((n) => !n.read_at);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
        aria-label={`Notifications${unread.length ? ` (${unread.length} unread)` : ''}`}
      >
        <Bell className={cn('h-[18px] w-[18px]', unread.length > 0 && 'text-neon-cyan')} />
        {unread.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-magenta px-1 font-mono text-[9px] font-bold text-void shadow-[0_0_10px_rgba(232,121,249,0.7)]">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            className="glass-strong fixed inset-x-3 top-14 z-[60] max-h-[70dvh] overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-[380px]"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">Notifications</span>
              {unread.length > 0 && (
                <button
                  onClick={() => {
                    const ids = unread.map((n) => n.id);
                    mutate((r) => r.map((n) => (ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n)));
                    void attempt(() => markAllNotificationsRead(ids));
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-neon-cyan hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[calc(70dvh-44px)] overflow-y-auto p-1.5">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : rows.length === 0 ? (
                <EmptyState title="All quiet" body="Mentions, catalysts, trade updates and price alerts show up here." />
              ) : (
                rows.map((n) => {
                  const Icon = ICONS[n.type];
                  return (
                    <div
                      key={n.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!n.read_at) {
                          mutate((r) => r.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
                          void attempt(() => markNotificationRead(n.id));
                        }
                        if (n.link) navigate(n.link);
                        setOpen(false);
                      }}
                      className={cn(
                        'group flex cursor-pointer gap-3 rounded-xl px-3 py-2.5 transition hover:bg-white/[0.04]',
                        !n.read_at && 'bg-neon-cyan/[0.04]',
                      )}
                    >
                      <span className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', n.read_at ? 'bg-white/5 text-slate-500' : 'bg-neon-cyan/10 text-neon-cyan')}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[13px]', n.read_at ? 'text-slate-400' : 'text-slate-100')}>{n.title}</p>
                        {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.body}</p>}
                        <p className="mt-1 font-mono text-[10px] text-slate-600">{timeAgo(n.created_at)}</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          mutate((r) => r.filter((x) => x.id !== n.id));
                          void attempt(() => deleteNotification(n.id));
                        }}
                        className="self-start rounded p-1 text-slate-600 opacity-0 transition hover:text-rose-300 group-hover:opacity-100"
                        aria-label="Delete notification"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
