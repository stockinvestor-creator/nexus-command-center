import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BookMarked, FileText, GitCompare, History, NotebookPen, Target } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/States';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { SymbolSearch } from '@/features/market/SymbolSearch';
import { ResearchSourceBar } from '@/features/research/ResearchSourceBar';
import { SECTION_META, saveSection } from '@/features/research/api';
import { EventList } from '@/features/intel/EventList';
import { WhyButton } from '@/features/why/WhyButton';
import { useLiveTable } from '@/hooks/useLiveTable';
import { intelKeys, intelView, useSecFilings } from '@/hooks/useIntel';
import { resolveSymbol } from '@/services/market/symbols';
import { useAuth } from '@/store/authStore';
import { attempt } from '@/store/toastStore';
import { fmtDateTime, timeAgo } from '@/lib/format';
import { isValidSymbol, normalizeSymbol } from '@/lib/tickers';
import { RESEARCH_SECTIONS, type ResearchNote, type ResearchSection } from '@/types/db';

/** Shared thesis / research page per ticker. Both operators edit; every change keeps history. */
export default function Research() {
  const { symbol: raw = '' } = useParams();
  const navigate = useNavigate();
  const symbol = normalizeSymbol(raw);
  const valid = isValidSymbol(symbol);
  const notes = useLiveTable(valid ? 'research_notes' : null, { eq: { symbol } });
  const bySection = useMemo(() => new Map(notes.rows.map((n) => [n.section, n])), [notes.rows]);
  const r = resolveSymbol(symbol);
  const preds = useLiveTable(valid ? 'predictions' : null, { eq: { symbol }, order: { column: 'created_at', ascending: false } });
  const filings = useSecFilings(valid ? [symbol] : []);
  const fv = intelView(filings, intelKeys.sec(valid ? [symbol] : []));

  if (!valid) {
    return (
      <div>
        <PageHeader title="Research" subtitle="Shared thesis pages — pick a ticker." />
        <div className="px-3 sm:px-5">
          <SymbolSearch className="max-w-md" placeholder="Open research for…" onSelect={(s) => navigate(`/research/${s.ticker}`)} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Research · ${symbol}`}
        subtitle={r?.name ? `${r.name} — shared thesis page (both operators can edit; history kept)` : 'Shared thesis page (both operators can edit; history kept)'}
        actions={
          <>
            <SymbolSearch className="w-44 sm:w-56" placeholder="Switch ticker…" onSelect={(s) => navigate(`/research/${s.ticker}`)} />
            <WhyButton symbol={symbol} />
            <Link to={`/compare?symbols=${symbol}`}><Button size="sm" variant="ghost" icon={<GitCompare className="h-3.5 w-3.5" />}>Compare</Button></Link>
            <Link to={`/stock/${symbol}`}><Button size="sm" variant="outline">Stock page</Button></Link>
          </>
        }
      />
      <div className="grid gap-3 px-3 sm:px-5 lg:grid-cols-12">
        <div className="lg:col-span-12"><ResearchSourceBar symbol={symbol} /></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-8">
          {RESEARCH_SECTIONS.map((s) => <Section key={s} symbol={symbol} section={s} note={bySection.get(s)} />)}
        </div>
        <div className="space-y-3 lg:col-span-4">
          <GlassCard title="Chart" icon={<BookMarked />} bodyClassName="p-0">
            <div className="h-[220px]"><TradingViewWidget script="mini-symbol-overview" config={tv.miniSymbol(r?.tvSymbol ?? symbol)} /></div>
          </GlassCard>
          <GlassCard title="Predictions on this ticker" icon={<Target />} actions={<Link to={`/predictions?new=1&symbol=${symbol}`} className="text-[11px] text-neon-cyan hover:underline">New</Link>}>
            {preds.rows.length === 0 ? (
              <p className="text-xs text-slate-500">No predictions yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {preds.rows.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    <Link to={`/predictions?id=${p.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs hover:bg-white/[0.03]">
                      <Badge tone={p.status === 'open' ? 'cyan' : p.status === 'correct' ? 'green' : p.status === 'incorrect' ? 'red' : 'neutral'}>{p.status}</Badge>
                      <span className="min-w-0 flex-1 truncate text-slate-300">{p.title}</span>
                      <span className="font-mono text-[10px] text-slate-500">{p.confidence}%</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
        <GlassCard className="lg:col-span-12" title="SEC filings" icon={<FileText />}>
          <EventList {...fv} columns={3} limit={12} emptyTitle="No recent material filings" />
        </GlassCard>
      </div>
    </div>
  );
}

function Section({ symbol, section, note }: { symbol: string; section: ResearchSection; note?: ResearchNote }) {
  const meta = SECTION_META[section];
  const [text, setText] = useState(note?.content ?? '');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hist, setHist] = useState(false);
  const profiles = useAuth((s) => s.profiles);
  // follow realtime updates when not editing
  useEffect(() => {
    if (!editing) setText(note?.content ?? '');
  }, [note?.content, editing]);
  const who = profiles.find((p) => p.id === note?.updated_by)?.display_name;
  const save = async () => {
    setBusy(true);
    const ok = await attempt(() => saveSection(symbol, section, text), 'Could not save');
    setBusy(false);
    if (ok) setEditing(false);
  };
  return (
    <GlassCard
      title={meta.label}
      icon={<NotebookPen />}
      className={section === 'general' || section === 'links' ? 'sm:col-span-2' : ''}
      actions={
        note ? (
          <button onClick={() => setHist(true)} className="rounded p-1 text-slate-500 hover:text-neon-cyan" title="Edit history">
            <History className="h-3.5 w-3.5" />
          </button>
        ) : null
      }
    >
      {editing ? (
        <div className="space-y-2">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={meta.hint} className="min-h-[120px]" autoFocus />
          <div className="flex justify-end gap-2">
            <Button size="xs" variant="ghost" onClick={() => { setText(note?.content ?? ''); setEditing(false); }}>Cancel</Button>
            <Button size="xs" variant="primary" loading={busy} onClick={save}>Save</Button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEditing(true)} className="block w-full text-left">
          {note?.content ? <p className="whitespace-pre-wrap break-words text-sm text-slate-300">{note.content}</p> : <p className="text-xs italic text-slate-600">{meta.hint || 'Click to add notes'}</p>}
        </button>
      )}
      {note && (
        <p className="mt-2 font-mono text-[10px] text-slate-600" title={fmtDateTime(note.updated_at)}>
          Last edited by {who ?? 'unknown'} · {timeAgo(note.updated_at)}
        </p>
      )}
      {hist && note && <HistoryModal note={note} onClose={() => setHist(false)} />}
    </GlassCard>
  );
}

function HistoryModal({ note, onClose }: { note: ResearchNote; onClose: () => void }) {
  const h = useLiveTable('research_note_history', { eq: { note_id: note.id }, order: { column: 'edited_at', ascending: false } });
  const profiles = useAuth((s) => s.profiles);
  return (
    <Modal open onClose={onClose} title={`${SECTION_META[note.section].label} · history`} size="lg">
      {h.rows.length === 0 ? (
        <EmptyState icon={<History />} title="No previous versions" />
      ) : (
        <ol className="space-y-3">
          {h.rows.map((v) => (
            <li key={v.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="mb-1 font-mono text-[10px] text-slate-500">
                Version from {fmtDateTime(v.edited_at)} by {profiles.find((p) => p.id === v.edited_by)?.display_name ?? 'unknown'}
              </p>
              <p className="whitespace-pre-wrap break-words text-xs text-slate-300">{v.content || <em className="text-slate-600">(empty)</em>}</p>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
