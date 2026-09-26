import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { tv, type HeatmapSource } from '@/components/widgets/TradingViewWidget';
import { cn } from '@/lib/cn';

const SOURCES: { value: HeatmapSource; label: string }[] = [
  { value: 'SPX500', label: 'S&P 500' },
  { value: 'NASDAQ100', label: 'Nasdaq 100' },
  { value: 'DJDJI', label: 'Dow 30' },
  { value: 'AllUSA', label: 'All US' },
];

/** Official TradingView stock heatmap (U.S.). */
export function MarketHeatmap({ className, heightClass = 'h-[560px]' }: { className?: string; heightClass?: string }) {
  const [src, setSrc] = useState<HeatmapSource>('SPX500');
  return (
    <WidgetPanel
      widget="heatmap"
      collapseId="us-heatmap"
      title="U.S. Market Heatmap"
      icon={<LayoutGrid />}
      script="stock-heatmap"
      config={tv.heatmap(src)}
      className={className}
      heightClass={heightClass}
      failureText="Heatmap temporarily unavailable"
      actions={
        <div className="mr-1 hidden items-center gap-0.5 rounded-lg border border-white/[0.06] bg-black/20 p-0.5 sm:flex">
          {SOURCES.map((s) => (
            <button
              key={s.value}
              onClick={() => setSrc(s.value)}
              className={cn('rounded-md px-2 py-0.5 font-mono text-[10px] transition', src === s.value ? 'bg-neon-cyan/15 text-neon-cyan' : 'text-slate-400 hover:text-white')}
            >
              {s.label}
            </button>
          ))}
        </div>
      }
    />
  );
}
