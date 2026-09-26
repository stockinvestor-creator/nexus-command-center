import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';

export function TickerChip({ symbol, className, size = 'sm' }: { symbol: string; className?: string; size?: 'sm' | 'md' }) {
  return (
    <Link
      to={`/stock/${encodeURIComponent(symbol)}`}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'inline-flex items-center rounded-md border border-cyan-400/30 bg-cyan-400/10 font-mono font-semibold text-cyan-300 transition hover:border-cyan-300/60 hover:bg-cyan-400/20 hover:shadow-glow',
        size === 'sm' ? 'px-1.5 py-[1px] text-[11px]' : 'px-2 py-0.5 text-sm',
        className,
      )}
    >
      ${symbol}
    </Link>
  );
}
