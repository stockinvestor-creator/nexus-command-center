import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, Bookmark, ExternalLink, FileText, Gavel, Landmark, Newspaper, NotebookPen, Pill, Radar, Star, Users, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { Input } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { MarketUnavailable } from '@/components/ui/DataSource';
import { TickerChip } from '@/components/ui/TickerChip';
import { ManualCatalysts } from '@/features/catalysts/ManualCatalysts';
import { EventList, Chip } from '@/features/intel/EventList';
import { useMyTickers } from '@/features/intel/useMyTickers';
import { useAnnotations } from '@/features/intel/annotations';
import { eventTimeLabel } from '@/features/intel/time';
import { intelKeys, intelView, useEarningsCalendar, useFda, useLatestFilings, useNews, usePolicy, useSecFilings } from '@/hooks/useIntel';
import { useLiveTable } from '@/hooks/useLiveTable';
import { mergeEvents } from '@/services/intel/client';
import { useSettings } from '@/store/settingsStore';
import { requestBrowserPermission } from '@/features/notifications/api';
import type { IntelEvent } from '@/types/intel';
import { POLICY_SECTORS } from '@/features/intel/policySectors';
import { daysUntil, fmtDate } from '@/lib/format';
import { normalizeSymbol, isValidSymbol } from '@/lib/tickers';

type Tab = 'watchlist' | 'triggers' | 'filings' | 'earnings' | 'meetings' | 'news' | 'policy' | 'fda' | 'saved' | 'manual';
const TABS: { value: Tab; label: string }[] = [
  { value: 'watchlist', label: 'My watchlist' },
  { value: 'triggers', label: '8-K triggers' },
  { value: 'filings', label: 'SEC filings' },
  { value: 'earnings', label: 'Earnings & reports' },
  { value: 'meetings', label: 'Shareholder meetings' },
  { value: 'news', label: 'Company events' },
  { value: 'policy', label: 'Policy & regulatory' },
  { value: 'fda', label: 'FDA / biotech' },
  { value: 'saved', label: 'Saved' },
  { value: 'manual', label: 'Manual catalysts' },
];

export default function Catalysts() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? (params.get('focus') ? 'manual' : 'watchlist');
  const setTab = (t: Tab) => setParams({ tab: t });
  return (
    <div>
      <PageHeader title="Catalyst Intelligence" subtitle="SEC filings, 8-K triggers, company news, policy and FDA actions — every item links to its source." />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="overflow-x-auto">
          <Tabs value={tab} onChange={setTab} options={TABS} />
        </div>
        {tab === 'watchlist' && <WatchlistTab />}
        {tab === 'triggers' && <TriggersTab />}
        {tab === 'filings' && <FilingsTab initialTicker={params.get('ticker') ?? ''} initialForm={params.get('form') ?? ''} />}
        {tab === 'earnings' && <EarningsTab />}
        {tab === 'meetings' && <MeetingsTab />}
        {tab === 'news' && <NewsTab />}
        {tab === 'policy' && <PolicyTab />}
        {tab === 'fda' && <FdaTab />}
        {tab === 'saved' && <SavedTab />}
        {tab === 'manual' && <ManualCatalysts />}
      </div>
    </div>
  );
}

function NotifyHint() {
  const on = useSettings((s) => s.browserNotifications);
  if (on) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
      <BellRing className="h-4 w-4 text-neon-cyan" />
      Get a browser alert when a new filing or catalyst appears for a watched ticker.
      <Button size="xs" variant="outline" className="ml-auto" onClick={() => void requestBrowserPermission()}>
        Enable alerts
      </Button>
    </div>
  );
}

function NoTickers() {
  return <EmptyState icon={<Star />} title="Add tickers to your watchlist" body="Watchlist catalysts are gathered for your watchlist and open simulated positions." />;
}

