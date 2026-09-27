import { HelpCircle } from 'lucide-react';
import { useWhy } from '@/store/whyStore';
import { cn } from '@/lib/cn';

/** "WHY IS IT MOVING?" — opens the evidence drawer for a ticker from anywhere. */
export function WhyButton({ symbol, className, compact = false }: { symbol: string; className?: string; compact?: boolean }) {
  const open = useWhy((s) => s.open);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open(symbol);
      }}
      title={`Why is ${symbol.toUpperCase()} moving? — sourced evidence only`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border border-violet-400/30 bg-violet-400/10 font-mono font-semibold uppercase tracking-wider text-violet-200 transition hover:border-violet-300/60 hover:bg-violet-400/20',
        compact ? 'px-1.5 py-[2px] text-[9px]' : 'px-2 py-1 text-[10px]',
        className,
      )}
    >
      <HelpCircle className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {compact ? 'Why?' : 'Why is it moving?'}
    </button>
  );
}
