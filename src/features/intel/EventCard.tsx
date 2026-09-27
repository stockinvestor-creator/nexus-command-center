import { memo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, BookmarkCheck, ExternalLink, FileText, Newspaper, NotebookPen, Plus, Scale, Search, Share2, ShieldAlert, Star } from 'lucide-react';
import type { IntelEvent } from '@/types/intel';
import { CATEGORY_LABEL } from '@/types/intel';
import type { EventAnnotation, UserPriority } from '@/types/db';
import { Badge, type Tone } from '@/components/ui/Badge';
import { TickerChip } from '@/components/ui/TickerChip';
import { UserEstimateTag } from '@/components/ui/DataSource';
import { cn } from '@/lib/cn';
import { attempt, toast } from '@/store/toastStore';
import { useWhy } from '@/store/whyStore';
import { addToWatchlist, useMyWatchlist } from '@/features/watchlist/api';
import { ShareCardModal } from '@/features/chat/ShareCardModal';
import { annotate } from './annotations';
import { eventTimeLabel } from './time';

const CAT_TONE: Partial<Record<string, Tone>> = {
  MANAGEMENT: 'amber',
  FINANCING: 'pink',
  OFFERING: 'pink',
  M_AND_A: 'violet',
  LEGAL_REGULATORY: 'red',
  CYBER: 'red',
  RESTRUCTURING: 'red',
  EARNINGS: 'green',
  PERIODIC_REPORT: 'blue',
  SHAREHOLDER: 'cyan',
  OWNERSHIP: 'cyan',
  FDA: 'green',
  POLICY: 'blue',
  MACRO: 'blue',
  MATERIAL_AGREEMENT: 'violet',
  OPERATIONAL: 'amber',
};
const PRIORITY_TONE: Record<UserPriority, Tone> = { low: 'neutral', medium: 'blue', high: 'amber', critical: 'red' };

const KindIcon = ({ kind }: { kind: IntelEvent['kind'] }) =>
  kind === 'filing' ? <FileText className="h-3.5 w-3.5" /> : kind === 'news' ? <Newspaper className="h-3.5 w-3.5" /> : kind === 'regulatory' ? <ShieldAlert className="h-3.5 w-3.5" /> : <Scale className="h-3.5 w-3.5" />;

/**
 * Catalyst card. Top half = FACTUAL SOURCE DATA (verbatim from the source + how NEXUS classified it).
 * Bottom half = USER ANALYSIS (priority, note, bookmark) — clearly labelled and stored separately.
 */
