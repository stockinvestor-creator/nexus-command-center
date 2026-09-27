import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, History, Link2, Lock, Pencil, Share2, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { ShareCardModal } from '@/features/chat/ShareCardModal';
import { WhyButton } from '@/features/why/WhyButton';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { attempt } from '@/store/toastStore';
import { fmtDate, fmtDateTime, fmtPct, fmtPrice } from '@/lib/format';
import type { Prediction, PredictionLinkType } from '@/types/db';
import { addLink, DIRECTION_LABEL, deletePrediction, editPrediction, LINK_LABEL, removeLink, STATUS_META, TYPE_LABEL } from './api';
import { PredictionForm } from './PredictionForm';
import { ResolveModal } from './ResolveModal';
import { dueLabel } from './PredictionCard';

const KV = ({ k, v }: { k: string; v: React.ReactNode }) =>
  v == null || v === '' ? null : (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
      <dd className="whitespace-pre-wrap break-words text-sm text-slate-200">{v}</dd>
    </div>
  );

function linkHref(type: PredictionLinkType, ref: string, url: string | null) {
  if (url) return url;
  if (type === 'trade_idea') return `/war-room?trade=${ref}`;
  if (type === 'position') return `/portfolio?tab=journal`;
  if (type === 'catalyst') return `/catalysts?tab=manual&focus=${ref}`;
  if (type === 'research') return `/research/${ref}`;
  return null;
}

