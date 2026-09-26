import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type Tone = 'neutral' | 'cyan' | 'violet' | 'green' | 'red' | 'amber' | 'blue' | 'pink';

const tones: Record<Tone, string> = {
  neutral: 'border-white/10 bg-white/5 text-slate-300',
  cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300',
  violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  red: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  blue: 'border-blue-400/30 bg-blue-400/10 text-blue-300',
  pink: 'border-pink-400/30 bg-pink-400/10 text-pink-300',
};

export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
