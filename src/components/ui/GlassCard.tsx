import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSettings } from '@/store/settingsStore';

interface GlassCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
  /** When set, the card can be collapsed and remembers its state */
  collapseId?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  glow?: boolean;
}

/** Terminal-style module card: glass panel, glowing edge, corner brackets, optional collapse. */
export function GlassCard({ title, icon, actions, badge, collapseId, className, bodyClassName, children, glow = true }: GlassCardProps) {
  const collapsed = useSettings((s) => (collapseId ? Boolean(s.collapsedCards[collapseId]) : false));
  const toggle = useSettings((s) => s.toggleCard);
  return (
    <motion.section
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn('glass group flex min-w-0 flex-col overflow-hidden', glow && 'glow-border', className)}
    >
      <span className="pointer-events-none absolute left-2 top-2 h-2.5 w-2.5 border-l border-t border-neon-cyan/40" />
      <span className="pointer-events-none absolute bottom-2 right-2 h-2.5 w-2.5 border-b border-r border-neon-cyan/40" />
      {(title || actions) && (
        <header className="flex min-h-[44px] items-center gap-2 border-b border-white/[0.05] px-4 py-2">
          {icon && <span className="text-neon-cyan/80 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
          {title && <h2 className="truncate font-display text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-200">{title}</h2>}
          {badge}
          <div className="ml-auto flex items-center gap-1">
            {actions}
            {collapseId && (
              <button
                onClick={() => toggle(collapseId)}
                aria-label={collapsed ? 'Expand' : 'Collapse'}
                className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
              </button>
            )}
          </div>
        </header>
      )}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className={cn('min-h-0 flex-1 p-4', bodyClassName)}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
