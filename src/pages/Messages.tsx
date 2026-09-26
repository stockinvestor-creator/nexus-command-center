import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowDown, ArrowLeft, Hash, Lock, Pin, Search, Users, X } from 'lucide-react';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useAuth } from '@/store/authStore';
import { useRealtime } from '@/store/realtimeStore';
import { backend } from '@/services/backend';
import type { Channel, Message } from '@/types/db';
import { ChannelList } from '@/features/chat/ChannelList';
import { MessageItem } from '@/features/chat/MessageItem';
import { Composer } from '@/features/chat/Composer';
import { MessageContent } from '@/features/chat/MessageContent';
import { channelLabel, markChannelRead } from '@/features/chat/api';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, Spinner } from '@/components/ui/States';
import { IconButton } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { fmtDateTime } from '@/lib/format';

const PAGE = 150;

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function TypingIndicator({ channelId }: { channelId: string }) {
  const me = useAuth((s) => s.user?.id);
  const raw = useRealtime((s) => s.typing[channelId]);
  const typing = useMemo(() => (raw ?? []).filter((t) => t.userId !== me), [raw, me]);
  return (
    <div className="h-5 px-5 text-[11px] text-slate-500">
      {typing.length > 0 && (
        <span className="inline-flex items-center gap-1.5">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1 w-1 animate-bounce rounded-full bg-neon-cyan" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </span>
          {typing.map((t) => t.name).join(', ')} {typing.length > 1 ? 'are' : 'is'} typing…
        </span>
      )}
    </div>
  );
}

