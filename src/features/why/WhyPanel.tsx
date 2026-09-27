import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, CalendarClock, ExternalLink, FileText, Landmark, Newspaper, NotebookPen, Share2, Zap } from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SkeletonRows } from '@/components/ui/States';
import { DataSourceBadge, MarketUnavailable, TradingViewBadge } from '@/components/ui/DataSource';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { ShareCardModal } from '@/features/chat/ShareCardModal';
import { SourceStatus } from '@/features/intel/SourceStatus';
import { useAnnotations } from '@/features/intel/annotations';
import { useUpcomingReleases } from '@/features/intel/EconomicCalendar';
import { sectorTagsForIndustry } from '@/features/intel/policySectors';
import { intelKeys, intelView, useEarningsCalendar, useFda, useNews, usePolicy, useSecFilings } from '@/hooks/useIntel';
import { useBars } from '@/hooks/useMarket';
import { useLiveTable } from '@/hooks/useLiveTable';
import { lookupSymbol, resolveSymbol } from '@/services/market/symbols';
import { marketData } from '@/services/market';
import { cn } from '@/lib/cn';
import { fmtPct, trendClass } from '@/lib/format';
import { eventTimeLabel } from '@/features/intel/time';
import type { IntelEvent } from '@/types/intel';
import { gatherEvidence, moveFromBars, WHY_WINDOWS, windowHours, type Evidence, type EvidenceSection, type EvidenceTier, type Verdict, type WhyWindow } from './evidence';

export const TIER_TONE: Record<Verdict, Tone> = {
  CONFIRMED: 'green',
  'STRONGLY RELATED': 'cyan',
  'POSSIBLY RELATED': 'amber',
  'NO CONFIRMED CATALYST FOUND': 'neutral',
};

const SECTIONS: { key: EvidenceSection[]; title: string; icon: typeof Zap }[] = [
  { key: ['catalyst'], title: 'Latest confirmed catalysts', icon: Zap },
  { key: ['news'], title: 'News', icon: Newspaper },
  { key: ['filing'], title: 'SEC filings', icon: FileText },
  { key: ['upcoming'], title: 'Upcoming events', icon: CalendarClock },
  { key: ['policy', 'macro'], title: 'Policy / macro exposure — potentially related', icon: Landmark },
  { key: ['note'], title: 'Team notes (user analysis)', icon: NotebookPen },
];

/** Shared data hook: everything the evidence engine needs for one ticker (reuses the app-wide intel caches). */
export function useWhyEvidence(symbol: string, window: WhyWindow) {
  const sym = symbol.toUpperCase();
  const tickers = useMemo(() => [sym], [sym]);
  const filingsQ = useSecFilings(tickers);
  const newsQ = useNews(tickers);
  const fdaQ = useFda(14);
  const policyQ = usePolicy();
  const earningsQ = useEarningsCalendar();
  const { releases, q: relQ } = useUpcomingReleases(7, 7);
  const catalysts = useLiveTable('catalysts', { eq: { symbol: sym } });
  const { rows: annotations } = useAnnotations();
  const filings = intelView(filingsQ, intelKeys.sec(tickers));
  const news = intelView(newsQ, intelKeys.news(tickers));
  const industry = lookupSymbol(sym)?.industry ?? filings.events.find((e) => e.tags?.length)?.tags?.[0];
  const sectorTags = useMemo(() => sectorTagsForIndustry(industry), [industry]);
  const result = useMemo(
    () =>
      gatherEvidence({
        symbol: sym,
        window,
        filings: filings.events,
        news: news.events,
        fda: fdaQ.data?.data.events ?? [],
        policy: policyQ.data?.data.events ?? [],
        releases,
        earnings: earningsQ.data?.data ?? [],
        catalysts: catalysts.rows,
        annotations,
        sectorTags,
      }),
    [sym, window, filings.events, news.events, fdaQ.data, policyQ.data, releases, earningsQ.data, catalysts.rows, annotations, sectorTags],
  );
  const sources = [...(filings.sources ?? []), ...(news.sources ?? []), ...(fdaQ.data?.data.sources ?? []), ...(policyQ.data?.data.sources ?? []), ...(relQ.data?.data.sources ?? [])];
  const loading = filingsQ.loading || newsQ.loading;
  const refresh = () => {
    filings.onRefresh();
    news.onRefresh();
  };
  return { ...result, sources, loading, refresh, industry, sectorTags, fetchedAt: Math.min(filings.fetchedAt ?? Date.now(), news.fetchedAt ?? Date.now()) };
}

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  return (
    <Badge tone={TIER_TONE[verdict]} className={className} title="Evidence tier found by NEXUS rules — not a claim of causation">
      {verdict}
    </Badge>
  );
}

