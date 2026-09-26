import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { useId } from 'react';

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'sm',
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly ({ value: T; label: string; count?: number } | T)[];
  className?: string;
  size?: 'xs' | 'sm';
}) {
  const id = useId();
  const opts = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o)) as { value: T; label: string; count?: number }[];
  return (
    <div className={cn('inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/20 p-0.5', className)}>
      {opts.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative shrink-0 whitespace-nowrap rounded-lg font-medium transition-colors',
            size === 'xs' ? 'px-2 py-1 font-mono text-[10px]' : 'px-3 py-1.5 text-xs',
            value === o.value ? 'text-white' : 'text-slate-400 hover:text-slate-200',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`tab-${id}`}
              className="absolute inset-0 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 shadow-glow"
              transition={{ type: 'spring', stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">
            {o.label}
            {o.count != null && <span className="ml-1 text-slate-500">{o.count}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
