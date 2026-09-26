import { useState } from 'react';
import { Calendar, Flame, Globe2, LayoutGrid, Newspaper, TrendingUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { SmartStockChart } from '@/features/market/SmartStockChart';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { MoversCard } from '@/features/market/MoversCard';
import { BreadthPanel } from '@/features/market/BreadthSentiment';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { tv } from '@/components/widgets/TradingViewWidget';
import { Tabs } from '@/components/ui/Tabs';
import { marketData } from '@/services/market';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';

type View = 'overview' | 'heatmap' | 'calendar' | 'news' | 'advanced';

export default function Markets() {
  const [symbol, setSymbol] = useState('QQQ');
  const [view, setView] = useState<View>('overview');
  const provider = marketData();
  return (
    <div>
      <PageHeader
        title="Markets"
        subtitle="Custom charting on your data provider, plus free TradingView modules."
        actions={
          <span className="flex items-center gap-2 text-xs text-slate-500">
            Provider: <span className="text-slate-300">{provider.name}</span> <FreshnessBadge freshness={provider.freshness} />
          </span>
        }
      />
      <div className="grid gap-3 px-3 sm:px-5 lg:grid-cols-12">
        <div className="flex flex-col gap-2 lg:col-span-8">
          <SymbolSearch onSelect={(m) => setSymbol(m.symbol)} placeholder="Search any ticker to chart…" />
          <div className="h-[560px]">
            <SmartStockChart symbol={symbol} initialTimeframe="6M" />
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <MoversCard />
          <BreadthPanel />
        </div>

        <div className="lg:col-span-12">
          <Tabs
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: 'Market overview' },
              { value: 'heatmap', label: 'S&P heatmap' },
              { value: 'calendar', label: 'Economic calendar' },
              { value: 'news', label: 'Top stories' },
              { value: 'advanced', label: 'TradingView chart' },
            ]}
          />
        </div>
        {view === 'overview' && (
          <>
            <WidgetPanel widget="marketOverview" title="Market Overview" icon={<Globe2 />} script="market-overview" config={tv.marketOverview()} className="lg:col-span-6" heightClass="h-[520px]" />
            <WidgetPanel widget="hotlists" title="Hot Lists" icon={<Flame />} script="hotlists" config={tv.hotlists()} className="lg:col-span-6" heightClass="h-[520px]" />
          </>
        )}
        {view === 'heatmap' && (
          <WidgetPanel widget="heatmap" title="S&P 500 Heatmap" icon={<LayoutGrid />} script="stock-heatmap" config={tv.heatmap()} className="lg:col-span-12" heightClass="h-[620px]" />
        )}
        {view === 'calendar' && (
          <WidgetPanel widget="economicCalendar" title="Economic Calendar" icon={<Calendar />} script="events" config={tv.economicCalendar()} className="lg:col-span-12" heightClass="h-[600px]" />
        )}
        {view === 'news' && (
          <WidgetPanel widget="topStories" title="Top Stories" icon={<Newspaper />} script="timeline" config={tv.topStories()} className="lg:col-span-12" heightClass="h-[600px]" />
        )}
        {view === 'advanced' && (
          <WidgetPanel
            widget="advancedChart"
            title={`TradingView Advanced Chart · ${symbol}`}
            icon={<TrendingUp />}
            script="advanced-chart"
            config={tv.advancedChart(symbol)}
            className="lg:col-span-12"
            heightClass="h-[640px]"
          />
        )}
      </div>
    </div>
  );
}
