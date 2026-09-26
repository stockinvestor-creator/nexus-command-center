import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/authStore';
import { Spinner } from '@/components/ui/States';
import { Logo } from '@/components/layout/Logo';

export function FullScreenLoader({ label = 'Establishing secure link…' }: { label?: string }) {
  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center gap-4">
      <Logo size={48} />
      <Spinner />
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <>{children}</>;
}
