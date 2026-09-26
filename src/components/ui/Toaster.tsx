import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToasts, type ToastTone } from '@/store/toastStore';
import { cn } from '@/lib/cn';

const icons: Record<ToastTone, typeof Info> = { info: Info, success: CheckCircle2, error: XCircle, warning: AlertTriangle };
const colors: Record<ToastTone, string> = {
  info: 'text-neon-cyan',
  success: 'text-emerald-400',
  error: 'text-rose-400',
  warning: 'text-amber-400',
};

export function Toaster() {
  const { toasts, dismiss } = useToasts();
  const navigate = useNavigate();
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[90] flex w-[min(360px,calc(100vw-24px))] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              className={cn('glass-strong pointer-events-auto flex gap-3 p-3', t.link && 'cursor-pointer')}
              onClick={() => {
                if (t.link) {
                  navigate(t.link);
                  dismiss(t.id);
                }
              }}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', colors[t.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-100">{t.title}</p>
                {t.body && <p className="mt-0.5 line-clamp-3 text-xs text-slate-400">{t.body}</p>}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(t.id);
                }}
                className="self-start text-slate-500 hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
