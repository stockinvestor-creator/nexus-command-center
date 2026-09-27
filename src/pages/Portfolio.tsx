import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Briefcase, Calculator, ImagePlus, LineChart, Plus, Wallet } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Tabs } from '@/components/ui/Tabs';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { DataSourceBadge } from '@/components/ui/DataSource';
import { TickerChip } from '@/components/ui/TickerChip';
import { WhyButton } from '@/features/why/WhyButton';
import { PositionForm } from '@/features/portfolio/PositionForm';
import { applyTransaction, closedReturnPct, computeStats, holdingDays, scenario, txLabel, unrealized, updateJournal, uploadScreenshot } from '@/features/portfolio/api';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useQuotes } from '@/hooks/useMarket';
import { useImageUrl } from '@/hooks/useImageUrl';
import { useAuth } from '@/store/authStore';
import { useMyWatchlist } from '@/features/watchlist/api';
import { marketData } from '@/services/market';
import { attempt, toast } from '@/store/toastStore';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fmtNumber, fmtPct, fmtPrice, trendClass } from '@/lib/format';
import type { SimDirection, SimPosition, SimTransaction } from '@/types/db';

type Tab = 'positions' | 'pnl' | 'journal' | 'scenario';

export const SimLabel = () => (
  <Badge tone="amber" title="No brokerage connection. All positions are simulated with prices you enter.">
    Simulated portfolio
  </Badge>
);

const signed = (v: number) => `${v >= 0 ? '+' : ''}${fmtPrice(v)}`;

export default function Portfolio() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) ?? 'positions';
  const uid = useAuth((s) => s.user?.id);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const positions = useLiveTable(uid ? 'sim_positions' : null, { eq: { owner_id: uid ?? '' }, order: { column: 'opened_at', ascending: false } });
  const txs = useLiveTable(uid ? 'sim_transactions' : null, { eq: { user_id: uid ?? '' }, order: { column: 'executed_at', ascending: true } });
  const open = positions.rows.filter((p) => p.status === 'open');
  const quotes = useQuotes(open.map((p) => p.symbol));
  const priceOf = (s: string) => quotes.data?.[s]?.price ?? null;

  return (
    <div>
      <PageHeader
        title="Portfolio Simulator"
        subtitle="Paper positions, P&L and a trade journal. No brokerage, no real money."
        actions={
          <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
            New position
          </Button>
        }
      />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={tab}
            onChange={(t) => setParams({ tab: t })}
            options={[
              { value: 'positions', label: 'Positions', count: open.length },
              { value: 'pnl', label: 'P&L dashboard' },
              { value: 'journal', label: 'Trade journal' },
              { value: 'scenario', label: 'Scenario calculator' },
            ]}
          />
          <SimLabel />
        </div>
        {positions.loading ? (
          <SkeletonRows rows={5} />
        ) : (
          <>
            {tab === 'positions' && <Positions open={open} priceOf={priceOf} quotes={quotes.data} onNew={() => setCreating(true)} />}
            {tab === 'pnl' && <PnlDashboard positions={positions.rows} txs={txs.rows} priceOf={priceOf} />}
            {tab === 'journal' && <Journal positions={positions.rows} txs={txs.rows} />}
            {tab === 'scenario' && <Scenario positions={open} priceOf={priceOf} />}
          </>
        )}
      </div>
      <PositionForm open={creating} onClose={() => setCreating(false)} initialSymbol={params.get('symbol') ?? ''} tradeIdeaId={params.get('trade')} />
    </div>
  );
}

function PriceCell({ price }: { price: number | null }) {
  if (price == null)
    return (
      <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500" title={marketData().capabilities.quotes ? 'Quote unavailable right now' : 'No verified quote provider configured (Settings → Market data)'}>
        Price unavailable
      </span>
    );
  return <span className="font-mono text-slate-100">{fmtPrice(price)}</span>;
}

