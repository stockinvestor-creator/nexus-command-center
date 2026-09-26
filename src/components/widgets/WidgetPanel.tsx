import type { ReactNode } from 'react';
import { ExternalLink, EyeOff } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { useSettings, type WidgetKey } from '@/store/settingsStore';
import { cn } from '@/lib/cn';
import { TradingViewWidget, type TVScript } from './TradingViewWidget';

/** A NEXUS glass module hosting an official TradingView widget. */
export function WidgetPanel({
  widget,
  title,
  icon,
  script,
  config,
  className,
  heightClass = 'h-[420px]',
  collapseId,
  actions,
  failureText,
}: {
  widget: WidgetKey;
  title: ReactNode;
  icon?: ReactNode;
  script: TVScript;
  config: Record<string, unknown>;
  className?: string;
  heightClass?: string;
  collapseId?: string;
  actions?: ReactNode;
  failureText?: string;
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
      badge={<TradingViewBadge className="hidden sm:inline-flex" />}
      actions={
        <>
          {actions}
          {enabled && (
            <button onClick={() => toggle(widget)} className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-200" title="Hide this widget">
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          )}
        </>
      }
    >
      <div className={cn('relative', heightClass)}>
        {enabled ? (
          <TradingViewWidget script={script} config={config} failureText={failureText} />
        ) : (
          <EmptyState
            icon={<ExternalLink />}
            title="Widget hidden"
            body="Official TradingView widgets load scripts from tradingview.com."
            action={
              <Button size="sm" variant="outline" onClick={() => toggle(widget)}>
                Show widget
              </Button>
            }
            className="h-full"
          />
        )}
      </div>
    </GlassCard>
  );
}
