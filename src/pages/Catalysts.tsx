import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, Edit3, ExternalLink, Filter, Plus, Target, Trash2, Zap } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, Input, Select, Slider, Textarea } from '@/components/ui/Field';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { TickerChip } from '@/components/ui/TickerChip';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { MessageContent } from '@/features/chat/MessageContent';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { BIAS_META, CAT_STATUS_META, createCatalyst, deleteCatalyst, IMPACT_META, updateCatalyst, type CatalystDraft } from '@/features/catalysts/api';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { attempt, toast } from '@/store/toastStore';
import { lookupUniverse } from '@/services/market/universe';
import {
  CATALYST_STATUSES,
  CATALYST_TYPES,
  type Catalyst,
  type CatalystBias,
  type CatalystStatus,
  type CatalystType,
  type Impact,
} from '@/types/db';
import { cn } from '@/lib/cn';
import { daysUntil, fmtDate, fmtDateTime, parseNum, timeAgo } from '@/lib/format';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';

type SortKey = 'newest' | 'confidence' | 'move' | 'ticker' | 'date';

interface Draft {
  symbol: string;
  company: string;
  catalyst_type: CatalystType;
  headline: string;
  source_url: string;
  announced_at: string;
  catalyst_date: string;
  expected_impact: Impact;
  bias: CatalystBias;
  notes: string;
  confidence: number;
  expected_move: string;
  status: CatalystStatus;
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};

const blank = (): Draft => ({
  symbol: '',
  company: '',
  catalyst_type: 'Earnings',
  headline: '',
  source_url: '',
  announced_at: toLocalInput(new Date().toISOString()),
  catalyst_date: '',
  expected_impact: 'medium',
  bias: 'uncertain',
  notes: '',
  confidence: 50,
  expected_move: '',
  status: 'upcoming',
});