export function PredictionDetail({ p, onClose }: { p: Prediction; onClose: () => void }) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const mine = p.created_by === me;
  const history = useLiveTable('prediction_history', { eq: { prediction_id: p.id }, order: { column: 'changed_at', ascending: false } });
  const links = useLiveTable('prediction_links', { eq: { prediction_id: p.id } });
  const [editing, setEditing] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [notes, setNotes] = useState(p.result_notes ?? '');
  const [lesson, setLesson] = useState(p.lesson ?? '');
  const [linkType, setLinkType] = useState<PredictionLinkType>('news');
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const who = (id: string | null) => profiles.find((x) => x.id === id)?.display_name ?? 'unknown';
  const due = dueLabel(p);
  const canDelete = mine && p.status === 'open' && Date.now() - Date.parse(p.created_at) < 3600_000;

  return (
    <Modal open onClose={onClose} drawer title={<span className="flex items-center gap-2">Prediction {p.status !== 'open' && <Lock className="h-3.5 w-3.5 text-slate-500" />}</span>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_META[p.status].tone}>{STATUS_META[p.status].label}</Badge>
          <Badge tone="violet">User prediction</Badge>
          <Badge tone="neutral">{TYPE_LABEL[p.prediction_type]}</Badge>
          <Badge tone={p.direction === 'bullish' ? 'green' : p.direction === 'bearish' ? 'red' : 'neutral'}>{DIRECTION_LABEL[p.direction]}</Badge>
          {p.symbol && <Link to={`/stock/${p.symbol}`} className="font-mono text-sm font-semibold text-cyan-300">${p.symbol}</Link>}
          {p.symbol && <WhyButton symbol={p.symbol} compact />}
        </div>
        <h2 className="text-lg font-semibold text-white">{p.title}</h2>
        {due && <p className={`text-xs ${due.tone}`}>{due.text}</p>}
        <dl className="grid grid-cols-2 gap-3">
          <KV k="Author" v={who(p.created_by)} />
          <KV k="Confidence (user input)" v={`${p.confidence}%`} />
          <KV k="Prediction date" v={fmtDate(p.prediction_date)} />
          <KV k="Resolution date" v={p.resolution_date ? fmtDate(p.resolution_date) : 'Not set'} />
          <KV k="Expected move" v={p.expected_move != null ? fmtPct(p.expected_move) : null} />
          <KV k="Target" v={p.target_price != null ? fmtPrice(p.target_price) : null} />
          <KV k="Downside" v={p.downside_price != null ? fmtPrice(p.downside_price) : null} />
          <KV k="Horizon" v={p.time_horizon} />
          <KV k="Catalyst" v={p.catalyst} />
          <KV k="Baseline price" v={p.baseline_price != null ? `${fmtPrice(p.baseline_price)} · ${p.baseline_source ?? ''}${p.baseline_at ? ` · ${fmtDateTime(p.baseline_at)}` : ''}` : 'None recorded (no verified quote at creation)'} />
        </dl>
        <KV k="Thesis" v={p.thesis} />
        <KV k="Invalidation" v={p.invalidation} />
        <KV k="Notes" v={p.notes} />

        {p.status !== 'open' && (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-slate-500">Resolution · {p.resolved_at ? fmtDate(p.resolved_at) : ''} by {who(p.resolved_by)}</p>
            <dl className="grid grid-cols-2 gap-3">
              <KV k="Actual outcome" v={p.actual_outcome} />
              <KV k="Actual move" v={p.actual_move != null ? fmtPct(p.actual_move) : null} />
              <KV k="Actual price" v={p.actual_price != null ? `${fmtPrice(p.actual_price)}${p.actual_price_source ? ` · ${p.actual_price_source}` : ''}` : null} />
            </dl>
            {mine ? (
              <div className="mt-3 space-y-2">
                <Field label="Resolution notes"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[50px]" /></Field>
                <Field label="Lesson learned"><Textarea value={lesson} onChange={(e) => setLesson(e.target.value)} className="min-h-[50px]" /></Field>
                {(notes !== (p.result_notes ?? '') || lesson !== (p.lesson ?? '')) && (
                  <Button size="xs" variant="primary" onClick={() => void attempt(() => editPrediction(p.id, { result_notes: notes || null, lesson: lesson || null }))}>Save notes</Button>
                )}
              </div>
            ) : (
              <dl className="mt-2 space-y-2"><KV k="Resolution notes" v={p.result_notes} /><KV k="Lesson" v={p.lesson} /></dl>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {mine && p.status === 'open' && (
            <>
              <Button size="sm" variant="primary" onClick={() => setResolving(true)}>Resolve</Button>
              <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Edit</Button>
            </>
          )}
          <Button size="sm" variant="ghost" icon={<Share2 className="h-3.5 w-3.5" />} onClick={() => setSharing(true)}>Share to chat</Button>
          {canDelete && (
            <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { if (await attempt(() => deletePrediction(p.id))) onClose(); }}>
              Delete (typo window)
            </Button>
          )}
        </div>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500"><Link2 className="h-3 w-3" /> Links</h3>
          <ul className="space-y-1">
            {links.rows.map((l) => {
              const href = linkHref(l.link_type, l.ref_id, l.url);
              const ext = href?.startsWith('http');
              return (
                <li key={l.id} className="flex items-center gap-2 text-xs">
                  <Badge tone="neutral">{LINK_LABEL[l.link_type]}</Badge>
                  {href ? ext ? <a href={href} target="_blank" rel="noopener noreferrer" className="truncate text-slate-300 hover:text-neon-cyan">{l.label || href} <ExternalLink className="inline h-3 w-3" /></a> : <Link to={href} className="truncate text-slate-300 hover:text-neon-cyan">{l.label || l.ref_id}</Link> : <span className="text-slate-300">{l.label || l.ref_id}</span>}
                  {l.created_by === me && <button onClick={() => void attempt(() => removeLink(l.id))} className="ml-auto text-slate-600 hover:text-rose-300" aria-label="Remove link"><X className="h-3 w-3" /></button>}
                </li>
              );
            })}
            {!links.rows.length && <li className="text-xs text-slate-600">No links.</li>}
          </ul>
          <div className="mt-2 flex flex-wrap items-end gap-2">
            <Select className="w-36" value={linkType} onChange={setLinkType} options={(['news', 'filing', 'event', 'catalyst', 'research'] as PredictionLinkType[]).map((t) => ({ value: t, label: LINK_LABEL[t] }))} />
            <Input className="min-w-0 flex-1" placeholder={linkType === 'research' ? 'Ticker' : 'https://… (source URL)'} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
            <Input className="w-32" placeholder="Label" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} />
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const v = linkUrl.trim();
                if (!v) return;
                const isUrl = /^https?:\/\//i.test(v);
                if (linkType !== 'research' && !isUrl) return;
                const ok = await attempt(() => addLink(p.id, { link_type: linkType, ref_id: linkType === 'research' ? v.toUpperCase() : v.slice(0, 500), url: isUrl ? v : null, label: linkLabel || null }));
                if (ok) { setLinkUrl(''); setLinkLabel(''); }
              }}
            >
              Add
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500"><History className="h-3 w-3" /> Edit history (append-only)</h3>
          <ol className="space-y-1.5">
            {history.rows.map((h) => (
              <li key={h.id} className="rounded-lg border border-white/[0.05] p-2 text-[11px]">
                <p className="font-mono text-slate-400">{fmtDateTime(h.changed_at)} · {h.change_type.toUpperCase()} · {who(h.changed_by)}</p>
                {h.change_type !== 'create' && h.new_values && (
                  <ul className="mt-1 space-y-0.5 text-slate-500">
                    {Object.keys(h.new_values).map((k) => (
                      <li key={k}><span className="text-slate-400">{k}</span>: <s>{String(h.old_values?.[k] ?? '∅').slice(0, 80)}</s> → <span className="text-slate-300">{String(h.new_values?.[k] ?? '∅').slice(0, 80)}</span></li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {editing && <PredictionForm open onClose={() => setEditing(false)} editing={p} />}
      {resolving && <ResolveModal p={p} onClose={() => setResolving(false)} />}
      <ShareCardModal
        open={sharing}
        onClose={() => setSharing(false)}
        defaultSlug="stocks"
        card={{ type: 'prediction', predictionId: p.id, snapshot: { symbol: p.symbol, title: p.title, direction: p.direction, confidence: p.confidence, resolution_date: p.resolution_date, status: p.status } }}
      />
    </Modal>
  );
}
