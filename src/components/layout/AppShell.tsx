import { Suspense, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { TickerTape } from './TickerTape';
import { CommandPalette } from './CommandPalette';
import { WhyDrawer } from '@/features/why/WhyDrawer';
import { Ambient } from '@/components/effects/Ambient';
import { Toaster } from '@/components/ui/Toaster';
import { Spinner } from '@/components/ui/States';
import { RealtimeProvider } from '@/providers/RealtimeProvider';
import { useAuth } from '@/store/authStore';
import { AlertTriangle } from 'lucide-react';

function ProfileWarning() {
  const err = useAuth((s) => s.profileError);
  if (!err) return null;
  return (
    <div className="mx-3 mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200 sm:mx-5">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      {err}
    </div>
  );
}

export function AppShell() {
  const location = useLocation();
  // Messages uses its own full-height layout
  const fullBleed = location.pathname.startsWith('/messages');
  return (
    <RealtimeProvider>
      <Ambient />
      <div className="relative z-10 flex h-[100dvh] overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <TickerTape />
          <ProfileWarning />
          <main className={fullBleed ? 'min-h-0 flex-1 overflow-hidden pb-16 md:pb-0' : 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-24 md:pb-8'}>
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
                transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
                className={fullBleed ? 'h-full' : ''}
              >
                <Suspense
                  fallback={
                    <div className="flex h-[60vh] items-center justify-center">
                      <Spinner className="h-7 w-7" />
                    </div>
                  }
                >
                  <Outlet />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
      <MobileNav />
      <CommandPalette />
      <WhyDrawer />
      <Toaster />
    </RealtimeProvider>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 px-3 pb-4 pt-5 sm:px-5">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-wide text-white sm:text-2xl">
          <span className="text-gradient">{title}</span>
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
