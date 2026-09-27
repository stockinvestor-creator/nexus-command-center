import { WhyButton } from '@/features/why/WhyButton';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Edit3, FolderPlus, ListFilter, Pencil, Plus, Star, StickyNote, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { DataSourceBadge, MarketUnavailable, TradingViewBadge } from '@/components/ui/DataSource';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { WatchlistQuotes } from '@/features/watchlist/WatchlistQuotes';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import {
  addToWatchlist,
  createWatchlist,
  deleteWatchlist,
  removeWatchItem,
  renameWatchlist,
  updateWatchItem,
  useMyWatchlist,
} from '@/features/watchlist/api';
import { useQuotes } from '@/hooks/useMarket';
import { marketData } from '@/services/market';
import { RISK_LEVELS, WATCH_CATEGORIES, WATCH_DIRECTIONS, type RiskLevel, type WatchCategory, type WatchDirection, type WatchlistItem } from '@/types/db';
import type { Quote } from '@/types/market';
import { cn } from '@/lib/cn';
import { daysUntil, fmtDate, fmtPct, fmtPrice, trendClass } from '@/lib/format';
import { attempt, toast } from '@/store/toastStore';

const RISK_TONE: Record<RiskLevel, Tone> = { low: 'green', medium: 'blue', high: 'amber', extreme: 'red' };
const DIR_TONE: Record<WatchDirection, Tone> = { long: 'green', short: 'red', watch: 'neutral' };
type SortKey = 'manual' | 'symbol' | 'change' | 'catalyst' | 'risk';

function CatalystBadge({ date }: { date: string | null }) {
  const d = daysUntil(date);
  if (d == null) return <span className="text-slate-600">—</span>;
  if (d < 0) return <Badge tone="neutral" title={fmtDate(date)}>passed</Badge>;
  const tone: Tone = d <= 3 ? 'red' : d <= 10 ? 'amber' : 'cyan';
  return (
    <Badge tone={tone} title={fmtDate(date)}>
      ⚡ {d === 0 ? 'today' : `${d}d`}
    </Badge>
  );
}


