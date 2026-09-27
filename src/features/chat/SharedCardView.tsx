import { Link } from 'react-router-dom';
import { ExternalLink, FileText, HelpCircle, Newspaper, Sparkles, Target, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { SharedCard } from '@/types/db';
import { Badge } from '@/components/ui/Badge';
import { TickerChip } from '@/components/ui/TickerChip';
import { eventTimeLabel } from '@/features/intel/time';
import { WhyButton } from '@/features/why/WhyButton';
import { TIER_TONE } from '@/features/why/WhyPanel';
import type { Verdict } from '@/features/why/evidence';
import { DIRECTION_LABEL, STATUS_META } from '@/features/predictions/api';
import { useLiveTable } from '@/hooks/useLiveTable';
import { fmtDate, fmtDateTime } from '@/lib/format';
import type { PredictionDirection, PredictionStatus } from '@/types/db';

function Shell({ icon, label, children, footer }: { icon: ReactNode; label: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="glass mt-1.5 w-full max-w-[560px] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/[0.05] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
        <span className="text-neon-cyan [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        {label}
      </div>
      <div className="px-3 py-2">{children}</div>
      {footer && <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.05] px-3 py-1.5">{footer}</div>}
    </div>
  );
}

function PredictionCardLive({ card }: { card: Extract<SharedCard, { type: 'prediction' }> }) {
  const live = useLiveTable('predictions', { eq: { id: card.predictionId } });
  const p = live.rows[0];
  const status = (p?.status ?? card.snapshot.status) as PredictionStatus;
  const s = card.snapshot;
  return (
    <Shell icon={<Target />} label={<>User prediction <span className="text-slate-600">· not a probability model</span></>} footer={<Link to={`/predictions?id=${card.predictionId}`} className="text-[11px] text-neon-cyan hover:underline">Open prediction →</Link>}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={STATUS_META[status]?.tone ?? 'neutral'}>{STATUS_META[status]?.label ?? status}</Badge>
        {s.symbol && <TickerChip symbol={s.symbol} />}
        <Badge tone={s.direction === 'bullish' ? 'green' : s.direction === 'bearish' ? 'red' : 'neutral'}>{DIRECTION_LABEL[s.direction as PredictionDirection] ?? s.direction}</Badge>
        <span className="ml-auto font-mono text-[10px] text-violet-300">{s.confidence}% user confidence</span>
      </div>
      <p className="mt-1.5 text-sm text-slate-200">{p?.title ?? s.title}</p>
      <p className="mt-0.5 font-mono text-[10px] text-slate-500">
        {s.resolution_date ? `Resolves ${fmtDate(s.resolution_date)}` : 'No resolution date'}
        {p && p.status !== 'open' && p.actual_outcome ? ` · Outcome: ${p.actual_outcome.slice(0, 120)}` : ''}
      </p>
    </Shell>
  );
}

/** Renders a structured card attached to a chat message (metadata.card). */
export function SharedCardView({ card }: { card: SharedCard }) {
  if (card.type === 'event') {
    const e = card.event;
    const t = eventTimeLabel(e);
    const Icon = e.kind === 'filing' ? FileText : e.kind === 'news' ? Newspaper : Zap;
    return (
      <Shell
        icon={<Icon />}
        label={<>SOURCE: {e.publisher ?? e.source} <span className="ml-auto normal-case tracking-normal text-slate-500" title={t.full}>{t.short}</span></>}
        footer={
          <>
            {e.tickers.slice(0, 3).map((x) => <TickerChip key={x} symbol={x} />)}
            {e.tickers[0] && <WhyButton symbol={e.tickers[0]} compact />}
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[11px] text-neon-cyan hover:underline">Open source <ExternalLink className="h-3 w-3" /></a>
          </>
        }
      >
        <div className="flex flex-wrap gap-1">
          {e.form && <Badge tone="blue">{e.form}</Badge>}
          {e.classifications.filter((c) => c.category !== 'NEWS').slice(0, 3).map((c) => (
            <Badge key={c.label} tone="amber" title={`NEXUS classification — ${c.basis}`}>{c.label}</Badge>
          ))}
        </div>
        <p className="mt-1 text-sm text-slate-200">{e.title}</p>
        {e.summary && <p className="mt-0.5 line-clamp-3 text-xs text-slate-400">{e.summary}</p>}
      </Shell>
    );
  }
  if (card.type === 'prediction') return <PredictionCardLive card={card} />;
  if (card.type === 'why') {
    return (
      <Shell
        icon={<HelpCircle />}
        label={<>Why is ${card.symbol} moving? · window {card.window}</>}
        footer={
          <>
            <WhyButton symbol={card.symbol} compact />
            <Link to={`/why?symbol=${card.symbol}&window=${card.window}`} className="ml-auto text-[11px] text-neon-cyan hover:underline">Re-check live →</Link>
          </>
        }
      >
        <div className="flex items-center gap-2">
          <Badge tone={TIER_TONE[card.verdict as Verdict] ?? 'neutral'}>{card.verdict}</Badge>
          <span className="text-[10px] text-slate-500">Evidence found — not a claim of causation</span>
        </div>
        {card.evidence.length ? (
          <ul className="mt-2 space-y-1.5">
            {card.evidence.map((e, i) => (
              <li key={i} className="text-xs">
                <Badge tone={TIER_TONE[e.label as Verdict] ?? 'neutral'} className="mr-1">{e.label}</Badge>
                {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-neon-cyan">{e.title}</a> : <span className="text-slate-200">{e.title}</span>}
                <span className="block font-mono text-[10px] text-slate-500">SOURCE: {e.source}{e.at ? ` · ${fmtDateTime(e.at)}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">No sourced items in this window.</p>
        )}
      </Shell>
    );
  }
  if (card.type === 'manual_catalyst') {
    return (
      <Shell icon={<Zap />} label="Manual catalyst · team entry" footer={<Link to={`/catalysts?tab=manual&focus=${card.catalystId}`} className="text-[11px] text-neon-cyan hover:underline">Open catalyst →</Link>}>
        <div className="flex items-center gap-1.5">
          <TickerChip symbol={card.symbol} />
          <Badge tone="violet">{card.catalyst_type}</Badge>
          {card.catalyst_date && <span className="ml-auto font-mono text-[10px] text-slate-500">{fmtDate(card.catalyst_date)}</span>}
        </div>
        <p className="mt-1 text-sm text-slate-200">{card.headline}</p>
      </Shell>
    );
  }
  if (card.type === 'briefing') {
    return (
      <Shell icon={<Sparkles />} label={<>{card.kind === 'eod' ? 'End-of-day brief' : 'Morning briefing'} · {fmtDate(card.date)}</>} footer={<Link to={`/briefing?date=${card.date}`} className="text-[11px] text-neon-cyan hover:underline">Open briefing →</Link>}>
        <ul className="space-y-1.5">
          {card.items.map((it, i) => (
            <li key={i} className="text-xs">
              <Badge tone="amber" className="mr-1">{it.label}</Badge>
              {it.url ? <a href={it.url} target="_blank" rel="noopener noreferrer" className="text-slate-200 hover:text-neon-cyan">{it.title}</a> : <span className="text-slate-200">{it.title}</span>}
              <span className="block text-[10px] text-slate-500">{it.source}</span>
            </li>
          ))}
        </ul>
        <p className="mt-1 font-mono text-[9px] text-slate-600">Generated {fmtDateTime(card.generatedAt)}</p>
      </Shell>
    );
  }
  return null;
}
