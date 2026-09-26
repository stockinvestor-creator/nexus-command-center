import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSettings } from '@/store/settingsStore';
import { useRealtime } from '@/store/realtimeStore';
import { useAuth } from '@/store/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { NAV } from './nav';
import { Logo } from './Logo';

export function Sidebar() {
  const collapsed = useSettings((s) => s.sidebarCollapsed);
  const set = useSettings((s) => s.set);
  const unread = useRealtime((s) => Object.values(s.unread).reduce((a, b) => a + b, 0));
  const online = useRealtime((s) => s.online);
  const profiles = useAuth((s) => s.profiles);
  const me = useAuth((s) => s.user?.id);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 232 }}
      transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      className="relative z-20 hidden h-full shrink-0 flex-col border-r border-white/[0.06] bg-void-900/60 backdrop-blur-xl md:flex"
    >
      <div className="flex h-14 items-center gap-2.5 px-4">
        <Logo />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-display text-sm font-bold tracking-[0.25em] text-white">NEXUS</div>
            <div className="font-mono text-[9px] tracking-[0.2em] text-slate-500">COMMAND CENTER</div>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors',
                isActive ? 'text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl border border-neon-cyan/25 bg-gradient-to-r from-neon-cyan/15 to-transparent shadow-glow"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  />
                )}
                <item.icon className={cn('relative h-[18px] w-[18px] shrink-0', isActive && 'text-neon-cyan drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]')} />
                {!collapsed && <span className="relative truncate">{item.label}</span>}
                {item.to === '/messages' && unread > 0 && (
                  <span
                    className={cn(
                      'relative ml-auto rounded-full bg-neon-magenta/90 px-1.5 font-mono text-[10px] font-bold text-void',
                      collapsed && 'absolute right-1.5 top-1.5 ml-0 px-1',
                    )}
                  >
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        {!collapsed && <p className="label mb-2 px-1">Operators</p>}
        <div className={cn('space-y-1.5', collapsed && 'flex flex-col items-center')}>
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-2.5 px-1" title={p.display_name}>
              <Avatar profile={p} size={26} online={online.some((o) => o.id === p.id)} />
              {!collapsed && (
                <span className="truncate text-xs text-slate-300">
                  {p.display_name}
                  {p.id === me && <span className="text-slate-500"> (you)</span>}
                </span>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={() => set({ sidebarCollapsed: !collapsed })}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-1.5 text-xs text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </div>
    </motion.aside>
  );
}