function WatchlistTab() {
  const { tickers } = useMyTickers();
  const sec = useSecFilings(tickers);
  const newsTickers = tickers.slice(0, 12);
  const news = useNews(newsTickers);
  const manual = useLiveTable('catalysts', { order: { column: 'catalyst_date', ascending: true } });
  const s = intelView(sec, intelKeys.sec(tickers));
  const n = intelView(news, intelKeys.news(newsTickers));
  const events = useMemo(() => mergeEvents(s.events, n.events), [s.events, n.events]);
  const myManual = manual.rows.filter((c) => tickers.includes(c.symbol) && (c.status === 'upcoming' || c.status === 'active'));
  if (!tickers.length) return <NoTickers />;
  return (
    <div className="space-y-3">
      <NotifyHint />
      <GlassCard title={`Watchlist catalysts · ${tickers.length} tickers`} icon={<Radar />}>
        <EventList
          events={events}
          loading={s.loading || n.loading}
          error={s.error && n.error ? `${s.error} · ${n.error}` : undefined}
          sources={[...(s.sources ?? []), ...(n.sources ?? [])]}
          fetchedAt={Math.min(s.fetchedAt ?? Date.now(), n.fetchedAt ?? Date.now())}
          stale={s.stale || n.stale}
          onRefresh={() => {
            s.onRefresh();
            n.onRefresh();
          }}
          emptyTitle="No recent filings or news for your tickers"
        />
      </GlassCard>
      {myManual.length > 0 && (
        <GlassCard title="Manual catalysts for your tickers" icon={<NotebookPen />}>
          <ul className="space-y-1.5">
            {myManual.slice(0, 12).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
                <Badge tone="neutral">Manual catalyst</Badge>
                <TickerChip symbol={c.symbol} />
                <span className="text-slate-300">{c.headline}</span>
                <span className="ml-auto font-mono text-slate-500">{fmtDate(c.catalyst_date)}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>
  );
}

function TriggersTab() {
  const { tickers } = useMyTickers();
  const [scope, setScope] = useState<'market' | 'watchlist'>('watchlist');
  const latest = useLatestFilings('8-K');
  const sec = useSecFilings(scope === 'watchlist' ? tickers : []);
  const v = scope === 'market' ? intelView(latest, intelKeys.latest('8-K')) : intelView(sec, intelKeys.sec(tickers));
  const events = v.events.filter((e) => e.form?.startsWith('8-K'));
  return (
    <GlassCard title="8-K triggers" icon={<Zap />} actions={<Tabs size="xs" value={scope} onChange={setScope} options={[{ value: 'watchlist', label: 'My tickers' }, { value: 'market', label: 'Market-wide (latest 100)' }]} />}>
      <p className="mb-3 text-[11px] text-slate-500">
        Categories come from the <b>Item numbers the company reported to the SEC</b> (e.g. Item 5.02 = officer/director change, 3.02 = unregistered equity sale, 1.05 = cybersecurity incident). NEXUS does not read meaning into filing text; 8-Ks
        with only exhibits are marked “Unclassified material event”.
      </p>
      {scope === 'watchlist' && !tickers.length ? <NoTickers /> : <EventList {...v} events={events} emptyTitle="No 8-K filings in range" />}
    </GlassCard>
  );
}

const FORM_GROUPS: { value: string; label: string; match: (f: string) => boolean; latest: string }[] = [
  { value: 'all', label: 'All', match: () => true, latest: '8-K' },
  { value: '8-K', label: '8-K', match: (f) => f.startsWith('8-K'), latest: '8-K' },
  { value: '10-Q', label: '10-Q', match: (f) => f.startsWith('10-Q'), latest: '10-Q' },
  { value: '10-K', label: '10-K', match: (f) => f.startsWith('10-K') || f === '20-F', latest: '10-K' },
  { value: 'S-1', label: 'S-1 / S-3', match: (f) => /^(S-1|S-3|F-1|F-3)/.test(f), latest: 'S-1' },
  { value: 'proxy', label: 'Proxy', match: (f) => /14A/.test(f), latest: 'DEF 14A' },
  { value: 'ownership', label: 'Ownership', match: (f) => /13[DG]/.test(f), latest: 'SC 13D' },
  { value: 'offerings', label: 'Offerings', match: (f) => /^424B|^S-1|^S-3/.test(f), latest: '424B5' },
];

function FilingsTab({ initialTicker, initialForm }: { initialTicker: string; initialForm: string }) {
  const { tickers } = useMyTickers();
  const [group, setGroup] = useState(FORM_GROUPS.find((g) => g.value.toLowerCase() === initialForm.toLowerCase())?.value ?? 'all');
  const [scope, setScope] = useState<'watchlist' | 'market' | 'ticker'>(initialTicker ? 'ticker' : 'watchlist');
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const g = FORM_GROUPS.find((x) => x.value === group)!;
  const t = normalizeSymbol(ticker);
  const target = scope === 'watchlist' ? tickers : scope === 'ticker' && isValidSymbol(t) ? [t] : [];
  const sec = useSecFilings(target);
  const latest = useLatestFilings(scope === 'market' ? g.latest : '8-K');
  const v = scope === 'market' ? intelView(latest, intelKeys.latest(g.latest)) : intelView(sec, intelKeys.sec(target));
  const events = v.events.filter((e) => e.form && g.match(e.form));
  return (
    <GlassCard title="SEC filings" icon={<FileText />}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Tabs size="xs" value={scope} onChange={setScope} options={[{ value: 'watchlist', label: 'Watchlist only' }, { value: 'ticker', label: 'Ticker' }, { value: 'market', label: 'Market-wide' }]} />
        {scope === 'ticker' && <Input className="h-8 w-32" placeholder="Ticker" value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} />}
        <div className="flex flex-wrap gap-1">
          {FORM_GROUPS.map((x) => (
            <Chip key={x.value} on={x.value === group} onClick={() => setGroup(x.value)}>
              {x.label}
            </Chip>
          ))}
        </div>
      </div>
      {scope === 'watchlist' && !tickers.length ? (
        <NoTickers />
      ) : scope === 'ticker' && !isValidSymbol(t) ? (
        <EmptyState title="Type a ticker" />
      ) : (
        <EventList {...v} events={events} filters={false} emptyTitle="No matching filings" emptyBody="Newest first. Links open the document on sec.gov." />
      )}
    </GlassCard>
  );
}

function EarningsTab() {
  const { tickers } = useMyTickers();
  const sec = useSecFilings(tickers);
  const cal = useEarningsCalendar();
  const manual = useLiveTable('catalysts', { eq: { catalyst_type: 'Earnings' }, order: { column: 'catalyst_date', ascending: true } });
  const v = intelView(sec, intelKeys.sec(tickers));
  const reports = v.events.filter((e) => e.classifications.some((c) => c.category === 'PERIODIC_REPORT' || c.category === 'EARNINGS'));
  const upcoming = (cal.data?.data ?? []).filter((d) => tickers.includes(d.symbol)).sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const upcomingManual = manual.rows.filter((c) => (daysUntil(c.catalyst_date) ?? -1) >= 0);
  if (!tickers.length) return <NoTickers />;
  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_380px]">
      <GlassCard title="Filed: 10-Q / 10-K and earnings releases (8-K Item 2.02)" icon={<FileText />}>
        <EventList {...v} events={reports} emptyTitle="No recent reports for your tickers" />
      </GlassCard>
      <div className="space-y-3">
        <GlassCard title="Upcoming earnings dates" icon={<Zap />}>
          {cal.data && !cal.error ? (
            upcoming.length ? (
              <ul className="space-y-1.5 text-xs">
                {upcoming.slice(0, 20).map((d) => (
                  <li key={d.symbol + d.reportDate} className="flex items-center gap-2">
                    <TickerChip symbol={d.symbol} />
                    <span className="truncate text-slate-400">{d.name}</span>
                    <span className="ml-auto font-mono text-slate-200">{fmtDate(d.reportDate)}</span>
                  </li>
                ))}
                <li className="pt-1 text-[10px] text-slate-500">Source: Alpha Vantage earnings calendar · retrieved {cal.data.fetchedAt ? new Date(cal.data.fetchedAt).toLocaleString() : ''}. No consensus figures shown.</li>
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No scheduled dates for your tickers in the next 3 months (Alpha Vantage).</p>
            )
          ) : (
            <MarketUnavailable reason="not_configured" message="No verified earnings-date source configured. Add MARKET_DATA_API_KEY (free Alpha Vantage key) in Netlify to list scheduled dates, or log them as manual catalysts." />
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            <a className="inline-flex items-center gap-1 text-neon-cyan hover:underline" href="https://www.nasdaq.com/market-activity/earnings" target="_blank" rel="noopener noreferrer">
              Nasdaq earnings calendar <ExternalLink className="h-3 w-3" />
            </a>
            <a className="inline-flex items-center gap-1 text-neon-cyan hover:underline" href="https://www.tradingview.com/markets/stocks-usa/earnings/" target="_blank" rel="noopener noreferrer">
              TradingView earnings <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </GlassCard>
        <GlassCard title="Manual earnings catalysts" icon={<NotebookPen />}>
          {upcomingManual.length ? (
            <ul className="space-y-1.5 text-xs">
              {upcomingManual.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Badge tone="neutral">Manual</Badge>
                  <TickerChip symbol={c.symbol} />
                  <span className="ml-auto font-mono text-slate-300">{fmtDate(c.catalyst_date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">None logged.</p>
          )}
        </GlassCard>
      </div>
    </div>
  );
}

function MeetingsTab() {
  const { tickers } = useMyTickers();
  const sec = useSecFilings(tickers);
  const v = intelView(sec, intelKeys.sec(tickers));
  const events = v.events.filter((e) => e.classifications.some((c) => c.category === 'SHAREHOLDER'));
  if (!tickers.length) return <NoTickers />;
  return (
    <GlassCard title="Shareholder meetings & votes" icon={<Users />}>
      <p className="mb-3 text-[11px] text-slate-500">
        Proxy statements (DEF 14A / DEFA14A / PRE 14A / DEFM14A) announce meetings and votes; 8-K Item 5.07 reports vote results. The meeting date is stated inside the proxy document — open the filing to read it. NEXUS does not guess dates.
      </p>
      <EventList {...v} events={events} filters={false} emptyTitle="No proxy or vote filings for your tickers" />
    </GlassCard>
  );
}

function NewsTab() {
  const { tickers } = useMyTickers();
  const list = tickers.slice(0, 12);
  const news = useNews(list);
  const v = intelView(news, intelKeys.news(list));
  if (!tickers.length) return <NoTickers />;
  return (
    <GlassCard title="Company events in the news" icon={<Newspaper />}>
      <p className="mb-3 text-[11px] text-slate-500">
        Headlines tagged to your tickers by Marketaux (headline, snippet, publisher, link only). Categories are <b>keyword matches on the headline</b> — the exact keyword is shown — not verified facts. Primary sources (SEC) are in the other tabs.
      </p>
      <EventList {...v} emptyTitle="No recent headlines for your tickers" />
    </GlassCard>
  );
}

function PolicyTab() {
  const p = usePolicy();
  const v = intelView(p, intelKeys.policy);
  const [sector, setSector] = useState<string>('All');
  const events = sector === 'All' ? v.events : v.events.filter((e) => e.tags?.includes(sector));
  return (
    <GlassCard title="Policy & regulatory" icon={<Landmark />}>
      <p className="mb-3 text-[11px] text-slate-500">
        Federal Register rules, proposed rules and presidential documents from market-relevant agencies (SEC, FDA, Commerce BIS export controls, USTR, OFAC, Fed, DOE, CMS, DoD, FTC) plus Federal Reserve press releases. Sector tags come from the issuing
        agency — they are not an impact assessment. Add your own view with a note (marked USER ANALYSIS).
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {['All', ...POLICY_SECTORS].map((s) => (
          <Chip key={s} on={sector === s} onClick={() => setSector(s)}>
            {s}
          </Chip>
        ))}
      </div>
      <EventList {...v} events={events} filters={false} emptyTitle="No recent policy documents" />
    </GlassCard>
  );
}

function FdaTab() {
  const f = useFda(30);
  const v = intelView(f, intelKeys.fda(30));
  return (
    <GlassCard title="FDA / biotech (last 30 days)" icon={<Pill />}>
      <p className="mb-3 text-[11px] text-slate-500">
        openFDA drug recalls (enforcement reports) and Drugs@FDA approval actions. openFDA lists firms, not tickers — NEXUS never guesses a ticker from a company name. Use “Note” to tag an event to a ticker as your own analysis.
      </p>
      <EventList {...v} emptyTitle="No FDA actions in range" />
    </GlassCard>
  );
}

function SavedTab() {
  const { rows } = useAnnotations();
  const saved = rows.filter((a) => a.bookmarked || a.priority || a.note);
  if (!saved.length) return <EmptyState icon={<Bookmark />} title="Nothing saved yet" body="Save, prioritise or annotate events from any tab." />;
  return (
    <GlassCard title="Saved & annotated" icon={<Gavel />}>
      <ul className="space-y-2">
        {saved.map((a) => {
          const ev = a.event as unknown as Partial<IntelEvent> & { categories?: string[] };
          const time = ev.at ? eventTimeLabel({ ...(ev as IntelEvent), kind: (ev.kind ?? 'news') as IntelEvent['kind'], atPrecision: ev.atPrecision ?? 'date' }) : null;
          return (
            <li key={a.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{String(ev.source ?? 'Source')}</Badge>
                {(ev.tickers ?? []).map((t) => (
                  <TickerChip key={t} symbol={t} />
                ))}
                {a.priority && <Badge tone={a.priority === 'critical' ? 'red' : a.priority === 'high' ? 'amber' : 'blue'}>{a.priority} (user)</Badge>}
                {a.bookmarked && <Bookmark className="h-3 w-3 text-amber-300" />}
                {time && <span className="ml-auto font-mono text-slate-500">{time.short}</span>}
              </div>
              <a href={ev.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-slate-200 hover:text-neon-cyan">
                {ev.title}
              </a>
              {a.note && <p className="mt-1 whitespace-pre-wrap text-slate-400">📝 {a.note}</p>}
            </li>
          );
        })}
      </ul>
    </GlassCard>
  );
}

export type { IntelEvent };