function Positions({ open, priceOf, quotes, onNew }: { open: SimPosition[]; priceOf: (s: string) => number | null; quotes?: Record<string, { provenance: import('@/types/market').Provenance }>; onNew: () => void }) {
  const [tx, setTx] = useState<SimPosition | null>(null);
  const first = quotes ? Object.values(quotes)[0] : undefined;
  if (!open.length) return <EmptyState icon={<Briefcase />} title="No open simulated positions" body="Open a paper position to track P&L against verified quotes." action={<Button size="sm" variant="outline" onClick={onNew}>New position</Button>} />;
  const totals = open.reduce(
    (a, p) => {
      const u = unrealized(p, priceOf(p.symbol));
      a.cost += p.shares * p.avg_entry;
      if (u) {
        a.pnl += u.dollars;
        a.priced += 1;
      }
      return a;
    },
    { cost: 0, pnl: 0, priced: 0 },
  );
  return (
    <GlassCard title="Open positions" icon={<Wallet />} badge={first && <DataSourceBadge provenance={first.provenance} />} bodyClassName="p-0">
      <div className="grid grid-cols-3 gap-2 border-b border-white/[0.05] p-3">
        <Stat label="Cost basis" value={fmtPrice(totals.cost)} />
        <Stat label="Unrealized P&L" value={totals.priced ? signed(totals.pnl) : 'PRICE UNAVAILABLE'} tone={totals.priced ? trendClass(totals.pnl) : 'text-slate-500'} hint={totals.priced && totals.priced < open.length ? `${totals.priced}/${open.length} positions priced` : undefined} />
        <Stat label="Positions" value={String(open.length)} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              {['Ticker', 'Side', 'Shares', 'Avg entry', 'Price', 'Unrealized', 'Target / Stop', 'Held', ''].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {open.map((p) => {
              const price = priceOf(p.symbol);
              const u = unrealized(p, price);
              return (
                <tr key={p.id} className="border-t border-white/[0.04]">
                  <td className="px-3 py-2"><TickerChip symbol={p.symbol} /></td>
                  <td className="px-3 py-2"><Badge tone={p.direction === 'long' ? 'green' : 'red'}>{p.direction}</Badge></td>
                  <td className="px-3 py-2 font-mono">{fmtNumber(p.shares, p.shares % 1 ? 2 : 0)}</td>
                  <td className="px-3 py-2 font-mono">{fmtPrice(p.avg_entry)}</td>
                  <td className="px-3 py-2"><PriceCell price={price} /></td>
                  <td className={cn('px-3 py-2 font-mono', u ? trendClass(u.dollars) : 'text-slate-500')}>{u ? `${signed(u.dollars)} (${fmtPct(u.pct)})` : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{p.target ? fmtPrice(p.target) : '—'} / {p.stop ? fmtPrice(p.stop) : '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-400">{holdingDays(p)}d</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <WhyButton symbol={p.symbol} compact />
                      <Button size="xs" variant="outline" onClick={() => setTx(p)}>Trade</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tx && <TransactionModal pos={tx} price={priceOf(tx.symbol)} onClose={() => setTx(null)} />}
    </GlassCard>
  );
}

function Stat({ label, value, tone = 'text-slate-100', hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn('mt-0.5 truncate font-mono text-sm', tone)}>{value}</p>
      {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
    </div>
  );
}

function TransactionModal({ pos, price, onClose }: { pos: SimPosition; price: number | null; onClose: () => void }) {
  const [type, setType] = useState<'add' | 'reduce' | 'close'>('add');
  const [shares, setShares] = useState('');
  const [px, setPx] = useState(price != null ? String(price) : '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const p = Number(px);
    const s = type === 'close' ? null : Number(shares);
    if (!(p > 0)) return toast.error('Enter a positive price');
    if (type !== 'close' && !(s && s > 0)) return toast.error('Enter a positive share quantity');
    setBusy(true);
    const r = await attempt(() => applyTransaction(pos.id, type, s, p, note), 'Transaction failed');
    setBusy(false);
    if (r) {
      toast.success(`${txLabel[type]} recorded for ${pos.symbol}`);
      onClose();
    }
  };
  const preview = type !== 'add' && Number(px) > 0 ? scenario(pos.direction, type === 'close' ? pos.shares : Number(shares) || 0, pos.avg_entry, Number(px)) : null;
  return (
    <Modal
      open
      onClose={onClose}
      title={`Trade simulated ${pos.symbol}`}
      size="sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="primary" loading={busy} onClick={submit}>Record</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Tabs value={type} onChange={setType} options={[{ value: 'add', label: 'Add' }, { value: 'reduce', label: 'Reduce' }, { value: 'close', label: 'Close all' }]} />
        <p className="text-xs text-slate-400">
          Open: {fmtNumber(pos.shares, pos.shares % 1 ? 2 : 0)} sh {pos.direction} @ {fmtPrice(pos.avg_entry)} avg
        </p>
        {type !== 'close' && <Field label="Shares"><Input type="number" min="0" step="any" value={shares} onChange={(e) => setShares(e.target.value)} /></Field>}
        <Field label="Price" hint={price != null ? 'Pre-filled from the configured quote provider — edit to your fill' : 'Type your fill price (no verified quote available)'}>
          <Input type="number" min="0" step="any" value={px} onChange={(e) => setPx(e.target.value)} />
        </Field>
        <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        {preview && <p className={cn('font-mono text-xs', trendClass(preview.dollars))}>Realized on this fill: {signed(preview.dollars)} ({fmtPct(preview.pct)})</p>}
      </div>
    </Modal>
  );
}

function PnlDashboard({ positions, txs, priceOf }: { positions: SimPosition[]; txs: SimTransaction[]; priceOf: (s: string) => number | null }) {
  const stats = computeStats(positions);
  const wl = useMyWatchlist();
  const catOf = useMemo(() => new Map(wl.items.rows.map((i) => [i.symbol, i.category])), [wl.items.rows]);
  const open = positions.filter((p) => p.status === 'open');
  const exposure = useMemo(() => {
    const m = new Map<string, number>();
    let total = 0;
    for (const p of open) {
      const v = p.shares * p.avg_entry;
      total += v;
      const k = catOf.get(p.symbol) ?? 'Uncategorized';
      m.set(k, (m.get(k) ?? 0) + v);
    }
    return { rows: [...m.entries()].sort((a, b) => b[1] - a[1]), total };
  }, [open, catOf]);
  const unreal = open.map((p) => unrealized(p, priceOf(p.symbol)));
  const priced = unreal.filter(Boolean);
  const unrealTotal = priced.reduce((s, u) => s + (u?.dollars ?? 0), 0);
  // cumulative realized P&L by transaction
  const curve = useMemo(() => {
    let c = 0;
    return txs.filter((t) => t.realized_pnl !== 0).map((t) => ({ at: t.executed_at, v: (c += t.realized_pnl) }));
  }, [txs]);
  const n = stats.closedCount;
  return (
    <div className="grid gap-3 lg:grid-cols-12">
      <GlassCard className="lg:col-span-8" title="Performance" icon={<LineChart />} badge={<SimLabel />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Realized P&L" value={signed(stats.realizedTotal)} tone={trendClass(stats.realizedTotal)} />
          <Stat label="Unrealized P&L" value={priced.length ? signed(unrealTotal) : 'PRICE UNAVAILABLE'} tone={priced.length ? trendClass(unrealTotal) : 'text-slate-500'} hint={open.length ? `${priced.length}/${open.length} priced` : undefined} />
          <Stat label="Win rate" value={stats.winRate == null ? '—' : `${stats.winRate.toFixed(0)}%`} hint={`n = ${stats.wins + stats.losses} closed (non-flat)`} />
          <Stat label="Profit factor" value={stats.profitFactor == null ? '—' : stats.profitFactor.toFixed(2)} hint={`n = ${n} closed`} />
          <Stat label="Avg win" value={stats.avgWin == null ? '—' : signed(stats.avgWin)} tone="text-bull" hint={`n = ${stats.wins}`} />
          <Stat label="Avg loss" value={stats.avgLoss == null ? '—' : signed(stats.avgLoss)} tone="text-bear" hint={`n = ${stats.losses}`} />
          <Stat label="Best" value={stats.best ? `${stats.best.symbol} ${signed(stats.best.realized_pnl)}` : '—'} />
          <Stat label="Worst" value={stats.worst ? `${stats.worst.symbol} ${signed(stats.worst.realized_pnl)}` : '—'} />
          <Stat label="Avg holding period" value={stats.avgHoldDays == null ? '—' : `${stats.avgHoldDays.toFixed(1)} days`} hint={`n = ${n}`} />
        </div>
        {n > 0 && n < 20 && <p className="mt-2 text-[11px] text-amber-200/80">Small sample ({n} closed positions). These statistics describe your history only; they are not predictive.</p>}
        <div className="mt-4">
          <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">Cumulative realized P&L</p>
          {curve.length < 2 ? <p className="text-xs text-slate-500">Needs at least two realized fills.</p> : <Sparkline points={curve.map((c) => c.v)} labels={curve.map((c) => fmtDate(c.at))} />}
        </div>
      </GlassCard>
      <GlassCard className="lg:col-span-4" title="Exposure" icon={<Wallet />}>
        <p className="mb-2 text-[11px] text-slate-500">At cost basis, grouped by your watchlist category label.</p>
        {exposure.rows.length === 0 ? (
          <p className="text-xs text-slate-500">No open positions.</p>
        ) : (
          <ul className="space-y-2">
            {exposure.rows.map(([k, v]) => (
              <li key={k}>
                <div className="flex justify-between text-xs"><span className="text-slate-300">{k}</span><span className="font-mono text-slate-400">{((v / exposure.total) * 100).toFixed(1)}%</span></div>
                <div className="mt-1 h-1.5 rounded bg-white/5"><div className="h-full rounded bg-neon-cyan/60" style={{ width: `${(v / exposure.total) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </div>
  );
}

function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
  const w = 600;
  const h = 120;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const y = (v: number) => h - ((v - min) / (max - min || 1)) * (h - 8) - 4;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const d = points.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full" preserveAspectRatio="none" role="img" aria-label="Cumulative realized P&L">
      <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="rgba(148,163,184,0.2)" strokeDasharray="4 4" />
      <path d={d} fill="none" stroke={last >= 0 ? '#34d399' : '#fb7185'} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={v >= 0 ? '#34d399' : '#fb7185'}>
          <title>{`${labels[i]}: ${fmtPrice(v)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

function Journal({ positions, txs }: { positions: SimPosition[]; txs: SimTransaction[] }) {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('closed');
  const list = positions.filter((p) => filter === 'all' || p.status === filter);
  return (
    <div className="space-y-3">
      <Tabs value={filter} onChange={setFilter} options={[{ value: 'closed', label: 'Closed' }, { value: 'open', label: 'Open' }, { value: 'all', label: 'All' }]} />
      {list.length === 0 ? <EmptyState icon={<BookOpen />} title="Nothing to journal yet" /> : list.map((p) => <JournalEntry key={p.id} p={p} txs={txs.filter((t) => t.position_id === p.id)} />)}
    </div>
  );
}

function JournalEntry({ p, txs }: { p: SimPosition; txs: SimTransaction[] }) {
  const [mistakes, setMistakes] = useState(p.mistakes ?? '');
  const [lessons, setLessons] = useState(p.lessons ?? '');
  const [result, setResult] = useState(p.result_notes ?? '');
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = mistakes !== (p.mistakes ?? '') || lessons !== (p.lessons ?? '') || result !== (p.result_notes ?? '');
  const ret = closedReturnPct(p);
  return (
    <GlassCard
      title={<span className="flex items-center gap-2"><TickerChip symbol={p.symbol} /> <Badge tone={p.direction === 'long' ? 'green' : 'red'}>{p.direction}</Badge> <Badge tone={p.status === 'open' ? 'cyan' : 'neutral'}>{p.status}</Badge></span>}
      actions={<span className={cn('font-mono text-xs', trendClass(p.realized_pnl))}>{p.realized_pnl ? `${signed(p.realized_pnl)}${ret != null ? ` (${fmtPct(ret)})` : ''}` : ''}</span>}
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2 text-xs text-slate-400">
          <p>Opened {fmtDate(p.entry_date)} · held {holdingDays(p)}d{p.closed_at ? ` · closed ${fmtDate(p.closed_at)}` : ''}</p>
          {p.thesis && <p><span className="text-slate-500">Thesis:</span> <span className="text-slate-300">{p.thesis}</span></p>}
          {p.catalyst && <p><span className="text-slate-500">Catalyst:</span> {p.catalyst}</p>}
          <ul className="space-y-0.5 font-mono text-[11px]">
            {txs.map((t) => (
              <li key={t.id}>
                {fmtDateTime(t.executed_at)} · {txLabel[t.type]} {fmtNumber(t.shares, t.shares % 1 ? 2 : 0)} @ {fmtPrice(t.price)}
                {t.realized_pnl ? <span className={trendClass(t.realized_pnl)}> · {signed(t.realized_pnl)}</span> : null}
                {t.note && <span className="text-slate-500"> — {t.note}</span>}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {(p.screenshots ?? []).map((s) => <Shot key={s} path={s} />)}
            <button onClick={() => file.current?.click()} className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-white/15 text-slate-500 hover:border-neon-cyan/40 hover:text-neon-cyan" title="Add screenshot">
              <ImagePlus className="h-4 w-4" />
            </button>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) await attempt(() => uploadScreenshot(p, f), 'Upload failed');
              }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Field label="Result notes"><Textarea value={result} onChange={(e) => setResult(e.target.value)} className="min-h-[56px]" /></Field>
          <Field label="Mistakes"><Textarea value={mistakes} onChange={(e) => setMistakes(e.target.value)} className="min-h-[56px]" /></Field>
          <Field label="Lessons"><Textarea value={lessons} onChange={(e) => setLessons(e.target.value)} className="min-h-[56px]" /></Field>
          {dirty && (
            <Button
              size="xs"
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                await attempt(() => updateJournal(p.id, { mistakes: mistakes || null, lessons: lessons || null, result_notes: result || null }), 'Could not save');
                setBusy(false);
              }}
            >
              Save journal
            </Button>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

function Shot({ path }: { path: string }) {
  const { url } = useImageUrl(path);
  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img src={url} alt="Trade screenshot" className="h-16 w-24 rounded-lg border border-white/10 object-cover" />
    </a>
  ) : (
    <div className="h-16 w-24 animate-pulse rounded-lg bg-white/5" />
  );
}

function Scenario({ positions, priceOf }: { positions: SimPosition[]; priceOf: (s: string) => number | null }) {
  const [pick, setPick] = useState<string>(positions[0]?.id ?? 'custom');
  const pos = positions.find((p) => p.id === pick);
  const [dir, setDir] = useState<SimDirection>('long');
  const [shares, setShares] = useState('100');
  const [entry, setEntry] = useState('');
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');
  const d = pos?.direction ?? dir;
  const sh = pos?.shares ?? Number(shares);
  const en = pos?.avg_entry ?? Number(entry);
  const cur = pos ? priceOf(pos.symbol) : null;
  const tg = Number(target || pos?.target || 0);
  const st = Number(stop || pos?.stop || 0);
  const up = tg > 0 && en > 0 ? scenario(d, sh, en, tg) : null;
  const down = st > 0 && en > 0 ? scenario(d, sh, en, st) : null;
  const rr = up && down && down.dollars < 0 ? up.dollars / Math.abs(down.dollars) : null;
  const moves = [-20, -10, -5, 5, 10, 20];
  return (
    <GlassCard title="Scenario calculator" icon={<Calculator />} badge={<Badge tone="violet">User scenario · not a forecast</Badge>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Position">
          <Select value={pick} onChange={setPick} options={[...positions.map((p) => ({ value: p.id, label: `${p.symbol} ${p.direction} ${p.shares}` })), { value: 'custom', label: 'Custom…' }]} />
        </Field>
        {!pos && (
          <>
            <Field label="Direction"><Select value={dir} onChange={setDir} options={[{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]} /></Field>
            <Field label="Shares"><Input type="number" value={shares} onChange={(e) => setShares(e.target.value)} /></Field>
            <Field label="Entry"><Input type="number" step="any" value={entry} onChange={(e) => setEntry(e.target.value)} /></Field>
          </>
        )}
        <Field label="Target price"><Input type="number" step="any" value={target} placeholder={pos?.target ? String(pos.target) : ''} onChange={(e) => setTarget(e.target.value)} /></Field>
        <Field label="Stop price"><Input type="number" step="any" value={stop} placeholder={pos?.stop ? String(pos.stop) : ''} onChange={(e) => setStop(e.target.value)} /></Field>
      </div>
      {en > 0 && sh > 0 ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Current price" value={cur != null ? fmtPrice(cur) : 'PRICE UNAVAILABLE'} tone={cur != null ? 'text-slate-100' : 'text-slate-500'} />
            <Stat label="At target" value={up ? `${signed(up.dollars)} (${fmtPct(up.pct)})` : '—'} tone={up ? trendClass(up.dollars) : undefined} />
            <Stat label="At stop" value={down ? `${signed(down.dollars)} (${fmtPct(down.pct)})` : '—'} tone={down ? trendClass(down.dollars) : undefined} />
            <Stat label="Reward : risk" value={rr ? `${rr.toFixed(2)} : 1` : '—'} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="font-mono text-[10px] uppercase text-slate-500"><tr><th className="py-1 text-left">Underlying move from entry</th>{moves.map((m) => <th key={m} className="py-1 text-right">{m > 0 ? '+' : ''}{m}%</th>)}</tr></thead>
              <tbody>
                <tr>
                  <td className="py-1 text-slate-400">P&L</td>
                  {moves.map((m) => {
                    const s = scenario(d, sh, en, en * (1 + m / 100));
                    return <td key={m} className={cn('py-1 text-right font-mono', trendClass(s.dollars))}>{signed(s.dollars)}</td>;
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Enter shares and an entry price.</p>
      )}
    </GlassCard>
  );
}
