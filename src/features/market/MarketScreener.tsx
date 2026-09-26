import { useState } from 'react';
import { ListFilter } from 'lucide-react';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { Tabs } from '@/components/ui/Tabs';
import { tv, type ScreenerPreset } from '@/components/widgets/TradingViewWidget';

const PRESETS: { value: ScreenerPreset; label: string }[] = [
  { value: 'top_gainers', label: 'Top gainers' },
  { value: 'top_losers', label: 'Top losers' },
  { value: 'volume_leaders', label: 'Most active' },
  { value: 'unusual_volume', label: 'Unusual volume' },
  { value: 'new_52_week_high', label: '52-week highs' },
  { value: 'new_52_week_low', label: '52-week lows' },
  { value: 'most_capitalized', label: 'Largest caps' },
];

/**
 * MARKET SCREENER — official TradingView Stock Screener (US). Presets switch the widget's
 * default screen; its toolbar lets you change column sets (overview / performance / …)
 * and filters. All rows come from TradingView.
 */
export function MarketScreener({ className }: { className?: string }) {
  const [preset, setPreset] = useState<ScreenerPreset>('top_gainers');
  return (
    <div className={className}>
      <div className="mb-2 overflow-x-auto">
        <Tabs value={preset} onChange={setPreset} options={PRESETS} />
      </div>
      <WidgetPanel
        key={preset}
        widget="screener"
        collapseId="market-screener"
        title="Market Screener"
        icon={<ListFilter />}
        script="screener"
        config={tv.screener(preset, 'overview', true)}
        heightClass="h-[640px]"
        failureText="Screener temporarily unavailable"
      />
    </div>
  );
}
