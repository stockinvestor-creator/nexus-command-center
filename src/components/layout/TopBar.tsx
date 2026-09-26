import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Search, Settings, Wifi, WifiOff, FlaskConical, Loader2 } from 'lucide-react';
import { useAuth } from '@/store/authStore';
import { useConnection, type ConnectionStatus } from '@/store/connectionStore';
import { backend } from '@/services/backend';
import { Avatar } from '@/components/ui/Avatar';
import { MarketStatusPill, Clock } from '@/features/market/MarketStatus';
import { NotificationBell } from '@/features/notifications/NotificationBell';
import { cn } from '@/lib/cn';
import { usePalette } from './CommandPalette';
import { Logo } from './Logo';

const CONN: Record<ConnectionStatus, { label: string; cls: string; icon: typeof Wifi }> = {
  online: { label: 'Realtime', cls: 'text-emerald-300 border-emerald-400/30', icon: Wifi },
  connecting: { label: 'Connecting', cls: 'text-amber-300 border-amber-400/30', icon: Loader2 },
  offline: { label: 'Offline', cls: 'text-rose-300 border-rose-400/30', icon: WifiOff },
  demo: { label: 'Local mode', cls: 'text-fuchsia-300 border-fuchsia-400/30', icon: FlaskConical },
};

function ConnectionBadge() {
  const status = useConnection((s) => s.status);
  const c = CONN[status];
  return (
    <span
      title={status === 'demo' ? 'Local mode: Supabase not configured, workspace data stays in this browser (syncs across tabs)' : `Supabase Realtime: ${c.label}`}
      className={cn('hidden items-center gap-1.5 rounded-full border bg-white/[0.02] px-2 py-1 font-mono text-[10px] uppercase tracking-wider sm:inline-flex', c.cls)}
    >
      <c.icon className={cn('h-3 w-3', status === 'connecting' && 'animate-spin')} />
      {c.label}
    </span>
  );
}

function UserMenu() {
  const profile = useAuth((s) => s.profile);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded-xl p-0.5 transition hover:ring-2 hover:ring-neon-cyan/30" aria-label="Account menu">
        <Avatar profile={profile} size={32} online />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="glass-strong absolute right-0 top-11 z-[60] w-56 p-1.5"
          >
            <div className="border-b border-white/[0.06] px-3 py-2">
              <p className="truncate text-sm text-white">{profile?.display_name}</p>
              <p className="truncate font-mono text-[10px] text-slate-500">{profile?.email}</p>
            </div>
            <Link to="/settings" onClick={() => setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5">
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button
              onClick={async () => {
                await backend.signOut();
                navigate('/login');
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function TopBar() {
  const openPalette = usePalette((s) => s.setOpen);
  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-3 border-b border-white/[0.06] bg-void-900/50 px-3 backdrop-blur-xl sm:px-4">
      <div className="md:hidden">
        <Logo size={28} />
      </div>
      <MarketStatusPill />
      <Clock />
      <button
        onClick={() => openPalette(true)}
        className="ml-auto flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-slate-500 transition hover:border-neon-cyan/30 hover:text-slate-300 sm:w-64 md:ml-4 md:mr-auto"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search tickers…</span>
        <kbd className="ml-auto hidden rounded border border-white/10 px-1.5 font-mono text-[10px] text-slate-500 sm:inline">⌘K</kbd>
      </button>
      <ConnectionBadge />
      <NotificationBell />
      <UserMenu />
    </header>
  );
}
