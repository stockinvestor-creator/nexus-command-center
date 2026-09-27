import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BellPlus, Building2, CandlestickChart, Gauge, Info, MessageSquare, NotebookPen, Plus, Save, Share2, Star, Swords, Zap } from 'lucide-react';
import { useQuote } from '@/hooks/useMarket';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { useSettings } from '@/store/settingsStore';
import { attempt, toast } from '@/store/toastStore';
import { cn } from '@/lib/cn';
import { fmtChange, fmtCompact, fmtDate, fmtPct, fmtPrice, timeAgo, trendClass } from '@/lib/format';
import { resolveSymbol } from '@/services/market/symbols';
import { marketData } from '@/services/market';
import { backend } from '@/services/backend';
import { GlassCard } from '@/components/ui/GlassCard';
import { DataSourceBadge, MarketUnavailable, TradingViewBadge, UserEstimateTag } from '@/components/ui/DataSource';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Textarea, Select, Field, Input } from '@/components/ui/Field';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import { ClickRow } from '@/components/ui/ClickRow';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { TradingViewChart } from '@/components/charts/TradingViewChart';
import { SmartStockChart } from '@/features/market/SmartStockChart';
import { MarketStatusPill } from '@/features/market/MarketStatus';
import { PriceAlertModal } from '@/features/market/PriceAlertModal';
import { saveTickerNote, type ScoreKey } from '@/features/market/api';
import { useWatchToggle, updateWatchItem } from '@/features/watchlist/api';
import { BIAS_META, CAT_STATUS_META } from '@/features/catalysts/api';
import { STATUS_META } from '@/features/trades/api';
import { TradeForm } from '@/features/trades/TradeForm';
import { MessageContent } from '@/features/chat/MessageContent';
import { ShareStockModal } from '@/features/chat/ShareStockModal';
import { sendMessage } from '@/features/chat/api';
import { WhyButton } from '@/features/why/WhyButton';
import { ResearchSourceBar } from '@/features/research/ResearchSourceBar';
import { EventList } from '@/features/intel/EventList';
import { intelKeys, intelView, useNews, useSecFilings } from '@/hooks/useIntel';
import { mergeEvents } from '@/services/intel/client';
import { RISK_LEVELS, WATCH_CATEGORIES, WATCH_DIRECTIONS, type Channel, type Message, type StockShareMeta, type TickerNote } from '@/types/db';

const SCORES: { key: ScoreKey; label: string; hint: string; gradient: string }[] = [
  { key: 'catalyst_score', label: 'Catalyst score', hint: 'Strength/proximity of known catalysts', gradient: 'from-violet-500 to-fuchsia-400' },
  { key: 'momentum_score', label: 'Momentum score', hint: 'Your read of trend & relative strength', gradient: 'from-cyan-500 to-emerald-400' },
  { key: 'volatility_score', label: 'Volatility score', hint: 'Expected swing size', gradient: 'from-amber-500 to-orange-400' },
  { key: 'risk_score', label: 'Risk score', hint: 'Dilution, float, balance-sheet, event risk', gradient: 'from-rose-500 to-pink-400' },
];

