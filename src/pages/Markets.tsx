import { useState } from 'react';
import { Calendar, CandlestickChart, Flame, Globe2, Newspaper } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { Tabs } from '@/components/ui/Tabs';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { tv } from '@/components/widgets/TradingViewWidget';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { MarketScreener } from '@/features/market/MarketScreener';
import { MarketHeatmap } from '@/features/market/MarketHeatmap';
import { ProviderMovers } from '@/features/market/ProviderMovers';
import { useSettings } from '@/store/settingsStore';
import { CuratedLists, FinvizShortcuts } from '@/features/market/ScreenerShortcuts';
import { EconomicCalendarList } from '@/features/intel/EconomicCalendar';
import { MacroDashboard } from '@/features/intel/MacroDashboard';
import { ResearchSourceBar } from '@/features/research/ResearchSourceBar';
import type { ResolvedSymbol } from '@/types/market';
import { resolveSymbol } from '@/services/market/symbols';

type View = 'overview' | 'hotlists' | 'calendar' | 'macro' | 'news';

export default function Markets() {
  const [sym, setSym] = useState<ResolvedSymbol>(() => resolveSymbol('QQQ')!);
  const [view, setView] = useState<View>('overview');
  const chartOn = useSettings((s) => s.widgets.advancedChart);
  return (
    <div>
      <PageHeader title="Markets" subtitle="Official TradingView charts, screener and heatmap. NEXUS never generates market data." />
      <div className="grid gap-3 px-3 sm:px-5 lg:grid-cols-12">
        <GlassCard
          className="lg:col-span-12"
          title={<span className="flex items-center gap-2">Chart · <span className="font-mono text-neon-cyan">{sym.tvSymbol}</span></span>}
          icon={<CandlestickChart />}
          badge={<TradingViewBadge className="hidden sm:inline-flex" />}
          bodyClassName="p-0"
          actions={<SymbolSearch className="w-48 sm:w-72" placeholder="Chart any ticker…" onSelect={setSym} />}
        >
          <div className="h-[520px] sm:h-[620px]">{chartOn ? <TradingViewChart symbol={sym.tvSymbol} /> : <p className="p-6 text-sm text-slate-500">Chart widget hidden in Settings.</p>}</div>
          <ResearchSourceBar symbol={sym.ticker} className="border-t border-white/[0.05] px-4 py-2" />
        </GlassCard>

        <MarketScreener className="lg:col-span-12" />
        <CuratedLists className="lg:col-span-8" />
        <FinvizShortcuts className="lg:col-span-4 lg:mt-10" />
        <MarketHeatmap className="lg:col-span-12" heightClass="h-[620px]" />
        <ProviderMovers className="lg:col-span-12" />

        <div className="lg:col-span-12">
          <Tabs
            value={view}
            onChange={setView}
            options={[
              { value: 'overview', label: 'Market overview' },
              { value: 'hotlists', label: 'Hot lists' },
              { value: 'calendar', label: 'Economic calendar' },
              { value: 'macro', label: 'Macro dashboard' },
              { value: 'news', label: 'Top stories' },
            ]}
          />
        </div>
        {view === 'overview' && <WidgetPanel widget="marketOverview" title="Market Overview" icon={<Globe2 />} script="market-overview" config={tv.marketOverview()} className="lg:col-span-12" heightClass="h-[540px]" />}
        {view === 'hotlists' && <WidgetPanel widget="hotlists" title="Hot Lists" icon={<Flame />} script="hotlists" config={tv.hotlists()} className="lg:col-span-12" heightClass="h-[540px]" />}
        {view === 'calendar' && (
          <>
            <EconomicCalendarList className="lg:col-span-5" days={21} />
            <WidgetPanel widget="economicCalendar" title="Economic Calendar · consensus & actuals" icon={<Calendar />} script="events" config={tv.economicCalendar()} className="lg:col-span-7" heightClass="h-[600px]" />
          </>
        )}
        {view === 'macro' && <MacroDashboard className="lg:col-span-12" />}
        {view === 'news' && <WidgetPanel widget="topStories" title="Top Stories" icon={<Newspaper />} script="timeline" config={tv.topStories()} className="lg:col-span-12" heightClass="h-[600px]" />}
      </div>
    </div>
  );
}