function SidePanel({ mode, channel, onClose, onJump }: { mode: 'pins' | 'search'; channel: Channel; onClose: () => void; onJump: (m: Message) => void }) {
  const profiles = useAuth((s) => s.profiles);
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'channel' | 'all'>('channel');
  const [results, setResults] = useState<Message[] | null>(null);
  const [loading, setLoading] = useState(false);
  const pins = useLiveTable(mode === 'pins' ? 'messages' : null, { eq: { channel_id: channel.id, pinned: true }, order: { column: 'created_at', ascending: false } });

  useEffect(() => {
    if (mode !== 'search') return;
    const term = q.trim();
    if (term.length < 2) return setResults(null);
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const safe = term.replace(/[%_\\]/g, (c) => `\\${c}`);
        setResults(
          await backend.select('messages', {
            ilike: { column: 'content', pattern: `%${safe}%` },
            ...(scope === 'channel' ? { eq: { channel_id: channel.id } } : {}),
            order: { column: 'created_at', ascending: false },
            limit: 50,
          }),
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, scope, mode, channel.id]);

  const list = mode === 'pins' ? pins.rows : results ?? [];
  return (
    <aside className="absolute inset-0 z-20 flex flex-col border-l border-white/[0.06] bg-void-900/95 backdrop-blur-xl lg:static lg:w-80 lg:bg-void-900/40">
      <div className="flex h-12 items-center gap-2 border-b border-white/[0.06] px-4">
        {mode === 'pins' ? <Pin className="h-4 w-4 text-amber-300" /> : <Search className="h-4 w-4 text-neon-cyan" />}
        <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-slate-200">{mode === 'pins' ? 'Pinned' : 'Search messages'}</span>
        <button onClick={onClose} className="ml-auto text-slate-500 hover:text-white" aria-label="Close panel">
          <X className="h-4 w-4" />
        </button>
      </div>
      {mode === 'search' && (
        <div className="space-y-2 border-b border-white/[0.06] p-3">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search text, $TICKER…" className="input h-9 text-sm" />
          <div className="flex gap-1 text-[11px]">
            {(['channel', 'all'] as const).map((s) => (
              <button key={s} onClick={() => setScope(s)} className={cn('rounded-lg px-2 py-1', scope === s ? 'bg-neon-cyan/10 text-neon-cyan' : 'text-slate-500 hover:text-slate-300')}>
                {s === 'channel' ? 'This conversation' : 'Everywhere'}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {loading && <Spinner className="mx-auto" />}
        {!loading && list.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{mode === 'pins' ? 'No pinned messages.' : q.trim().length < 2 ? 'Type at least 2 characters.' : 'No matches.'}</p>}
        {list.map((m) => {
          const p = profiles.find((x) => x.id === m.user_id);
          return (
            <button key={m.id} onClick={() => onJump(m)} className="block w-full rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-left transition hover:border-neon-cyan/30">
              <div className="flex items-center gap-2 text-[11px]">
                <Avatar profile={p} size={18} />
                <span className="text-slate-300">{p?.display_name}</span>
                <span className="ml-auto font-mono text-[10px] text-slate-600">{fmtDateTime(m.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-xs text-slate-400">
                {m.kind === 'stock_share' && m.metadata.stock ? `📈 ${m.metadata.stock.symbol} ` : ''}
                <MessageContent text={m.content} />
              </p>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function ChatView({ channel, members, onBack }: { channel: Channel; members: { channel_id: string; user_id: string }[]; onBack: () => void }) {
  const me = useAuth((s) => s.user?.id) ?? '';
  const profiles = useAuth((s) => s.profiles);
  const online = useRealtime((s) => s.online);
  const clearUnread = useRealtime((s) => s.clearUnread);
  const navigate = useNavigate();
  const [limit, setLimit] = useState(PAGE);
  const messages = useLiveTable('messages', { eq: { channel_id: channel.id }, order: { column: 'created_at', ascending: false }, limit });
  const reactions = useLiveTable('message_reactions', { order: { column: 'created_at', ascending: false }, limit: 3000 });
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [panel, setPanel] = useState<null | 'pins' | 'search'>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const lastNewest = useRef<string | null | undefined>(undefined);
  const prevHeight = useRef(0);

  const ordered = useMemo(() => [...messages.rows].reverse(), [messages.rows]);
  const byId = useMemo(() => new Map(messages.rows.map((m) => [m.id, m])), [messages.rows]);
  const reactionsBy = useMemo(() => {
    const map = new Map<string, typeof reactions.rows>();
    for (const r of reactions.rows) {
      if (!byId.has(r.message_id)) continue;
      const list = map.get(r.message_id) ?? [];
      list.push(r);
      map.set(r.message_id, list);
    }
    return map;
  }, [reactions.rows, byId]);

  const memberIds = useMemo(() => {
    if (channel.type === 'channel') return profiles.map((p) => p.id);
    return members.filter((m) => m.channel_id === channel.id).map((m) => m.user_id);
  }, [channel, members, profiles]);

  const label = channelLabel(channel, profiles, me);

  // mark read when opening and when new messages arrive while visible
  useEffect(() => {
    clearUnread(channel.id);
    void markChannelRead(channel.id);
    setReplyTo(null);
    setPanel(null);
    setLimit(PAGE);
  }, [channel.id, clearUnread]);

  // stick to bottom when a NEW message arrives (not when older history loads), and mark it read
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const newest = messages.rows[0];
    const newestId = newest?.id ?? null;
    const first = lastNewest.current === undefined;
    if (newestId && newestId !== lastNewest.current) {
      if (first || atBottom || newest.user_id === me) el.scrollTop = el.scrollHeight;
      if (!first && atBottom && document.visibilityState === 'visible' && newest.user_id !== me) {
        void markChannelRead(channel.id);
        clearUnread(channel.id);
      }
    }
    lastNewest.current = newestId;
  }, [messages.rows, atBottom, me, channel.id, clearUnread]);

  // keep position when older messages are prepended
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (prevHeight.current && el.scrollHeight > prevHeight.current && el.scrollTop < 50) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
    }
    prevHeight.current = el.scrollHeight;
  }, [limit, messages.rows.length]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
    if (el.scrollTop < 40 && messages.rows.length >= limit) setLimit((l) => l + PAGE);
  };

  const jump = useCallback(
    (m: Message) => {
      if (m.channel_id !== channel.id) {
        navigate(`/messages/${m.channel_id}`);
        return;
      }
      const el = document.getElementById(`msg-${m.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlight(m.id);
        setTimeout(() => setHighlight(null), 1800);
      }
      if (window.innerWidth < 1024) setPanel(null);
    },
    [channel.id, navigate],
  );
  const jumpId = useCallback((id: string) => {
    const m = byId.get(id);
    if (m) jump(m);
  }, [byId, jump]);

  const others = memberIds.filter((id) => id !== me);
  const dmPartner = channel.type === 'dm' ? profiles.find((p) => p.id === others[0]) : undefined;

  return (
    <div className="relative flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-white/[0.06] bg-void-900/40 px-3 backdrop-blur-xl sm:px-5">
          <button onClick={onBack} className="-ml-1 rounded-lg p-1.5 text-slate-400 hover:text-white md:hidden" aria-label="Back to conversations">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {channel.type === 'dm' ? (
            <Avatar profile={dmPartner} size={24} online={online.some((o) => o.id === dmPartner?.id)} />
          ) : channel.type === 'group' ? (
            <Lock className="h-4 w-4 text-slate-500" />
          ) : (
            <Hash className="h-4 w-4 text-slate-500" />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">{label}</h2>
          </div>
          {channel.description && <span className="hidden truncate border-l border-white/10 pl-2 text-xs text-slate-500 lg:inline">{channel.description}</span>}
          <div className="ml-auto flex items-center gap-0.5">
            <span className="mr-2 hidden items-center gap-1 font-mono text-[10px] text-slate-500 sm:flex" title="Members online">
              <Users className="h-3.5 w-3.5" /> {memberIds.filter((id) => online.some((o) => o.id === id)).length}/{memberIds.length}
            </span>
            <IconButton label="Pinned messages" active={panel === 'pins'} onClick={() => setPanel(panel === 'pins' ? null : 'pins')}>
              <Pin className="h-4 w-4" />
            </IconButton>
            <IconButton label="Search messages" active={panel === 'search'} onClick={() => setPanel(panel === 'search' ? null : 'search')}>
              <Search className="h-4 w-4" />
            </IconButton>
          </div>
        </header>

        <div ref={scroller} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto pb-2 pt-2">
          {messages.loading ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : messages.error ? (
            <p className="p-5 text-sm text-amber-400">{messages.error}</p>
          ) : ordered.length === 0 ? (
            <EmptyState
              className="h-full"
              icon={channel.type === 'dm' ? <Users /> : <Hash />}
              title={`This is the start of ${channel.type === 'dm' ? `your conversation with ${label}` : `#${label}`}`}
              body="Paste $TICKERS, share stock cards, drop images, and @mention each other."
            />
          ) : (
            <>
              {messages.rows.length >= limit && <p className="py-2 text-center font-mono text-[10px] text-slate-600">Scroll up for older messages…</p>}
              {ordered.map((m, i) => {
                const prev = ordered[i - 1];
                const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                const grouped =
                  !newDay && prev && prev.user_id === m.user_id && !m.reply_to && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
                const reply = m.reply_to ? byId.get(m.reply_to) ?? null : null;
                return (
                  <div key={m.id}>
                    {newDay && (
                      <div className="my-4 flex items-center gap-3 px-5">
                        <span className="h-px flex-1 bg-white/[0.06]" />
                        <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{dayLabel(m.created_at)}</span>
                        <span className="h-px flex-1 bg-white/[0.06]" />
                      </div>
                    )}
                    <MessageItem
                      msg={m}
                      author={profiles.find((p) => p.id === m.user_id)}
                      grouped={Boolean(grouped)}
                      isMine={m.user_id === me}
                      reactions={reactionsBy.get(m.id) ?? []}
                      replyTo={reply}
                      replyAuthor={reply ? profiles.find((p) => p.id === reply.user_id) : undefined}
                      profiles={profiles}
                      myId={me}
                      onReply={setReplyTo}
                      onJump={jumpId}
                      highlight={highlight === m.id}
                    />
                  </div>
                );
              })}
            </>
          )}
        </div>
        {!atBottom && (
          <button
            onClick={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })}
            className="absolute bottom-28 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-neon-cyan/30 bg-void-800/90 px-3 py-1.5 text-xs text-neon-cyan shadow-glow backdrop-blur"
          >
            <ArrowDown className="h-3.5 w-3.5" /> Latest
          </button>
        )}
        <TypingIndicator channelId={channel.id} />
        <Composer channel={channel} memberIds={memberIds} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} label={channel.type === 'dm' ? label : `#${label}`} />
      </div>
      {panel && <SidePanel mode={panel} channel={channel} onClose={() => setPanel(null)} onJump={jump} />}
    </div>
  );
}

export default function Messages() {
  const { channelId } = useParams();
  const navigate = useNavigate();
  const desktop = useMediaQuery('(min-width: 768px)');
  const channels = useLiveTable('channels', { order: { column: 'created_at' } });
  const members = useLiveTable('channel_members', {});
  const channel = channels.rows.find((c) => c.id === channelId);

  if (!channelId && desktop && channels.rows.length) {
    const general = channels.rows.find((c) => c.slug === 'general') ?? channels.rows.find((c) => c.type === 'channel') ?? channels.rows[0];
    return <Navigate to={`/messages/${general.id}`} replace />;
  }

  return (
    <div className="flex h-full min-h-0">
      <div className={cn('w-full shrink-0 border-r border-white/[0.06] bg-void-900/30 backdrop-blur-xl md:w-64', channelId && 'hidden md:block')}>
        {channels.loading ? (
          <div className="flex h-full items-center justify-center">
            <Spinner />
          </div>
        ) : channels.error ? (
          <p className="p-4 text-sm text-amber-400">{channels.error}</p>
        ) : (
          <ChannelList channels={channels.rows} members={members.rows} activeId={channelId} />
        )}
      </div>
      {channelId && (
        <div className="flex min-w-0 flex-1">
          {channel ? (
            <ChatView key={channel.id} channel={channel} members={members.rows} onBack={() => navigate('/messages')} />
          ) : channels.loading ? (
            <div className="flex flex-1 items-center justify-center">
              <Spinner />
            </div>
          ) : (
            <EmptyState className="flex-1" title="Conversation not found" body="It may have been deleted, or you're not a member." />
          )}
        </div>
      )}
    </div>
  );
}
