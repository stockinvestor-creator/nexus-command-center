import { useState } from 'react';
import { Activity, Edit3, MessageSquare, Send, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { TickerChip } from '@/components/ui/TickerChip';
import { Textarea } from '@/components/ui/Field';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { TradingViewWidget, tv } from '@/components/widgets/TradingViewWidget';
import { tvSymbolFor } from '@/services/market/symbols';
import { DataSourceBadge, TradingViewBadge } from '@/components/ui/DataSource';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useQuote } from '@/hooks/useMarket';
import { useAuth } from '@/store/authStore';
import { TRADE_STATUSES, type TradeIdea, type TradeReaction } from '@/types/db';
import { cn } from '@/lib/cn';
import { fmtDate, fmtDateTime, fmtPct, fmtPrice, timeAgo, trendClass } from '@/lib/format';
import { attempt, toast } from '@/store/toastStore';
import { MessageContent } from '@/features/chat/MessageContent';
import { addTradeComment, deleteTrade, deleteTradeComment, STATUS_META, tradePnl, updateTrade } from './api';
import { ReactionBar } from './ReactionBar';

export function TradeDetail({ trade, reactions, onClose, onEdit }: { trade: TradeIdea | null; reactions: TradeReaction[]; onClose: () => void; onEdit: (t: TradeIdea) => void }) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const comments = useLiveTable(trade ? 'trade_comments' : null, { eq: { trade_id: trade?.id ?? '' }, order: { column: 'created_at' } });
  const events = useLiveTable(trade ? 'trade_events' : null, { eq: { trade_id: trade?.id ?? '' }, order: { column: 'created_at', ascending: false } });
  const { data: q } = useQuote(trade?.symbol);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [tab, setTab] = useState<'comments' | 'timeline'>('comments');

  if (!trade) return <Modal open={false} onClose={onClose}>{null}</Modal>;
  const pnl = tradePnl(trade, q?.price);
  const name = (id: string | null) => profiles.find((p) => p.id === id)?.display_name ?? 'Someone';

  const post = async () => {
    if (!text.trim()) return;
    setPosting(true);
    const c = await attempt(() => addTradeComment(trade, text.trim()), 'Could not post comment');
    setPosting(false);
    if (c) {
      setText('');
      comments.mutate((r) => (r.some((x) => x.id === c.id) ? r : [...r, c]));
    }
  };

  const describe = (e: (typeof events.rows)[number]) => {
    switch (e.event_type) {
      case 'created':
        return 'posted this idea';
      case 'status':
        return (
          <>
            moved status <Badge>{STATUS_META[e.detail.from as keyof typeof STATUS_META]?.label ?? e.detail.from}</Badge> →{' '}
            <Badge tone={STATUS_META[e.detail.to as keyof typeof STATUS_META]?.tone}>{STATUS_META[e.detail.to as keyof typeof STATUS_META]?.label ?? e.detail.to}</Badge>
          </>
        );
      case 'edited':
        return `edited ${(e.detail.fields ?? []).join(', ') || 'details'}`;
      case 'comment':
        return <>commented: “{e.detail.excerpt}”</>;
    }
  };

  return (
    <Modal open={Boolean(trade)} onClose={onClose} drawer title={<span className="flex items-center gap-2">Trade idea <TickerChip symbol={trade.symbol} /></span>}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={trade.direction === 'long' ? 'green' : 'red'}>{trade.direction}</Badge>
          <Badge tone={STATUS_META[trade.status].tone}>{STATUS_META[trade.status].label}</Badge>
          <span className="text-xs text-slate-500">
            by {name(trade.created_by)} · {timeAgo(trade.created_at)}
          </span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" icon={<Edit3 className="h-3.5 w-3.5" />} onClick={() => onEdit(trade)}>
              Edit
            </Button>
            {trade.created_by === me && (
              <ConfirmButton
                onConfirm={async () => {
                  const ok = await attempt(() => deleteTrade(trade.id));
                  if (ok !== undefined) {
                    toast.info('Trade idea deleted');
                    onClose();
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </ConfirmButton>
            )}
          </div>
        </div>

        <div className="glass overflow-hidden">
          <div className="flex items-center gap-2 px-3 pt-2">
            <span className="label">Price · {tvSymbolFor(trade.symbol)}</span>
            <TradingViewBadge className="ml-auto" />
          </div>
          <div className="h-[190px]">
            <TradingViewWidget key={trade.symbol} script="mini-symbol-overview" config={tv.miniSymbol(tvSymbolFor(trade.symbol))} failureText="Market data temporarily unavailable" />
          </div>
          {pnl && (
            <div className="flex flex-wrap items-center gap-2 border-t border-white/5 px-3 py-2">
              <span className={cn('num text-sm', trendClass(pnl.pct))}>
                {fmtPct(pnl.pct)} {pnl.dollars != null && `(${pnl.dollars >= 0 ? '+' : ''}${fmtPrice(pnl.dollars)})`} {pnl.realized ? 'realized (your exit price)' : 'unrealized'}
              </span>
              {q && !pnl.realized && <DataSourceBadge provenance={q.provenance} />}
            </div>
          )}
        </div>

        <div>
          <p className="label mb-2">Move status</p>
          <div className="flex flex-wrap gap-1.5">
            {TRADE_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => s !== trade.status && void attempt(() => updateTrade(trade, { status: s }))}
                className={cn(
                  'rounded-lg border px-2.5 py-1 text-xs transition',
                  s === trade.status ? 'border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 text-slate-400 hover:text-white',
                )}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-3">
          {[
            ['Entry', fmtPrice(trade.entry)],
            ['Target', fmtPrice(trade.target)],
            ['Stop', fmtPrice(trade.stop)],
            ['Size (sh)', trade.position_size ?? '—'],
            ['Expected move (user est.)', trade.expected_move != null ? `±${trade.expected_move}%` : '—'],
            ['Probability (user est.)', trade.probability != null ? `${trade.probability}%` : '—'],
            ['Catalyst date', fmtDate(trade.catalyst_date)],
            ['Horizon', trade.time_horizon ?? '—'],
            ['Exit', fmtPrice(trade.exit_price)],
          ].map(([l, v]) => (
            <div key={String(l)} className="rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
              <div className="text-[9px] uppercase tracking-wider text-slate-500">{l}</div>
              <div className="text-slate-100">{v}</div>
            </div>
          ))}
        </div>

        {[
          ['Catalyst', trade.catalyst],
          ['Team thesis', trade.thesis],
          ['Downside scenario', trade.downside],
        ].map(([l, v]) =>
          v ? (
            <div key={l}>
              <p className="label mb-1">{l}</p>
              <p className="whitespace-pre-wrap text-sm text-slate-300">
                <MessageContent text={v} />
              </p>
            </div>
          ) : null,
        )}

        <ReactionBar tradeId={trade.id} reactions={reactions} />

        <div>
          <div className="mb-3 flex gap-1 border-b border-white/5">
            {(['comments', 'timeline'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn('-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs capitalize', tab === t ? 'border-neon-cyan text-white' : 'border-transparent text-slate-500')}
              >
                {t === 'comments' ? <MessageSquare className="h-3.5 w-3.5" /> : <Activity className="h-3.5 w-3.5" />}
                {t} <span className="text-slate-600">{t === 'comments' ? comments.rows.length : events.rows.length}</span>
              </button>
            ))}
          </div>
          {tab === 'comments' ? (
            <div className="space-y-3">
              {comments.rows.map((c) => {
                const p = profiles.find((x) => x.id === c.user_id);
                return (
                  <div key={c.id} className="group flex gap-2.5">
                    <Avatar profile={p} size={26} />
                    <div className="min-w-0 flex-1 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-medium text-slate-200">{p?.display_name}</span>
                        <span className="font-mono text-slate-600">{fmtDateTime(c.created_at)}</span>
                        {c.user_id === me && (
                          <button
                            onClick={() => {
                              comments.mutate((r) => r.filter((x) => x.id !== c.id));
                              void attempt(() => deleteTradeComment(c.id));
                            }}
                            className="ml-auto text-slate-600 opacity-0 hover:text-rose-300 group-hover:opacity-100"
                            aria-label="Delete comment"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-300">
                        <MessageContent text={c.content} />
                      </p>
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void post();
                  }}
                  placeholder="Add a comment… (⌘/Ctrl+Enter)"
                  rows={2}
                  className="min-h-[44px]"
                />
                <Button variant="primary" onClick={post} loading={posting} className="self-end" icon={<Send className="h-4 w-4" />} aria-label="Post comment" />
              </div>
            </div>
          ) : (
            <ol className="relative space-y-3 border-l border-white/10 pl-5">
              {events.rows.map((e) => (
                <li key={e.id} className="relative text-xs text-slate-400">
                  <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full border-2 border-void-800 bg-neon-cyan shadow-glow" />
                  <span className="text-slate-200">{name(e.user_id)}</span> {describe(e)}
                  <div className="font-mono text-[10px] text-slate-600">{fmtDateTime(e.created_at)}</div>
                </li>
              ))}
              {events.rows.length === 0 && <li className="text-xs text-slate-500">No history yet.</li>}
            </ol>
          )}
        </div>
      </div>
    </Modal>
  );
}
