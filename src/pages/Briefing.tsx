import { useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertOctagon, Briefcase, CalendarClock, CalendarDays, ExternalLink, FileText, Globe2, History, Landmark, Newspaper, RefreshCw, Share2, Sparkles, Target, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { TradingViewBadge } from '@/components/ui/DataSource';
import { TickerChip } from '@/components/ui/TickerChip';
import { ShareCardModal } from '@/features/chat/ShareCardModal';
import { SourceStatus } from '@/features/intel/SourceStatus';
import { eventTimeLabel, ago } from '@/features/intel/time';
import { WhyButton } from '@/features/why/WhyButton';
import { KIND_CONFIG, type BriefingSnapshot } from '@/features/briefing/build';
import { snapshotOf, useBriefingEngine } from '@/features/briefing/useBriefing';
import { useIntelStatus } from '@/hooks/useIntel';
import { useNow } from '@/hooks/useNow';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fmtNumber, fmtPrice, isoDay, trendClass } from '@/lib/format';
import type { SharedCard } from '@/types/db';
import type { IntelEvent } from '@/types/intel';

export default function Briefing() {
  const [params, setParams] = useSearchParams();
  const engine = useBriefingEngine('morning');
  useNow(15_000);
  const status = useIntelStatus();
  const rows = engine.stored.rows;
  const date = params.get('date') ?? isoDay(0);
  const row = rows.find((r) => r.briefing_date === date) ?? null;
  const snap = snapshotOf(row);
  const isToday = date === isoDay(0);
  const cooldown = Math.ceil(engine.cooldownLeft / 60_000);
  const used = status.data?.data.marketauxUsedToday;

  return (
    <div>
      <PageHeader
        title="Morning Briefing"
        subtitle="What matters today — assembled from SEC, news, macro, your watchlist, positions and predictions. Every item is sourced."
        actions={
          <>
            <Select
              className="w-44"
              value={date}
              onChange={(d) => setParams(d === isoDay(0) ? {} : { date: d })}
              options={[...(rows.some((r) => r.briefing_date === isoDay(0)) ? [] : [{ value: isoDay(0), label: `${fmtDate(isoDay(0))} (today)` }]), ...rows.map((r) => ({ value: r.briefing_date, label: `${fmtDate(r.briefing_date)}${r.briefing_date === isoDay(0) ? ' (today)' : ''}` }))]}
            />
            {isToday && (
              <Button size="sm" variant="primary" loading={engine.busy} disabled={engine.cooldownLeft > 0} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => void engine.refresh()} title="Re-fetches SEC and news (bypassing caches) and regenerates today's briefing">
                {engine.cooldownLeft > 0 ? `Refresh in ${cooldown}m` : 'Refresh briefing'}
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-3 px-3 sm:px-5">
        {snap ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-slate-400">
              <span>Generated {fmtDateTime(snap.generatedAt)} ({ago(Date.parse(snap.generatedAt))})</span>
              <span>Data last refreshed {snap.dataRefreshedAt ? fmtDateTime(snap.dataRefreshedAt) : '—'}</span>
              <span>Tickers: {snap.tickers.length ? snap.tickers.join(' ') : 'none — add to your watchlist'}</span>
              {typeof used === 'number' && <span title="Marketaux free tier ≈100 requests/day; NEXUS stops at 95">Marketaux today: {used}/95</span>}
              {!isToday && <Badge tone="violet">Archived snapshot</Badge>}
            </div>
            <SourceStatus sources={snap.sources} />
            <BriefingView snap={snap} live={isToday} />
          </>
        ) : isToday ? (
          engine.busy || !engine.ready ? (
            <GlassCard title="Assembling today's briefing" icon={<Sparkles />}>
              <SkeletonRows rows={6} />
            </GlassCard>
          ) : (
            <EmptyState icon={<Sparkles />} title="No briefing yet today" action={<Button size="sm" variant="outline" onClick={() => void engine.generate(false)}>Generate now</Button>} />
          )
        ) : (
          <EmptyState icon={<History />} title={`No briefing stored for ${fmtDate(date)}`} />
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, count, children, className, action }: { title: string; icon: ReactNode; count?: number; children: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <GlassCard className={className} title={count != null ? `${title} (${count})` : title} icon={icon} actions={action}>
      {children}
    </GlassCard>
  );
}
const None = ({ children }: { children: ReactNode }) => <p className="text-xs text-slate-600">{children}</p>;

function EventLine({ e, onShare }: { e: IntelEvent; onShare: () => void }) {
  const t = eventTimeLabel(e);
  const trig = e.classifications.filter((c) => c.category !== 'NEWS' && c.category !== 'UNCLASSIFIED');
  return (
    <li className="border-b border-white/[0.04] py-2 last:border-0">
      <div className="flex flex-wrap items-center gap-1.5">
        {e.tickers.slice(0, 2).map((t) => <TickerChip key={t} symbol={t} />)}
        {e.form && <Badge tone="blue">{e.form}</Badge>}
        {trig.slice(0, 2).map((c) => (
          <Badge key={c.label} tone="amber" title={`Trigger category (NEXUS rule): ${c.basis}`}>{c.label}</Badge>
        ))}
        <span className="ml-auto font-mono text-[10px] text-slate-500" title={t.full}>{t.short.toUpperCase()}</span>
      </div>
      <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-sm text-slate-200 hover:text-neon-cyan">
        {e.title} <ExternalLink className="inline h-3 w-3 opacity-50" />
      </a>
      <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-slate-500">
        SOURCE: {e.publisher ?? e.source}
        {e.company && e.kind === 'filing' && <span>· {e.company}</span>}
        <button onClick={onShare} className="ml-auto inline-flex items-center gap-1 hover:text-neon-cyan"><Share2 className="h-3 w-3" /> Share</button>
      </div>
    </li>
  );
}

export function BriefingView({ snap, live }: { snap: BriefingSnapshot; live: boolean }) {
  const [card, setCard] = useState<SharedCard | null>(null);
  const shareEvent = (event: IntelEvent) => setCard({ type: 'event', event });
  const shareItem = (label: string, title: string, source: string, url: string | null) => setCard({ type: 'briefing', date: snap.date, kind: snap.kind, generatedAt: snap.generatedAt, items: [{ label, title, source, url }] });
  const shareSummary = () =>
    setCard({
      type: 'briefing',
      date: snap.date,
      kind: snap.kind,
      generatedAt: snap.generatedAt,
      items: snap.highPriority.slice(0, 8).map((h) => ({ label: h.level.toUpperCase(), title: h.title, source: h.rule, url: h.url })),
    });
  const ch = snap.changes;
  const changeLines = useMemo(
    () =>
      [
        ch.newFilings.length && `${ch.newFilings.length} new SEC filing${ch.newFilings.length > 1 ? 's' : ''} on watched tickers`,
        ch.newNews.length && `${ch.newNews.length} new ticker-tagged article${ch.newNews.length > 1 ? 's' : ''}`,
        ch.newHighPriority.length && `${ch.newHighPriority.length} new high-priority flag${ch.newHighPriority.length > 1 ? 's' : ''}`,
        ...ch.positionsOpened.map((p) => `Position opened: ${p}`),
        ...ch.positionsClosed.map((p) => `Position closed: ${p}`),
        ...ch.predictionsResolved.map((p) => `Prediction resolved: ${p}`),
        ...ch.catalystsAdded.map((c) => `Catalyst logged: ${c}`),
      ].filter(Boolean) as string[],
    [ch],
  );
  const kindCfg = KIND_CONFIG[snap.kind];
  const totalUnreal = snap.portfolio.filter((p) => p.unrealized != null).reduce((s, p) => s + (p.unrealized ?? 0), 0);

  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <Section
        className="lg:col-span-12"
        title="High priority — rules-based"
        icon={<AlertOctagon />}
        count={snap.highPriority.length}
        action={snap.highPriority.length ? <Button size="xs" variant="ghost" icon={<Share2 className="h-3 w-3" />} onClick={shareSummary}>Share summary</Button> : undefined}
      >
        {snap.highPriority.length === 0 ? (
          <None>No items matched the priority rules.</None>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {snap.highPriority.map((h) => (
              <li key={h.id} className={cn('rounded-lg border p-2.5', h.level === 'critical' ? 'border-rose-400/30 bg-rose-400/[0.04]' : 'border-amber-400/20 bg-amber-400/[0.03]')}>
                <div className="flex items-center gap-1.5">
                  <Badge tone={h.level === 'critical' ? 'red' : 'amber'}>{h.level}</Badge>
                  {h.symbol && <TickerChip symbol={h.symbol} />}
                  {h.symbol && live && <WhyButton symbol={h.symbol} compact className="ml-auto" />}
                </div>
                <p className="mt-1 text-sm text-slate-200">{h.url ? <a href={h.url} target="_blank" rel="noopener noreferrer" className="hover:text-neon-cyan">{h.title}</a> : h.title}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">Rule: {h.rule}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-12" title="What changed since the last briefing" icon={<History />}>
        {!ch.comparedTo ? <None>First briefing — nothing to compare yet.</None> : changeLines.length === 0 ? <None>No changes detected since {fmtDateTime(ch.comparedTo)}.</None> : (
          <>
            <p className="mb-1 font-mono text-[10px] text-slate-500">Compared with briefing generated {fmtDateTime(ch.comparedTo)}</p>
            <ul className="list-inside list-disc space-y-0.5 text-sm text-slate-300">{changeLines.map((l) => <li key={l}>{l}</li>)}</ul>
          </>
        )}
      </Section>

      <Section className="lg:col-span-7" title="Market overview" icon={<Globe2 />}>
        {live ? (
          <>
            <div className="mb-1 flex"><TradingViewBadge /></div>
            <div className="mb-3 h-[340px] overflow-hidden rounded-xl border border-white/[0.06]">
              <TradingViewWidget script="market-overview" config={tv.marketOverview()} />
            </div>
          </>
        ) : (
          <None>Live market overview is rendered by TradingView and is not stored in archived briefings.</None>
        )}
        {snap.macro.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {snap.macro.map((m) => (
              <a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" title={m.basis} className="rounded-lg border border-white/[0.06] p-2 hover:border-neon-cyan/30">
                <p className="truncate text-[10px] text-slate-500">{m.label}</p>
                <p className="font-mono text-sm text-slate-100">{m.value == null ? '—' : `${m.value.toFixed(2)}${m.unit}`}</p>
                <p className="font-mono text-[9px] text-slate-600">FRED · {m.date ? fmtDate(m.date) : 'n/a'}</p>
              </a>
            ))}
          </div>
        )}
      </Section>

      <Section className="lg:col-span-5" title="Economic events" icon={<CalendarClock />} count={snap.economic.length}>
        {snap.economic.length === 0 ? <None>No scheduled US releases found for the next 3 days (or the FRED calendar is unavailable).</None> : (
          <ul className="space-y-1.5">
            {snap.economic.slice(0, 12).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className={cn('w-14 font-mono', r.date === snap.date ? 'text-neon-cyan' : 'text-slate-500')}>{r.date === snap.date ? 'TODAY' : fmtDate(r.date).replace(/, \d{4}$/, '')}</span>
                <span className="min-w-0 flex-1 truncate text-slate-200">{r.name}</span>
                <span className="font-mono text-[10px] text-slate-500">{r.time && /\d/.test(r.time) ? r.time : 'time not published by source'}</span>
                <Badge tone={r.priority === 'high' ? 'amber' : 'neutral'} title={r.priorityBasis}>{r.priority === 'high' ? 'High' : 'Normal'}</Badge>
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-mono text-[10px] text-slate-500 hover:text-neon-cyan">{r.source.startsWith('FRED') ? 'FRED' : 'Fed'}</a>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-6" title={kindCfg.filingsLabel} icon={<FileText />} count={snap.filings.length}>
        {snap.filings.length === 0 ? <None>{snap.tickers.length ? 'No new material filings for your tickers.' : 'Add tickers to your watchlist to track filings.'}</None> : <ul>{snap.filings.map((e) => <EventLine key={e.id} e={e} onShare={() => shareEvent(e)} />)}</ul>}
      </Section>

      <Section className="lg:col-span-6" title="Watchlist news (24h)" icon={<Newspaper />} count={snap.news.length}>
        {snap.news.length === 0 ? <None>No ticker-tagged articles in the last 24 hours (or Marketaux is not configured).</None> : <ul>{snap.news.slice(0, 15).map((e) => <EventLine key={e.id} e={e} onShare={() => shareEvent(e)} />)}</ul>}
        {snap.fda.length > 0 && (
          <>
            <p className="mb-1 mt-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">FDA actions naming watched companies</p>
            <ul>{snap.fda.map((e) => <EventLine key={e.id} e={e} onShare={() => shareEvent(e)} />)}</ul>
          </>
        )}
      </Section>

      <Section className="lg:col-span-4" title="Watchlist catalysts (7 days)" icon={<Zap />} count={snap.watchlistCatalysts.length}>
        {snap.watchlistCatalysts.length === 0 ? <None>No dated catalysts in the next 7 days.</None> : (
          <ul className="space-y-1.5">
            {snap.watchlistCatalysts.map((c) => (
              <li key={c.id} className="text-xs">
                <div className="flex items-center gap-1.5">
                  <TickerChip symbol={c.symbol} />
                  <Badge tone="violet">{c.origin === 'manual_catalyst' ? 'Manual catalyst' : 'Watchlist date'}</Badge>
                  <span className="ml-auto font-mono text-[10px] text-slate-500">{c.date ? fmtDate(c.date) : ''}</span>
                </div>
                <p className="mt-0.5 text-slate-300">
                  {c.type}: {c.title}
                  {c.sourceUrl && <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-slate-500 hover:text-neon-cyan"><ExternalLink className="inline h-3 w-3" /></a>}
                </p>
                <button onClick={() => shareItem('Catalyst', `${c.symbol} ${c.type}: ${c.title}`, c.origin === 'manual_catalyst' ? 'Manual catalyst (team entry)' : 'Watchlist', c.sourceUrl)} className="text-[10px] text-slate-500 hover:text-neon-cyan">Share</button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-4" title="Upcoming earnings (14 days)" icon={<CalendarDays />} count={snap.earnings.length}>
        {snap.earnings.length === 0 ? <None>No earnings dates found for your tickers (Alpha Vantage key or manual catalysts needed).</None> : (
          <ul className="space-y-1">
            {snap.earnings.map((e) => (
              <li key={`${e.symbol}${e.date}`} className="flex items-center gap-2 text-xs">
                <TickerChip symbol={e.symbol} />
                <span className="font-mono text-slate-300">{fmtDate(e.date)}</span>
                <span className="ml-auto text-[10px] text-slate-500">{e.source}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-4" title="Portfolio check" icon={<Briefcase />} count={snap.portfolio.length} action={<Badge tone="amber">Simulated</Badge>}>
        {snap.portfolio.length === 0 ? <None>No open simulated positions.</None> : (
          <>
            <ul className="space-y-1">
              {snap.portfolio.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <TickerChip symbol={p.symbol} />
                  <span className="text-slate-500">{p.direction} {fmtNumber(p.shares, p.shares % 1 ? 2 : 0)} @ {fmtPrice(p.avgEntry)}</span>
                  <span className="ml-auto font-mono">
                    {p.price == null ? <span className="text-[10px] text-slate-500">PRICE UNAVAILABLE</span> : <span className={trendClass(p.unrealized)} title={p.priceSource ?? ''}>{fmtPrice(p.price)} · {p.unrealized! >= 0 ? '+' : ''}{fmtPrice(p.unrealized)}</span>}
                  </span>
                </li>
              ))}
            </ul>
            {snap.portfolio.some((p) => p.unrealized != null) && <p className={cn('mt-2 font-mono text-xs', trendClass(totalUnreal))}>Unrealized (priced positions): {totalUnreal >= 0 ? '+' : ''}{fmtPrice(totalUnreal)}</p>}
          </>
        )}
        <Link to="/portfolio" className="mt-2 inline-block text-[11px] text-neon-cyan hover:underline">Open portfolio →</Link>
      </Section>

      <Section className="lg:col-span-12" title="Predictions due" icon={<Target />} count={snap.predictionsDue.length}>
        {snap.predictionsDue.length === 0 ? <None>No open predictions resolving in the next 2 days.</None> : (
          <ul className="grid gap-1.5 md:grid-cols-2">
            {snap.predictionsDue.map((p) => (
              <li key={p.id}>
                <Link to={`/predictions?id=${p.id}`} className="flex items-center gap-2 rounded-lg border border-white/[0.05] px-2 py-1.5 text-xs hover:border-neon-cyan/30">
                  <Badge tone={p.pastDue ? 'amber' : 'cyan'}>{p.pastDue ? 'Past due' : 'Due'}</Badge>
                  {p.symbol && <span className="font-mono text-cyan-300">${p.symbol}</span>}
                  <span className="min-w-0 flex-1 truncate text-slate-300">{p.title}</span>
                  <span className="font-mono text-[10px] text-violet-300">{p.confidence}% user conf.</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section className="lg:col-span-12" title="Sources used" icon={<Landmark />}>
        <ul className="grid gap-1 text-[11px] text-slate-400 sm:grid-cols-2">
          {snap.sources.map((s, idx) => (
            <li key={`${s.source}${idx}`} className="flex items-center gap-2">
              <span className={cn('h-1.5 w-1.5 rounded-full', s.ok ? 'bg-emerald-400' : 'bg-amber-400')} />
              <span className="text-slate-300">{s.source}</span>
              <span className="text-slate-500">{s.checkedAt ? `checked ${fmtDateTime(s.checkedAt)}` : ''}{s.error ? ` · ${s.error}` : ''}{!s.configured ? ' · not configured' : ''}</span>
            </li>
          ))}
          <li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-sky-400" /><span className="text-slate-300">NEXUS workspace</span><span className="text-slate-500">watchlist, simulated positions, predictions, manual catalysts, team annotations</span></li>
        </ul>
      </Section>

      {card && <ShareCardModal open onClose={() => setCard(null)} card={card} defaultSlug="general" />}
    </div>
  );
}