function CatalystForm({ open, onClose, editing }: { open: boolean; onClose: () => void; editing: Catalyst | null }) {
  const [d, setD] = useState<Draft>(blank());
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setD(
      editing
        ? {
            symbol: editing.symbol,
            company: editing.company ?? '',
            catalyst_type: editing.catalyst_type,
            headline: editing.headline,
            source_url: editing.source_url ?? '',
            announced_at: toLocalInput(editing.announced_at),
            catalyst_date: editing.catalyst_date ?? '',
            expected_impact: editing.expected_impact,
            bias: editing.bias,
            notes: editing.notes ?? '',
            confidence: editing.confidence,
            expected_move: editing.expected_move?.toString() ?? '',
            status: editing.status,
          }
        : blank(),
    );
  }, [open, editing]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((s) => ({ ...s, [k]: v }));

  const save = async () => {
    const symbol = normalizeSymbol(d.symbol);
    if (!isValidSymbol(symbol)) return toast.warning('Choose a ticker');
    if (!d.headline.trim()) return toast.warning('Headline is required');
    if (d.source_url && !/^https?:\/\//i.test(d.source_url)) return toast.warning('Source URL must start with http(s)://');
    const payload: CatalystDraft = {
      symbol,
      company: d.company.trim() || lookupUniverse(symbol)?.name || null,
      catalyst_type: d.catalyst_type,
      headline: d.headline.trim(),
      source_url: d.source_url.trim() || null,
      announced_at: d.announced_at ? new Date(d.announced_at).toISOString() : null,
      catalyst_date: d.catalyst_date || null,
      expected_impact: d.expected_impact,
      bias: d.bias,
      notes: d.notes.trim() || null,
      confidence: d.confidence,
      expected_move: parseNum(d.expected_move),
      status: d.status,
    };
    setSaving(true);
    const ok = await attempt(() => (editing ? updateCatalyst(editing.id, payload) : createCatalyst(payload)), 'Could not save catalyst');
    setSaving(false);
    if (ok) {
      toast.success(editing ? 'Catalyst updated' : 'Catalyst logged');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit catalyst · $${editing.symbol}` : 'Log a catalyst'}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {editing ? 'Save' : 'Log catalyst'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ticker">
          {d.symbol ? (
            <div className="flex h-10 items-center gap-2">
              <TickerChip symbol={normalizeSymbol(d.symbol)} size="md" />
              <button className="text-xs text-slate-500 hover:text-white" onClick={() => set('symbol', '')}>
                change
              </button>
            </div>
          ) : (
            <SymbolSearch
              onSelect={(m) => {
                set('symbol', m.symbol);
                if (!d.company && m.name !== 'Open ticker directly') set('company', m.name);
              }}
            />
          )}
        </Field>
        <Field label="Company">
          <Input value={d.company} onChange={(e) => set('company', e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Catalyst type">
          <Select value={d.catalyst_type} onChange={(v) => set('catalyst_type', v)} options={CATALYST_TYPES} />
        </Field>
        <Field label="Status">
          <Select value={d.status} onChange={(v) => set('status', v)} options={CATALYST_STATUSES.map((s) => ({ value: s, label: CAT_STATUS_META[s].label }))} />
        </Field>
        <Field label="Headline" className="sm:col-span-2">
          <Input value={d.headline} onChange={(e) => set('headline', e.target.value)} placeholder="e.g. Files 8-K announcing $120M DoD contract" />
        </Field>
        <Field label="Source URL" className="sm:col-span-2" hint="Link the filing, PR or article so it can be verified.">
          <Input type="url" value={d.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://www.sec.gov/…" />
        </Field>
        <Field label="Announcement time">
          <Input type="datetime-local" value={d.announced_at} onChange={(e) => set('announced_at', e.target.value)} />
        </Field>
        <Field label="Catalyst date">
          <Input type="date" value={d.catalyst_date} onChange={(e) => set('catalyst_date', e.target.value)} />
        </Field>
        <Field label="Bias">
          <Select value={d.bias} onChange={(v) => set('bias', v)} options={[{ value: 'bullish', label: 'Bullish' }, { value: 'bearish', label: 'Bearish' }, { value: 'uncertain', label: 'Uncertain' }]} />
        </Field>
        <Field label="Expected impact">
          <Select value={d.expected_impact} onChange={(v) => set('expected_impact', v)} options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }]} />
        </Field>
        <Field label={`Confidence · ${d.confidence}%`}>
          <Slider value={d.confidence} onChange={(v) => set('confidence', v)} />
        </Field>
        <Field label="Expected move %">
          <Input inputMode="decimal" value={d.expected_move} onChange={(e) => set('expected_move', e.target.value)} placeholder="e.g. 12" />
        </Field>
        <Field label="Notes" className="sm:col-span-2">
          <Textarea rows={3} value={d.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Context, levels, $TICKER references…" />
        </Field>
      </div>
    </Modal>
  );
}

function CatalystCard({ c, focused, onEdit }: { c: Catalyst; focused: boolean; onEdit: () => void }) {
  const author = useAuth((s) => s.profiles.find((p) => p.id === c.created_by));
  const me = useAuth((s) => s.user?.id);
  const d = daysUntil(c.catalyst_date);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focused]);
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass glow-border flex flex-col p-4', focused && 'ring-2 ring-neon-cyan/60')}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <TickerChip symbol={c.symbol} size="md" />
        <Badge tone="violet">{c.catalyst_type}</Badge>
        <Badge tone={BIAS_META[c.bias].tone}>{BIAS_META[c.bias].label}</Badge>
        <Badge tone={CAT_STATUS_META[c.status].tone} className="ml-auto">
          {CAT_STATUS_META[c.status].label}
        </Badge>
      </div>
      {c.company && <p className="mt-1 text-[11px] text-slate-500">{c.company}</p>}
      <h3 className="mt-2 text-sm font-medium leading-snug text-slate-100">{c.headline}</h3>
      {c.notes && (
        <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-xs text-slate-400">
          <MessageContent text={c.notes} />
        </p>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
        <div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Date</div>
          <div className="text-slate-200">{c.catalyst_date ? fmtDate(c.catalyst_date).replace(/, \d{4}/, '') : '—'}</div>
          {d != null && <div className={cn('text-[10px]', d < 0 ? 'text-slate-500' : d <= 3 ? 'text-rose-300' : 'text-amber-300')}>{d < 0 ? `${-d}d ago` : d === 0 ? 'today' : `in ${d}d`}</div>}
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Confidence</div>
          <div className="text-slate-200">{c.confidence}%</div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{ width: `${c.confidence}%` }} />
          </div>
        </div>
        <div className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-slate-500">Exp. move</div>
          <div className="text-slate-200">{c.expected_move != null ? `±${c.expected_move}%` : '—'}</div>
          <Badge tone={IMPACT_META[c.expected_impact].tone} className="mt-0.5 !px-1 !text-[8px]">
            {IMPACT_META[c.expected_impact].label}
          </Badge>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-white/5 pt-3 text-[11px] text-slate-500" style={{ marginTop: 12 }}>
        <Avatar profile={author} size={18} />
        <span>{author?.display_name}</span>
        <span className="font-mono text-[10px]" title={c.announced_at ? `Announced ${fmtDateTime(c.announced_at)}` : undefined}>
          {c.announced_at ? `ann. ${timeAgo(c.announced_at)}` : timeAgo(c.created_at)}
        </span>
        <div className="ml-auto flex items-center gap-0.5">
          {c.source_url && (
            <a href={c.source_url} target="_blank" rel="noopener noreferrer nofollow" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-neon-cyan" title="Open source">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          <IconButton label="Edit" onClick={onEdit}>
            <Edit3 className="h-3.5 w-3.5" />
          </IconButton>
          {c.created_by === me && (
            <ConfirmButton onConfirm={() => void attempt(() => deleteCatalyst(c.id))}>
              <Trash2 className="h-3.5 w-3.5" />
            </ConfirmButton>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function Catalysts() {
  const { rows, loading, error, reload } = useLiveTable('catalysts', { order: { column: 'created_at', ascending: false } });
  const [params, setParams] = useSearchParams();
  const focus = params.get('focus');
  const [sort, setSort] = useState<SortKey>('newest');
  const [type, setType] = useState<'All' | CatalystType>('All');
  const [bias, setBias] = useState<'all' | CatalystBias>('all');
  const [status, setStatus] = useState<'all' | CatalystStatus>('all');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Catalyst | null>(null);

  const list = useMemo(() => {
    const term = q.trim().toUpperCase();
    const out = rows.filter(
      (c) =>
        (type === 'All' || c.catalyst_type === type) &&
        (bias === 'all' || c.bias === bias) &&
        (status === 'all' || c.status === status) &&
        (!term || c.symbol.includes(term) || c.headline.toUpperCase().includes(term) || (c.company ?? '').toUpperCase().includes(term)),
    );
    const s: Record<SortKey, (a: Catalyst, b: Catalyst) => number> = {
      newest: (a, b) => (b.announced_at ?? b.created_at).localeCompare(a.announced_at ?? a.created_at),
      confidence: (a, b) => b.confidence - a.confidence,
      move: (a, b) => (b.expected_move ?? -1) - (a.expected_move ?? -1),
      ticker: (a, b) => a.symbol.localeCompare(b.symbol),
      date: (a, b) => (a.catalyst_date ?? '9999').localeCompare(b.catalyst_date ?? '9999'),
    };
    return [...out].sort(s[sort]);
  }, [rows, q, type, bias, status, sort]);

  const upcoming7 = rows.filter((c) => {
    const d = daysUntil(c.catalyst_date);
    return d != null && d >= 0 && d <= 7 && c.status !== 'invalidated';
  }).length;

  return (
    <div>
      <PageHeader
        title="Catalyst Feed"
        subtitle="Manually curated, sourced catalysts. Nothing here is auto-generated."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Log catalyst
          </Button>
        }
      />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="grid grid-cols-3 gap-3">
          {[
            { l: 'Total logged', v: rows.length, icon: Zap },
            { l: 'Next 7 days', v: upcoming7, icon: CalendarDays },
            { l: 'High impact open', v: rows.filter((c) => c.expected_impact === 'high' && (c.status === 'upcoming' || c.status === 'active')).length, icon: Target },
          ].map((s) => (
            <div key={s.l} className="glass flex items-center gap-3 p-3">
              <s.icon className="h-5 w-5 text-neon-cyan" />
              <div>
                <div className="num text-xl font-semibold text-white">{s.v}</div>
                <div className="label">{s.l}</div>
              </div>
            </div>
          ))}
        </div>

        <GlassCard bodyClassName="p-3">
          <div className="grid gap-2 md:grid-cols-[1.3fr_repeat(4,1fr)]">
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticker or headline…" />
            </div>
            <Select value={type} onChange={setType} options={['All', ...CATALYST_TYPES] as const} />
            <Select value={bias} onChange={setBias} options={[{ value: 'all', label: 'Any bias' }, { value: 'bullish', label: 'Bullish' }, { value: 'bearish', label: 'Bearish' }, { value: 'uncertain', label: 'Uncertain' }]} />
            <Select value={status} onChange={setStatus} options={[{ value: 'all', label: 'Any status' }, ...CATALYST_STATUSES.map((s) => ({ value: s, label: CAT_STATUS_META[s].label }))]} />
            <Select
              value={sort}
              onChange={setSort}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'confidence', label: 'Highest confidence' },
                { value: 'move', label: 'Largest expected move' },
                { value: 'ticker', label: 'Ticker' },
                { value: 'date', label: 'Catalyst date' },
              ]}
            />
          </div>
        </GlassCard>

        {loading ? (
          <SkeletonRows rows={6} />
        ) : error ? (
          <GlassCard>
            <p className="text-sm text-amber-400">{error}</p>
            <Button size="sm" className="mt-2" onClick={() => void reload()}>
              Retry
            </Button>
          </GlassCard>
        ) : list.length === 0 ? (
          <GlassCard>
            <EmptyState icon={<Zap />} title={rows.length ? 'No catalysts match these filters' : 'No catalysts logged yet'} body="Log earnings dates, 8-Ks, FDA decisions, contracts and more — with a source link." />
          </GlassCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((c) => (
              <CatalystCard
                key={c.id}
                c={c}
                focused={focus === c.id}
                onEdit={() => {
                  setEditing(c);
                  setFormOpen(true);
                  if (focus) setParams({});
                }}
              />
            ))}
          </div>
        )}
      </div>
      <CatalystForm open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />
    </div>
  );
}