function EventCardInner({ event: e, annotation, compact, className }: { event: IntelEvent; annotation?: EventAnnotation; compact?: boolean; className?: string }) {
  const { items, active } = useMyWatchlist();
  const openWhy = useWhy((s) => s.open);
  const [share, setShare] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(annotation?.note ?? '');
  const watched = new Set(items.rows.map((i) => i.symbol));
  const time = eventTimeLabel(e);
  const primary = e.tickers[0];

  return (
    <article className={cn('glass glow-border flex flex-col gap-2 p-3.5', className)} data-event-id={e.id}>
      {/* FACTUAL SOURCE DATA */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-[1px] font-mono text-[9px] font-semibold uppercase tracking-wider text-slate-300" title="Source">
          <KindIcon kind={e.kind} /> {e.source}
        </span>
        {e.form && <Badge tone="neutral">{e.form}</Badge>}
        {e.tickers.slice(0, 4).map((t) => (
          <span key={t} className="inline-flex items-center gap-0.5">
            <TickerChip symbol={t} />
            {watched.has(t) && <Star className="h-3 w-3 fill-amber-300 text-amber-300" aria-label="On your watchlist" />}
          </span>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-slate-400" title={time.full}>
          {time.short}
        </span>
      </div>
      <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="group/t">
        <h3 className="text-sm font-medium leading-snug text-slate-100 group-hover/t:text-neon-cyan">{e.title}</h3>
      </a>
      {!compact && e.company && e.kind !== 'filing' && <p className="text-[11px] text-slate-500">{e.company}</p>}
      {!compact && e.summary && <p className="line-clamp-3 text-xs text-slate-400">{e.summary}</p>}
      <div className="flex flex-wrap gap-1">
        {e.classifications.slice(0, compact ? 2 : 4).map((c, i) => (
          <span key={i} title={`NEXUS classification · basis: ${c.basis}`} className="inline-flex max-w-full items-center gap-1">
            <Badge tone={CAT_TONE[c.category] ?? 'neutral'}>{CATEGORY_LABEL[c.category]}</Badge>
            {!compact && <span className="truncate text-[10px] text-slate-500">{c.basis}</span>}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-slate-500">
        <span className="truncate">Source: {e.publisher ?? e.source}</span>
        <a href={e.url} target="_blank" rel="noopener noreferrer nofollow" className="ml-auto inline-flex shrink-0 items-center gap-1 text-neon-cyan hover:underline">
          Open source <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* USER ANALYSIS */}
      {!compact && (annotation?.priority || annotation?.note || noteOpen) && (
        <div className="rounded-lg border border-violet-400/20 bg-violet-400/[0.04] p-2">
          <div className="mb-1 flex items-center gap-2">
            <UserEstimateTag label="User analysis" />
            {annotation?.priority && <Badge tone={PRIORITY_TONE[annotation.priority]}>{annotation.priority}</Badge>}
          </div>
          {noteOpen ? (
            <div className="flex gap-2">
              <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={2} className="input min-h-[44px] text-xs" placeholder="Your note (shared with your partner)" />
              <button
                className="self-end rounded-lg bg-neon-cyan/15 px-2 py-1 text-xs text-neon-cyan"
                onClick={async () => {
                  const ok = await attempt(() => annotate(e, { note: note.trim() || null }));
                  if (ok) setNoteOpen(false);
                }}
              >
                Save
              </button>
            </div>
          ) : (
            annotation?.note && <p className="whitespace-pre-wrap text-xs text-slate-300">{annotation.note}</p>
          )}
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap items-center gap-0.5 border-t border-white/5 pt-2">
          <select
            value={annotation?.priority ?? ''}
            onChange={(ev) => void attempt(() => annotate(e, { priority: (ev.target.value || null) as UserPriority | null }))}
            className="h-7 rounded-lg border border-white/10 bg-void-900 px-1.5 text-[11px] text-slate-300"
            aria-label="Your priority"
            title="Your priority (user classification)"
          >
            <option value="">Priority…</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <Act onClick={() => void attempt(() => annotate(e, { bookmarked: !annotation?.bookmarked }))} icon={annotation?.bookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-300" /> : <Bookmark className="h-3.5 w-3.5" />}>
            {annotation?.bookmarked ? 'Saved' : 'Save'}
          </Act>
          <Act onClick={() => setNoteOpen((v) => !v)} icon={<NotebookPen className="h-3.5 w-3.5" />}>
            Note
          </Act>
          <Act onClick={() => setShare(true)} icon={<Share2 className="h-3.5 w-3.5" />}>
            Share
          </Act>
          {primary && (
            <>
              <Act onClick={() => openWhy(primary)} icon={<Search className="h-3.5 w-3.5" />}>
                Why moving?
              </Act>
              <Link to={`/stock/${primary}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 hover:text-neon-cyan">
                Stock
              </Link>
              <Link
                to={`/predictions?${new URLSearchParams({ new: '1', symbol: primary, catalyst: e.title.slice(0, 120), link_type: e.kind === 'filing' ? 'filing' : e.kind === 'news' ? 'news' : 'event', link_url: e.url, link_ref: e.id, link_label: `${e.form ?? e.source}: ${e.title.slice(0, 60)}` })}`}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-300 hover:bg-white/5 hover:text-neon-cyan"
              >
                Predict
              </Link>
              {!watched.has(primary) && active && (
                <Act
                  onClick={async () => {
                    const ok = await attempt(() => addToWatchlist(active.id, primary));
                    if (ok) toast.success(`Added $${primary} to ${active.name}`);
                  }}
                  icon={<Plus className="h-3.5 w-3.5" />}
                >
                  Watch
                </Act>
              )}
            </>
          )}
        </div>
      )}
      {share && <ShareCardModal open={share} onClose={() => setShare(false)} card={{ type: 'event', event: e }} />}
    </article>
  );
}

function Act({ onClick, icon, children }: { onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-300 transition hover:bg-white/5 hover:text-neon-cyan">
      {icon}
      {children}
    </button>
  );
}

export const EventCard = memo(EventCardInner);