function PriceAction({ symbol, window }: { symbol: string; window: WhyWindow }) {
  const r = resolveSymbol(symbol);
  const hours = windowHours(window);
  const tf = hours <= 30 ? '5D' : '1M';
  const bars = useBars(marketData().capabilities.bars ? symbol : null, tf);
  const move = bars.data ? moveFromBars(bars.data.bars, hours) : null;
  return (
    <div className="space-y-2">
      <div className="h-[140px] overflow-hidden rounded-xl border border-white/[0.06]">
        <TradingViewWidget script="symbol-info" config={tv.symbolInfo(r?.tvSymbol ?? symbol)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <TradingViewBadge />
        {bars.unsupported ? (
          <span className="text-slate-500">Window move: needs a verified bar provider (Settings → Market data). Day change above is from TradingView.</span>
        ) : bars.loading ? (
          <span className="text-slate-500">Loading bars…</span>
        ) : move && bars.data ? (
          <>
            <span className={cn('font-mono', trendClass(move.pct))}>{fmtPct(move.pct)}</span>
            <span className="text-slate-500">
              over {window === 'today' ? 'today' : `the last ${window}`} ({new Date(move.from.time * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} → {new Date(move.to.time * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})
            </span>
            <DataSourceBadge provenance={bars.data.provenance} />
          </>
        ) : (
          <MarketUnavailable compact={false} className="py-1" message={bars.error ? bars.error.message : 'Provider bars do not cover this window (free tiers are delayed / end-of-day).'} />
        )}
      </div>
    </div>
  );
}

function EvidenceRow({ e }: { e: Evidence }) {
  const ts = e.at ? eventTimeLabel({ at: e.at, atPrecision: e.atPrecision, kind: e.section === 'filing' ? 'filing' : e.section === 'news' ? 'news' : e.section === 'upcoming' ? 'earnings_date' : 'policy' } as IntelEvent) : null;
  return (
    <li className="rounded-lg border border-white/[0.05] bg-white/[0.015] p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <VerdictBadge verdict={e.tier} />
        {e.categories.slice(0, 2).map((c) => (
          <Badge key={c} tone="neutral">{c}</Badge>
        ))}
        <span className="ml-auto font-mono text-[10px] text-slate-500" title={ts?.full}>{ts?.short}</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-200">
        {e.url ? (
          <a href={e.url} target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan">
            {e.title} <ExternalLink className="inline h-3 w-3 opacity-60" />
          </a>
        ) : (
          e.title
        )}
      </p>
      <p className="mt-1 font-mono text-[10px] text-slate-500">SOURCE: {e.source}</p>
      <p className="text-[10px] text-slate-600">Why this tier: {e.rule}</p>
    </li>
  );
}

/** Full "WHY IS IT MOVING?" panel for one ticker. */
export function WhyPanel({ symbol, initialWindow = 'today' }: { symbol: string; initialWindow?: WhyWindow }) {
  const [window, setWindow] = useState<WhyWindow>(initialWindow);
  const [sharing, setSharing] = useState(false);
  const w = useWhyEvidence(symbol, window);
  const bySection = (keys: EvidenceSection[]) => w.items.filter((i) => keys.includes(i.section));
  const top = w.items.filter((i) => i.tier !== 'POSSIBLY RELATED').slice(0, 6);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={window} onChange={setWindow} options={WHY_WINDOWS} size="xs" />
        <Button size="xs" variant="ghost" icon={<Share2 className="h-3 w-3" />} className="ml-auto" onClick={() => setSharing(true)}>
          Share to chat
        </Button>
        <Link to={`/research/${symbol}`} className="text-[11px] text-neon-cyan hover:underline">Research →</Link>
      </div>

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500"><Activity className="h-3 w-3" /> Price action</h3>
        <PriceAction symbol={symbol} window={window} />
      </section>

      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Evidence verdict</span>
          <VerdictBadge verdict={w.verdict} />
          {w.loading && <span className="text-[10px] text-slate-500">checking sources…</span>}
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {w.verdict === 'NO CONFIRMED CATALYST FOUND'
            ? `No confirmed or strongly related company-specific catalyst found in the selected window from the sources checked. The move may reflect sector, macro or flow factors NEXUS cannot verify.`
            : `${top.length} sourced item${top.length === 1 ? '' : 's'} found in the window. NEXUS lists evidence; it does not claim which item caused the move.`}
        </p>
        <SourceStatus sources={w.sources} onRefresh={w.refresh} refreshing={w.loading} className="mt-2" />
      </div>

      {w.loading && !w.items.length ? (
        <SkeletonRows rows={4} />
      ) : (
        SECTIONS.map((s) => {
          const list = bySection(s.key);
          return (
            <section key={s.title}>
              <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                <s.icon className="h-3 w-3" /> {s.title} <span className="text-slate-600">({list.length})</span>
              </h3>
              {list.length ? <ul className="space-y-1.5">{list.map((e) => <EvidenceRow key={e.id} e={e} />)}</ul> : <p className="text-xs text-slate-600">None found.</p>}
            </section>
          );
        })
      )}
      {w.sectorTags.length > 0 && <p className="text-[10px] text-slate-600">Sector match used for policy items: {w.sectorTags.join(', ')} (from {w.industry}).</p>}

      <ShareCardModal
        open={sharing}
        onClose={() => setSharing(false)}
        defaultSlug="stocks"
        card={{
          type: 'why',
          symbol,
          window,
          verdict: w.verdict,
          evidence: w.items
            .filter((i) => i.tier !== 'POSSIBLY RELATED' || w.verdict === 'NO CONFIRMED CATALYST FOUND')
            .slice(0, 5)
            .map((i) => ({ label: i.tier as EvidenceTier, title: i.title.slice(0, 200), source: i.source, at: i.at ?? '', url: i.url ?? '' })),
        }}
      />
    </div>
  );
}