function ScorePanel({ symbol, note }: { symbol: string; note: TickerNote | undefined }) {
  const editor = useAuth((s) => s.profiles.find((p) => p.id === note?.updated_by));
  const [edit, setEdit] = useState(false);
  const [vals, setVals] = useState<Record<ScoreKey, number | null>>({ catalyst_score: null, momentum_score: null, volatility_score: null, risk_score: null });
  useEffect(() => {
    setVals({
      catalyst_score: note?.catalyst_score ?? null,
      momentum_score: note?.momentum_score ?? null,
      volatility_score: note?.volatility_score ?? null,
      risk_score: note?.risk_score ?? null,
    });
  }, [note]);
  const save = async () => {
    const ok = await attempt(() => saveTickerNote(symbol, vals), 'Could not save scores');
    if (ok) {
      toast.success('Scores saved');
      setEdit(false);
    }
  };
  return (
    <GlassCard
      title="Scores"
      icon={<Gauge />}
      badge={<UserEstimateTag label="Manual score" />}
      actions={
        edit ? (
          <Button size="xs" variant="primary" onClick={save} icon={<Save className="h-3 w-3" />}>
            Save
          </Button>
        ) : (
          <Button size="xs" variant="ghost" onClick={() => setEdit(true)}>
            Edit
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {SCORES.map((s) => {
          const v = vals[s.key];
          return (
            <div key={s.key}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">{s.label}</span>
                <span className="num text-lg font-semibold text-white">{v ?? '—'}</span>
              </div>
              {edit ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={v ?? 50}
                    onChange={(e) => setVals((x) => ({ ...x, [s.key]: Number(e.target.value) }))}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-cyan-400"
                  />
                  <button onClick={() => setVals((x) => ({ ...x, [s.key]: null }))} className="text-[10px] text-slate-500 hover:text-white">
                    clear
                  </button>
                </div>
              ) : (
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className={cn('h-full rounded-full bg-gradient-to-r shadow-glow transition-all duration-700', s.gradient)} style={{ width: `${v ?? 0}%` }} />
                </div>
              )}
              <p className="mt-1 text-[10px] text-slate-600">{s.hint}</p>
            </div>
          );
        })}
        <p className="border-t border-white/5 pt-2 text-[10px] text-slate-600">
          {note?.updated_at ? `Last edited by ${editor?.display_name ?? 'someone'} ${timeAgo(note.updated_at)}.` : 'Not scored yet.'} 0–100, set by you — not computed.
        </p>
      </div>
    </GlassCard>
  );
}

function ThesisNotes({ symbol, note }: { symbol: string; note: TickerNote | undefined }) {
  const [text, setText] = useState(note?.thesis ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(note?.thesis ?? ''), [note?.thesis]);
  const dirty = text !== (note?.thesis ?? '');
  return (
    <GlassCard
      title="Shared thesis notes"
      icon={<NotebookPen />}
      badge={<UserEstimateTag label="Team thesis" />}
      actions={
        dirty && (
          <Button
            size="xs"
            variant="primary"
            loading={saving}
            icon={<Save className="h-3 w-3" />}
            onClick={async () => {
              setSaving(true);
              const ok = await attempt(() => saveTickerNote(symbol, { thesis: text.trim() || null }));
              setSaving(false);
              if (ok) toast.success('Thesis saved');
            }}
          >
            Save
          </Button>
        )
      }
    >
      <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Shared notes on $${symbol}: thesis, levels, risks, what would change your mind…`} />
      <p className="mt-1.5 text-[10px] text-slate-600">Visible to both operators. Supports $TICKER references.</p>
    </GlassCard>
  );
}

function WatchControls({ symbol }: { symbol: string }) {
  const { item, toggle, active } = useWatchToggle(symbol);
  return (
    <GlassCard title="Watchlist" icon={<Star />}>
      {!item ? (
        <div className="space-y-2 text-center">
          <p className="text-xs text-slate-500">Not on {active?.name ?? 'your watchlist'}.</p>
          <Button variant="outline" className="w-full" icon={<Plus className="h-4 w-4" />} onClick={toggle}>
            Add ${symbol}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Side">
            <Select value={item.direction} onChange={(v) => void attempt(() => updateWatchItem(item.id, { direction: v }))} options={WATCH_DIRECTIONS} />
          </Field>
          <Field label="Risk">
            <Select value={item.risk_level} onChange={(v) => void attempt(() => updateWatchItem(item.id, { risk_level: v }))} options={RISK_LEVELS} />
          </Field>
          <Field label="Category" className="col-span-2">
            <Select value={item.category} onChange={(v) => void attempt(() => updateWatchItem(item.id, { category: v }))} options={WATCH_CATEGORIES} />
          </Field>
          <Field label="Catalyst date" className="col-span-2">
            <Input type="date" value={item.catalyst_date ?? ''} onChange={(e) => void attempt(() => updateWatchItem(item.id, { catalyst_date: e.target.value || null }))} />
          </Field>
          <div className="col-span-2 flex gap-2">
            <Button size="sm" className="flex-1" variant={item.favorite ? 'outline' : 'secondary'} icon={<Star className={cn('h-3.5 w-3.5', item.favorite && 'fill-current')} />} onClick={() => void attempt(() => updateWatchItem(item.id, { favorite: !item.favorite }))}>
              {item.favorite ? 'Favorite' : 'Favorite?'}
            </Button>
            <Button size="sm" variant="danger" onClick={toggle}>
              Remove
            </Button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

/** Quote panel for API providers (e.g. Alpha Vantage). Hidden entirely when unsupported. */
function ProviderQuote({ ticker }: { ticker: string }) {
  const q = useQuote(ticker);
  if (q.unsupported) return null;
  return (
    <GlassCard title={`${marketData().sourceLabel} quote`} icon={<Info />} badge={q.data && <DataSourceBadge provenance={q.data.provenance} />}>
      {q.loading && !q.data ? (
        <SkeletonRows rows={2} />
      ) : !q.data ? (
        <MarketUnavailable reason={q.reason} message={q.error?.message} />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {[
            ['Last', fmtPrice(q.data.price)],
            ['Change', `${fmtChange(q.data.change)} (${fmtPct(q.data.changePercent)})`],
            ['Open', fmtPrice(q.data.open)],
            ['High', fmtPrice(q.data.high)],
            ['Low', fmtPrice(q.data.low)],
            ['Prev close', fmtPrice(q.data.previousClose)],
            ['Volume', fmtCompact(q.data.volume)],
          ].map(([l, v], i) => (
            <div key={l} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="label">{l}</div>
              <div className={cn('num mt-0.5 text-sm text-slate-100', i === 1 && trendClass(q.data?.changePercent))}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

export default function StockDetail() {
  const params = useParams();
  const resolved = resolveSymbol(decodeURIComponent(params.symbol ?? ''));
  const ticker = resolved?.ticker ?? '';
  const tvSymbol = resolved?.tvSymbol ?? '';
  const provider = marketData();
  const notes = useLiveTable('ticker_notes', { eq: { symbol: ticker } });
  const catalysts = useLiveTable('catalysts', { eq: { symbol: ticker }, order: { column: 'catalyst_date', ascending: true } });
  const trades = useLiveTable('trade_ideas', { eq: { symbol: ticker }, order: { column: 'updated_at', ascending: false } });
  const profiles = useAuth((s) => s.profiles);
  const widgets = useSettings((s) => s.widgets);
  const { item: watchItem, toggle: toggleWatch } = useWatchToggle(ticker || 'X');
  const [mentions, setMentions] = useState<Message[] | null>(null);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);

  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    setMentions(null);
    backend
      .select('messages', { ilike: { column: 'content', pattern: `%$${ticker}%` }, order: { column: 'created_at', ascending: false }, limit: 20 })
      .then((rows) => alive && setMentions(rows.filter((m) => new RegExp(`\\$${ticker.replace('.', '\\.')}\\b`, 'i').test(m.content))))
      .catch(() => alive && setMentions([]));
    return () => {
      alive = false;
    };
  }, [ticker]);

  if (!resolved) return <EmptyState title="Invalid ticker" body="Use a ticker like NVDA, or EXCHANGE:TICKER like NYSE:IBM." />;

  const note = notes.rows[0];

  const shareToStocks = async (meta: StockShareMeta, comment: string) => {
    const chans = await backend.select('channels', { eq: { slug: 'stocks' } });
    const ch: Channel | undefined = chans[0] ?? (await backend.select('channels', { eq: { type: 'channel' } }))[0];
    if (!ch) return toast.error('No channel to share to');
    const ok = await attempt(() => sendMessage({ channel: ch, content: comment, kind: 'stock_share', metadata: { stock: meta }, memberIds: profiles.map((p) => p.id) }));
    if (ok) toast.success(`Shared ${meta.symbol} to #${ch.name}`);
  };

  return (
    <div className="pb-4">
      {/* header */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3 px-3 pb-4 pt-5 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-wide text-white [text-shadow:0_0_30px_rgba(34,211,238,0.35)]">${ticker}</h1>
            <Badge tone={resolved.verified ? 'cyan' : 'amber'} title={resolved.verified ? 'Exchange-qualified TradingView symbol' : 'Exchange not verified; TradingView resolves the bare ticker'}>
              {resolved.exchange ?? 'exchange unverified'}
            </Badge>
          </div>
          <p className="text-sm text-slate-400">{resolved.name ?? tvSymbol}</p>
        </div>
        <MarketStatusPill />
        <div className="ml-auto flex flex-wrap gap-2">
          <WhyButton symbol={ticker} className="h-8 px-3" />
          <Link to={`/research/${ticker}`}><Button size="sm" variant="ghost">Research</Button></Link>
          <Link to={`/predictions?new=1&symbol=${ticker}`}><Button size="sm" variant="ghost">Predict</Button></Link>
          <Link to={`/portfolio?new=1&symbol=${ticker}`}><Button size="sm" variant="ghost">Simulate</Button></Link>
          <Button size="sm" variant={watchItem ? 'outline' : 'secondary'} icon={<Star className={cn('h-4 w-4', watchItem && 'fill-current')} />} onClick={toggleWatch}>
            {watchItem ? 'On watchlist' : 'Watch'}
          </Button>
          <Button size="sm" icon={<BellPlus className="h-4 w-4" />} onClick={() => setAlertOpen(true)}>
            Alert
          </Button>
          <Button size="sm" icon={<Share2 className="h-4 w-4" />} onClick={() => setShareOpen(true)}>
            Share chart
          </Button>
          <Button size="sm" variant="primary" icon={<Swords className="h-4 w-4" />} onClick={() => setTradeOpen(true)}>
            New trade idea
          </Button>
        </div>
      </div>

      <ResearchSourceBar symbol={ticker} className="px-3 pb-3 sm:px-5" />
      <div className="grid gap-3 px-3 sm:px-5 xl:grid-cols-12">
        <div className="min-w-0 space-y-3 xl:col-span-9">
          {widgets.symbolInfo && (
            <div className="glass overflow-hidden">
              <div className="h-[190px] sm:h-[170px]">
                <TradingViewWidget script="symbol-info" config={tv.symbolInfo(tvSymbol)} lazy={false} failureText="Market data temporarily unavailable" />
              </div>
            </div>
          )}

          <GlassCard
            title={<span className="flex items-center gap-2">Chart · <span className="font-mono text-neon-cyan">{tvSymbol}</span></span>}
            icon={<CandlestickChart />}
            badge={<TradingViewBadge className="hidden sm:inline-flex" />}
            bodyClassName="p-0"
          >
            <div className="h-[460px] sm:h-[600px]">
              <TradingViewChart symbol={tvSymbol} />
            </div>
          </GlassCard>

          <ProviderQuote ticker={ticker} />
          {provider.capabilities.bars && (
            <div className="h-[480px]">
              <SmartStockChart symbol={ticker} company={resolved.name} />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <ThesisNotes symbol={ticker} note={note} />
            <GlassCard title="Company profile" icon={<Building2 />} badge={<TradingViewBadge className="hidden sm:inline-flex" />} bodyClassName="p-0" collapseId="tv-profile">
              <div className="h-[330px]">
                <TradingViewWidget script="symbol-profile" config={tv.symbolProfile(tvSymbol)} failureText="Company profile temporarily unavailable" />
              </div>
            </GlassCard>
          </div>

          <TickerIntel ticker={ticker} />

          <div className="grid gap-3 lg:grid-cols-2">
            <GlassCard
              title={`Catalysts · ${catalysts.rows.length}`}
              icon={<Zap />}
              actions={
                <Link to="/catalysts" className="text-[11px] text-neon-cyan hover:underline">
                  Log one
                </Link>
              }
            >
              {catalysts.loading ? (
                <SkeletonRows rows={3} />
              ) : catalysts.rows.length === 0 ? (
                <EmptyState icon={<Zap />} title={`No catalysts for $${ticker}`} />
              ) : (
                <ul className="space-y-1.5">
                  {catalysts.rows.map((c) => (
                    <li key={c.id}>
                      <ClickRow to={`/catalysts?focus=${c.id}`} className="block rounded-xl border border-white/5 bg-white/[0.02] p-2.5 hover:border-neon-cyan/20">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge tone="violet">{c.catalyst_type}</Badge>
                          <Badge tone={BIAS_META[c.bias].tone}>{BIAS_META[c.bias].label}</Badge>
                          <Badge tone={CAT_STATUS_META[c.status].tone}>{CAT_STATUS_META[c.status].label}</Badge>
                          <span className="ml-auto font-mono text-[10px] text-slate-500">{fmtDate(c.catalyst_date)}</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300">{c.headline}</p>
                      </ClickRow>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            <GlassCard title={`Trade ideas · ${trades.rows.length}`} icon={<Swords />}>
              {trades.loading ? (
                <SkeletonRows rows={3} />
              ) : trades.rows.length === 0 ? (
                <EmptyState
                  icon={<Swords />}
                  title="No shared ideas yet"
                  action={
                    <Button size="sm" variant="outline" onClick={() => setTradeOpen(true)}>
                      Post one
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-1.5">
                  {trades.rows.map((t) => (
                    <li key={t.id}>
                      <ClickRow to={`/war-room?trade=${t.id}`} className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 hover:border-neon-cyan/20">
                        <Badge tone={t.direction === 'long' ? 'green' : 'red'}>{t.direction}</Badge>
                        <span className="min-w-0 flex-1 truncate text-xs text-slate-300">{t.thesis ?? t.catalyst ?? '—'}</span>
                        <Badge tone={STATUS_META[t.status].tone}>{STATUS_META[t.status].label}</Badge>
                      </ClickRow>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>

          <GlassCard title="Messages mentioning this ticker" icon={<MessageSquare />}>
            {mentions == null ? (
              <SkeletonRows rows={3} />
            ) : mentions.length === 0 ? (
              <EmptyState icon={<MessageSquare />} title={`Nobody has mentioned $${ticker} yet`} />
            ) : (
              <ul className="space-y-1">
                {mentions.map((m) => {
                  const p = profiles.find((x) => x.id === m.user_id);
                  return (
                    <li key={m.id}>
                      <ClickRow to={`/messages/${m.channel_id}`} className="flex gap-2.5 rounded-xl px-2 py-2 hover:bg-white/[0.03]">
                        <Avatar profile={p} size={24} />
                        <div className="min-w-0">
                          <div className="text-[11px]">
                            <span className="text-slate-300">{p?.display_name}</span> <span className="font-mono text-slate-600">{timeAgo(m.created_at)}</span>
                          </div>
                          <p className="line-clamp-2 text-xs text-slate-400">
                            <MessageContent text={m.content} />
                          </p>
                        </div>
                      </ClickRow>
                    </li>
                  );
                })}
              </ul>
            )}
          </GlassCard>
        </div>

        <div className="space-y-3 xl:col-span-3">
          <ScorePanel symbol={ticker} note={note} />
          <WatchControls symbol={ticker} />
        </div>
      </div>

      <TradeForm open={tradeOpen} onClose={() => setTradeOpen(false)} defaultSymbol={ticker} />
      <ShareStockModal key={tvSymbol} open={shareOpen} onClose={() => setShareOpen(false)} onShare={shareToStocks} initial={resolved} />
      <PriceAlertModal symbol={ticker} open={alertOpen} onClose={() => setAlertOpen(false)} lastPrice={null} />
    </div>
  );
}

/** SEC filings + ticker-tagged news for this stock (shared caches with Catalyst Intelligence). */
function TickerIntel({ ticker }: { ticker: string }) {
  const t = [ticker];
  const sec = intelView(useSecFilings(t), intelKeys.sec(t));
  const news = intelView(useNews(t), intelKeys.news(t));
  const events = mergeEvents(sec.events, news.events);
  return (
    <GlassCard title="SEC filings & company news" icon={<Zap />} collapseId="stock-intel" actions={<Link to={`/catalysts?tab=filings&ticker=${ticker}`} className="text-[11px] text-neon-cyan hover:underline">All filings</Link>}>
      <EventList
        events={events}
        loading={sec.loading && news.loading}
        error={sec.error && news.error ? `${sec.error} · ${news.error}` : undefined}
        sources={[...(sec.sources ?? []), ...(news.sources ?? [])]}
        fetchedAt={sec.fetchedAt}
        stale={sec.stale || news.stale}
        onRefresh={() => {
          sec.onRefresh();
          news.onRefresh();
        }}
        limit={10}
        emptyTitle={`No recent filings or tagged news for $${ticker}`}
      />
    </GlassCard>
  );
}
