import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/cn';

/** Clickable row that navigates — unlike <Link>, it can safely contain other links (ticker chips). */
export function ClickRow({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  const navigate = useNavigate();
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a,button')) return;
        navigate(to);
      }}
      onKeyDown={(e) => e.key === 'Enter' && navigate(to)}
      className={cn('cursor-pointer', className)}
    >
      {children}
    </div>
  );
}
