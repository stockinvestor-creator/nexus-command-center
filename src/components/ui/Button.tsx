import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'xs' | 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-r from-cyan-500/90 to-blue-500/90 text-white shadow-[0_0_20px_-6px_rgba(34,211,238,0.7)] hover:shadow-[0_0_28px_-4px_rgba(34,211,238,0.8)] hover:brightness-110',
  secondary: 'bg-white/[0.06] text-slate-100 hover:bg-white/[0.1] border border-white/10',
  outline: 'border border-neon-cyan/30 text-neon-cyan hover:bg-neon-cyan/10',
  ghost: 'text-slate-300 hover:bg-white/[0.06] hover:text-white',
  danger: 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25',
};
const sizes: Record<Size, string> = {
  xs: 'h-7 px-2 text-xs gap-1 rounded-lg',
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
};

export function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ref, ...rest }: ButtonProps) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({
  label,
  className,
  active,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; active?: boolean; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.07] hover:text-white active:scale-95 disabled:opacity-40',
        active && 'bg-neon-cyan/10 text-neon-cyan',
        className,
      )}
      {...rest}
    />
  );
}
