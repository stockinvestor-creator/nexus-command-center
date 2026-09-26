import type { ReactNode } from 'react';
import { ExternalLink, EyeOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FreshnessBadge } from '@/components/ui/FreshnessBadge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useSettings, type WidgetKey } from '@/store/settingsStore';
import { cn } from '@/lib/cn';
import { TradingViewWidget, type TVScript } from './TradingViewWidget';

/**
 * A glass module that hosts a free TradingView widget.
 * TradingView data is real-time for some exchanges and delayed for others (per exchange
 * licensing), so these panels are labelled DELAYED to stay conservative.
 */
export function WidgetPanel({
  widget,
  title,
  icon,
  script,
  config,
  className,
  heightClass = 'h-[420px]',
  collapseId,
}: {
  widget: WidgetKey;
  title: string;
  icon?: ReactNode;
  script: TVScript;
  config: Record<string, unknown>;
  className?: string;
  heightClass?: string;
  collapseId?: string;
}) {
  const enabled = useSettings((s) => s.widgets[widget]);
  const toggle = useSettings((s) => s.toggleWidget);
  return (
    <GlassCard
      title={title}
      icon={icon}
      collapseId={collapseId}
      className={className}
      bodyClassName="p-0"
      badge={
        <FreshnessBadge
          freshness="DELAYED"
          note="TradingView widget: real-time or delayed depending on exchange. Open the widget for exact timestamps."
        />
      }
      actions={
        enabled ? (
          <button
            onClick={() => toggle(widget)}
            className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
            title="Hide this widget"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
        ) : null
      }
    >
      <div className={cn('relative', heightClass)}>
        {enabled ? (
          <TradingViewWidget script={script} config={config} />
        ) : (
          <EmptyState
            icon={<ExternalLink />}
            title="Widget hidden"
            body="TradingView widgets load third-party scripts. Enable to show free market data from TradingView."
            action={
              <Button size="sm" variant="outline" onClick={() => toggle(widget)}>
                Enable widget
              </Button>
            }
            className="h-full"
          />
        )}
      </div>
    </GlassCard>
  );
}