function ItemEditor({ item, onClose }: { item: WatchlistItem | null; onClose: () => void }) {
  const [draft, setDraft] = useState<WatchlistItem | null>(item);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(item), [item]);
  if (!draft) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const set = <K extends keyof WatchlistItem>(k: K, v: WatchlistItem[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));
  const save = async () => {
    setSaving(true);
    const ok = await attempt(
      () =>
        updateWatchItem(draft.id, {
          favorite: draft.favorite,
          notes: draft.notes?.trim() || null,
          thesis: draft.thesis?.trim() || null,
          category: draft.category,
          risk_level: draft.risk_level,
          catalyst_date: draft.catalyst_date || null,
          direction: draft.direction,
          company: draft.company?.trim() || null,
        }),
      'Could not save',
    );
    setSaving(false);
    if (ok) {
      toast.success(`$${draft.symbol} updated`);
      onClose();
    }
  };
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      title={`Edit $${draft.symbol}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company">
          <Input value={draft.company ?? ''} onChange={(e) => set('company', e.target.value)} />
        </Field>
        <Field label="Favorite">
          <Button variant={draft.favorite ? 'outline' : 'secondary'} className="w-full" onClick={() => set('favorite', !draft.favorite)} icon={<Star className={cn('h-4 w-4', draft.favorite && 'fill-current')} />}>
            {draft.favorite ? 'Favorited' : 'Mark favorite'}
          </Button>
        </Field>
        <Field label="Direction">
          <Select value={draft.direction} onChange={(v) => set('direction', v)} options={WATCH_DIRECTIONS.map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) }))} />
        </Field>
        <Field label="Category">
          <Select value={draft.category} onChange={(v) => set('category', v)} options={WATCH_CATEGORIES} />
        </Field>
        <Field label="Risk level">
          <Select value={draft.risk_level} onChange={(v) => set('risk_level', v)} options={RISK_LEVELS.map((r) => ({ value: r, label: r[0].toUpperCase() + r.slice(1) }))} />
        </Field>
        <Field label="Expected catalyst date">
          <Input type="date" value={draft.catalyst_date ?? ''} onChange={(e) => set('catalyst_date', e.target.value || null)} />
        </Field>
        <Field label="Thesis" className="sm:col-span-2">
          <Textarea rows={4} value={draft.thesis ?? ''} onChange={(e) => set('thesis', e.target.value)} placeholder="Why is this on the list?" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={draft.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="Levels, reminders, links…" />
        </Field>
      </div>
    </Modal>
  );
}

export default function WatchlistPage() {
  const { lists, active, items, setActiveId } = useMyWatchlist();
  const quotes = useQuotes(items.rows.map((i) => i.symbol));
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState<'All' | WatchCategory>('All');
  const [dir, setDir] = useState<'all' | WatchDirection>('all');
  const [sort, setSort] = useState<SortKey>('manual');
  const [editing, setEditing] = useState<WatchlistItem | null>(null);
  const [listModal, setListModal] = useState<null | 'new' | 'rename'>(null);
  const [listName, setListName] = useState('');

  const rows = useMemo(() => {
    const q = filter.trim().toUpperCase();
    const riskOrder = { low: 0, medium: 1, high: 2, extreme: 3 };
    const out = items.rows.filter(
      (i) =>
        (cat === 'All' || i.category === cat) &&
        (dir === 'all' || i.direction === dir) &&
        (!q || i.symbol.includes(q) || (i.company ?? '').toUpperCase().includes(q) || (i.notes ?? '').toUpperCase().includes(q)),
    );
    const qd = quotes.data ?? {};
    const sorters: Record<SortKey, (a: WatchlistItem, b: WatchlistItem) => number> = {
      manual: (a, b) => Number(b.favorite) - Number(a.favorite) || a.sort_order - b.sort_order,
      symbol: (a, b) => a.symbol.localeCompare(b.symbol),
      change: (a, b) => (qd[b.symbol]?.changePercent ?? -999) - (qd[a.symbol]?.changePercent ?? -999),
      catalyst: (a, b) => (daysUntil(a.catalyst_date) ?? 9999) - (daysUntil(b.catalyst_date) ?? 9999),
      risk: (a, b) => riskOrder[b.risk_level] - riskOrder[a.risk_level],
    };
    return [...out].sort(sorters[sort]);
  }, [items.rows, filter, cat, dir, sort, quotes.data]);

  const add = async (symbol: string, company?: string | null) => {
    if (!active) return;
    if (items.rows.some((i) => i.symbol === symbol)) return toast.info(`$${symbol} is already on ${active.name}`);
    const row = await attempt(() => addToWatchlist(active.id, symbol, { company: company || undefined, sort_order: items.rows.length }), 'Could not add ticker');
    if (row) {
      items.mutate((r) => (r.some((x) => x.id === row.id) ? r : [...r, row]));
      toast.success(`Added $${symbol}`);
    }
  };

  const toggleFav = (i: WatchlistItem) => {
    items.mutate((r) => r.map((x) => (x.id === i.id ? { ...x, favorite: !x.favorite } : x)));
    void attempt(() => updateWatchItem(i.id, { favorite: !i.favorite }));
  };
  const remove = (i: WatchlistItem) => {
    items.mutate((r) => r.filter((x) => x.id !== i.id));
    void attempt(() => removeWatchItem(i.id));
  };

  const saveList = async () => {
    const name = listName.trim();
    if (!name) return;
    if (listModal === 'new') {
      const l = await attempt(() => createWatchlist(name));
      if (l) setActiveId(l.id);
    } else if (active) await attempt(() => renameWatchlist(active.id, name));
    setListModal(null);
  };

  const quoteSupport = marketData().capabilities.quotes;
  const firstQuote = quotes.data ? Object.values(quotes.data)[0] : undefined;

  return (
    <div>
      <PageHeader
        title="Watchlist"
        subtitle="Tickers you're tracking, with thesis, risk and catalyst timing."
        actions={
          <>
            {lists.rows.length > 0 && active && (
              <Select className="w-44" value={active.id} onChange={setActiveId} options={lists.rows.map((l) => ({ value: l.id, label: l.name }))} />
            )}
            <IconButton
              label="Rename list"
              onClick={() => {
                setListName(active?.name ?? '');
                setListModal('rename');
              }}
            >
              <Pencil className="h-4 w-4" />
            </IconButton>
            <Button
              size="sm"
              icon={<FolderPlus className="h-4 w-4" />}
              onClick={() => {
                setListName('');
                setListModal('new');
              }}
            >
              New list
            </Button>
            {lists.rows.length > 1 && active && (
              <ConfirmButton
                onConfirm={async () => {
                  await attempt(() => deleteWatchlist(active.id));
                  const next = lists.rows.find((l) => l.id !== active.id);
                  if (next) setActiveId(next.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete list
              </ConfirmButton>
            )}
          </>
        }
      />
      <div className="space-y-3 px-3 sm:px-5">
        <GlassCard bodyClassName="p-3">
          <div className="grid gap-2 md:grid-cols-[1.4fr_1fr_auto_auto_auto]">
            <SymbolSearch onSelect={(m) => void add(m.ticker, m.name)} placeholder="Add ticker ($MU, Micron…) and press Enter" />
            <div className="relative">
              <ListFilter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input className="pl-9" placeholder="Filter list…" value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
            <Select value={cat} onChange={setCat} options={['All', ...WATCH_CATEGORIES] as const} className="md:w-36" />
            <Select value={dir} onChange={setDir} options={[{ value: 'all', label: 'All sides' }, { value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }, { value: 'watch', label: 'Watch' }]} className="md:w-32" />
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: 'manual', label: 'Favorites first' },
                { value: 'symbol', label: 'Ticker A–Z' },
                { value: 'change', label: 'Daily change' },
                { value: 'catalyst', label: 'Next catalyst' },
                { value: 'risk', label: 'Highest risk' },
              ]}
              className="md:w-40"
            />
          </div>
        </GlassCard>

        {items.rows.length > 0 && (
          <GlassCard title="Prices" icon={<Star />} badge={<TradingViewBadge />} bodyClassName="p-0" collapseId="wl-tv-quotes">
            <WatchlistQuotes title={active?.name ?? 'Watchlist'} tickers={rows.map((r) => r.symbol)} heightClass="h-[320px]" />
          </GlassCard>
        )}

        <GlassCard
          title={active ? `${active.name} · ${items.rows.length} tickers` : 'Watchlist'}
          icon={<Star />}
          badge={firstQuote ? <DataSourceBadge provenance={firstQuote.provenance} /> : <span className="hidden text-[10px] text-slate-500 sm:inline">Your data · prices in the TradingView panel above</span>}
          bodyClassName="p-0"
        >
          {items.loading || lists.loading ? (
            <div className="p-4">
              <SkeletonRows rows={6} />
            </div>
          ) : items.error ? (
            <p className="p-4 text-sm text-amber-400">{items.error}</p>
          ) : rows.length === 0 ? (
            <EmptyState icon={<Plus />} title={items.rows.length ? 'No tickers match your filters' : 'Your watchlist is empty'} body="Use the search above to add a ticker." />
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5 text-left">
                      {['', 'Ticker', ...(quoteSupport ? [`Price (${marketData().sourceLabel})`, 'Day'] : []), 'Side', 'Category', 'Risk', 'Catalyst', 'Thesis / notes', ''].map((h, i) => (
                        <th key={i} className="label px-3 py-2.5 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((i) => (
                      <WatchRow key={i.id} item={i} showQuotes={quoteSupport} quote={quotes.data?.[i.symbol]} onFav={() => toggleFav(i)} onEdit={() => setEditing(i)} onRemove={() => remove(i)} />
                    ))}
                  </tbody>
                </table>
              </div>
              {/* mobile cards */}
              <div className="divide-y divide-white/5 md:hidden">
                {rows.map((i) => {
                  const q = quotes.data?.[i.symbol];
                  return (
                    <div key={i.id} className="flex items-center gap-3 px-3 py-3">
                      <button onClick={() => toggleFav(i)} aria-label="Favorite">
                        <Star className={cn('h-4 w-4', i.favorite ? 'fill-amber-300 text-amber-300' : 'text-slate-600')} />
                      </button>
                      <Link to={`/stock/${i.symbol}`} className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-semibold text-white">{i.symbol}</span>
                          <Badge tone={DIR_TONE[i.direction]}>{i.direction}</Badge>
                          <CatalystBadge date={i.catalyst_date} />
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {i.category} · {i.risk_level} risk
                        </div>
                      </Link>
                      {quoteSupport && (
                        <div className="text-right font-mono text-xs">
                          <div className="text-slate-200">{q ? fmtPrice(q.price) : '—'}</div>
                          <div className={trendClass(q?.changePercent)}>{q ? fmtPct(q.changePercent) : ''}</div>
                        </div>
                      )}
                      <WhyButton symbol={i.symbol} compact />
                      <IconButton label="Edit" onClick={() => setEditing(i)}>
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </GlassCard>
      </div>

      <ItemEditor item={editing} onClose={() => setEditing(null)} />
      <Modal
        open={listModal != null}
        onClose={() => setListModal(null)}
        title={listModal === 'new' ? 'New watchlist' : 'Rename watchlist'}
        size="sm"
        footer={
          <Button variant="primary" onClick={saveList}>
            Save
          </Button>
        }
      >
        <Field label="Name">
          <Input autoFocus value={listName} onChange={(e) => setListName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveList()} placeholder="e.g. Earnings week" />
        </Field>
      </Modal>
    </div>
  );
}

function WatchRow({ item: i, quote: q, showQuotes, onFav, onEdit, onRemove }: { item: WatchlistItem; quote?: Quote; showQuotes: boolean; onFav: () => void; onEdit: () => void; onRemove: () => void }) {
  return (
    <tr className="group border-b border-white/[0.03] transition hover:bg-white/[0.02]">
      <td className="w-8 px-3 py-2.5">
        <button onClick={onFav} aria-label="Toggle favorite">
          <Star className={cn('h-4 w-4 transition', i.favorite ? 'fill-amber-300 text-amber-300' : 'text-slate-600 hover:text-slate-300')} />
        </button>
      </td>
      <td className="px-3 py-2.5">
        <Link to={`/stock/${i.symbol}`} className="block">
          <span className="font-mono font-semibold text-white hover:text-neon-cyan">{i.symbol}</span>
          <span className="block max-w-[180px] truncate text-[11px] text-slate-500">{i.company ?? ''}</span>
        </Link>
      </td>
      {showQuotes && (
        <>
          <td className="num px-3 py-2.5 text-slate-200">{q ? fmtPrice(q.price) : <MarketUnavailable compact />}</td>
          <td className={cn('num px-3 py-2.5', trendClass(q?.changePercent))}>{q ? fmtPct(q.changePercent) : <MarketUnavailable compact />}</td>
        </>
      )}
      <td className="px-3 py-2.5">
        <Badge tone={DIR_TONE[i.direction]}>{i.direction}</Badge>
      </td>
      <td className="px-3 py-2.5">
        <Badge tone="violet">{i.category}</Badge>
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={RISK_TONE[i.risk_level]}>{i.risk_level}</Badge>
      </td>
      <td className="px-3 py-2.5">
        <CatalystBadge date={i.catalyst_date} />
      </td>
      <td className="max-w-[260px] px-3 py-2.5">
        {i.thesis || i.notes ? (
          <button onClick={onEdit} className="flex items-start gap-1.5 text-left text-xs text-slate-400 hover:text-slate-200">
            <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{i.thesis || i.notes}</span>
          </button>
        ) : (
          <button onClick={onEdit} className="text-xs text-slate-600 hover:text-neon-cyan">
            + add thesis
          </button>
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-end gap-0.5">
          <WhyButton symbol={i.symbol} compact className="mr-1" />
          <IconButton label="Edit" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <ConfirmButton onConfirm={onRemove} confirmLabel="Remove?">
            <Trash2 className="h-4 w-4" />
          </ConfirmButton>
        </div>
      </td>
    </tr>
  );
}
