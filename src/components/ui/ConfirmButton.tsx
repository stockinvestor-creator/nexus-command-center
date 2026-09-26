import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Two-step destructive action: first click arms, second click confirms. */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Confirm?', className }: { onConfirm: () => void; children: ReactNode; confirmLabel?: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else setArmed(true);
      }}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition',
        armed ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:bg-white/5 hover:text-rose-300',
        className,
      )}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
