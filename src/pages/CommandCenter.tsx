import { Globe2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { WidgetPanel } from '@/components/widgets/WidgetPanel';
import { tv } from '@/components/widgets/TradingViewWidget';
import { MarketStatusPanel } from '@/features/market/MarketStatusPanel';
import { MarketMovers } from '@/features/market/MarketMovers';
import { MarketHeatmap } from '@/features/market/MarketHeatmap';
import { WatchlistMini } from '@/features/watchlist/WatchlistMini';
import { CatalystAlerts } from '@/features/catalysts/CatalystAlerts';
import { RecentMessages } from '@/features/chat/RecentMessages';
import { ActiveTrades, PortfolioTracker } from '@/features/trades/DashboardTrades';
import { useAuth } from '@/store/authStore';
import { BriefingWidget } from '@/features/briefing/BriefingWidget';
import { WhyWidget } from '@/features/why/WhyQuick';
import { OpenPredictionsWidget, ResolvedPredictionsWidget } from '@/features/predictions/PredictionWidgets';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late session' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

/**
 * Hierarchy: status → MARKET MOVERS → heatmap → watchlist / catalysts / war room →
 * messages → market overview. Every market number on this page is rendered by an
 * official TradingView widget; NEXUS panels contain only your own workspace data.
 */
export default function CommandCenter() {
  const name = useAuth((s) => s.profile?.display_name?.split(' ')[0]);
  return (
    <div className="pb-4">
      <PageHeader title="Command Center" subtitle={`${greeting()}${name ? `, ${name}` : ''}. Real market data or no market data.`} />
      <div className="grid grid-cols-1 gap-3 px-3 sm:px-5 lg:grid-cols-12">
        <MarketStatusPanel className="lg:col-span-12" />
        <BriefingWidget className="lg:col-span-8" />
        <WhyWidget className="lg:col-span-4" />
        <MarketMovers className="lg:col-span-12" />
        <MarketHeatmap className="lg:col-span-12" />

        <WatchlistMini className="lg:col-span-4" />
        <CatalystAlerts className="lg:col-span-4" />
        <ActiveTrades className="lg:col-span-4" />

        <OpenPredictionsWidget className="lg:col-span-6" />
        <ResolvedPredictionsWidget className="lg:col-span-6" />

        <RecentMessages className="lg:col-span-6" />
        <PortfolioTracker className="lg:col-span-6" />

        <WidgetPanel
          widget="marketOverview"
          collapseId="dash-overview"
          title="Market Overview"
          icon={<Globe2 />}
          script="market-overview"
          config={tv.marketOverview()}
          className="lg:col-span-12"
          heightClass="h-[480px]"
        />
      </div>
    </div>
  );
}
