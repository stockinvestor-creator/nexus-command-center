import { NavLink } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useRealtime } from '@/store/realtimeStore';
import { NAV } from './nav';

export function MobileNav() {
  const unread = useRealtime((s) => Object.values(s.unread).reduce((a, b) => a + b, 0));
  const [more, setMore] = useState(false);
  const primary = NAV.filter((n) => n.mobile);
  const secondary = NAV.filter((n) => !n.mobile);
  return (
    <>
      <AnimatePresence>
        {more && (
          <>
            <motion.div className="fixed inset-0 z-40 bg-black/50 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)} />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="glass-strong fixed inset-x-3 bottom-[76px] z-50 grid grid-cols-3 gap-1 p-2 md:hidden"
            >
              {secondary.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  onClick={() => setMore(false)}
                  className={({ isActive }) => cn('flex flex-col items-center gap-1 rounded-xl py-3 text-xs', isActive ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-slate-300')}
                >
                  <n.icon className="h-5 w-5" />
                  {n.short}
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-void-900/85 pb-safe backdrop-blur-xl md:hidden">
        <div className="flex h-16 items-stretch justify-around px-1">
          {primary.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cn('relative flex flex-1 flex-col items-center justify-center gap-1 text-[10px] transition', isActive ? 'text-neon-cyan' : 'text-slate-400')
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="mnav" className="absolute top-0 h-0.5 w-8 rounded-full bg-neon-cyan shadow-glow" />}
                  <n.icon className="h-5 w-5" />
                  {n.short}
                  {n.to === '/messages' && unread > 0 && (
                    <span className="absolute right-[22%] top-2 rounded-full bg-neon-magenta px-1 font-mono text-[9px] font-bold text-void">{unread}</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
          <button onClick={() => setMore((m) => !m)} className={cn('flex flex-1 flex-col items-center justify-center gap-1 text-[10px]', more ? 'text-neon-cyan' : 'text-slate-400')}>
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
