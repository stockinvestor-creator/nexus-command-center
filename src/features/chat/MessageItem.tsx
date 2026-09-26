import { memo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Check, Copy, CornerUpLeft, Edit3, Pin, PinOff, SmilePlus, Trash2, X } from 'lucide-react';
import type { Message, MessageReaction, Profile } from '@/types/db';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/cn';
import { fmtDateTime, fmtTime } from '@/lib/format';
import { extractUrls } from '@/lib/tickers';
import { attempt } from '@/store/toastStore';
import { useImageUrl } from '@/hooks/useImageUrl';
import { MessageContent } from './MessageContent';
import { StockShareCard } from './StockShareCard';
import { LinkPreview } from './LinkPreview';
import { deleteMessage, editMessage, togglePin, toggleReaction } from './api';

export const QUICK_EMOJI = ['👍', '🔥', '👀', '🚀', '😂', '⚠️', '✅', '❌', '💎', '📉'];

function ImageAttachment({ path }: { path: string }) {
  const { url, error } = useImageUrl(path);
  const [zoom, setZoom] = useState(false);
  if (error) return <p className="mt-1 text-xs text-amber-400">Image unavailable</p>;
  if (!url) return <div className="mt-1.5 h-40 w-60 animate-pulse rounded-xl bg-white/5" />;
  return (
    <>
      <button onClick={() => setZoom(true)} className="mt-1.5 block overflow-hidden rounded-xl border border-white/10">
        <img src={url} alt="attachment" loading="lazy" className="max-h-72 max-w-full object-contain sm:max-w-sm" />
      </button>
      {zoom && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur" onClick={() => setZoom(false)}>
          <img src={url} alt="attachment" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </>
  );
}

interface Props {
  msg: Message;
  author?: Profile;
  grouped: boolean;
  isMine: boolean;
  reactions: MessageReaction[];
  replyTo?: Message | null;
  replyAuthor?: Profile;
  profiles: Profile[];
  myId: string;
  onReply: (m: Message) => void;
  onJump: (id: string) => void;
  highlight?: boolean;
}

function MessageItemInner({ msg, author, grouped, isMine, reactions, replyTo, replyAuthor, profiles, myId, onReply, onJump, highlight }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(msg.content);
  const [picker, setPicker] = useState(false);
  const [copied, setCopied] = useState(false);
  const urls = msg.kind === 'text' ? extractUrls(msg.content).slice(0, 2) : [];

  const grouped_r = reactions.reduce<Record<string, MessageReaction[]>>((acc, r) => {
    (acc[r.emoji] ??= []).push(r);
    return acc;
  }, {});

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text || text === msg.content) return setEditing(false);
    const ok = await attempt(() => editMessage(msg, text), 'Edit failed');
    if (ok) setEditing(false);
  };

  return (
    <motion.div
      id={`msg-${msg.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'group relative flex gap-3 px-3 py-0.5 transition-colors hover:bg-white/[0.02] sm:px-5',
        !grouped && 'mt-3',
        msg.pinned && 'bg-amber-400/[0.03]',
        highlight && 'bg-neon-cyan/10',
      )}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {!grouped ? <Avatar profile={author} size={36} /> : <span className="hidden pt-1 text-right font-mono text-[9px] text-slate-600 group-hover:block">{fmtTime(msg.created_at)}</span>}
      </div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold" style={{ color: author?.avatar_color ?? '#e2e8f0' }}>
              {author?.display_name ?? 'Unknown'}
            </span>
            <span className="font-mono text-[10px] text-slate-600" title={fmtDateTime(msg.created_at)}>
              {fmtDateTime(msg.created_at)}
            </span>
            {msg.pinned && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-300">
                <Pin className="h-3 w-3" /> pinned
              </span>
            )}
          </div>
        )}

        {msg.reply_to && (
          <button onClick={() => replyTo && onJump(replyTo.id)} className="mb-0.5 flex max-w-full items-center gap-1.5 text-left text-[11px] text-slate-500 hover:text-slate-300">
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            {replyTo ? (
              <>
                <span className="shrink-0 whitespace-nowrap font-medium text-slate-400">{replyAuthor?.display_name}</span>
                <span className="min-w-0 truncate">{replyTo.content || (replyTo.kind === 'image' ? '📷 image' : replyTo.metadata.stock ? `$${replyTo.metadata.stock.symbol}` : '')}</span>
              </>
            ) : (
              <span className="italic">original message deleted</span>
            )}
          </button>
        )}

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void saveEdit();
                }
                if (e.key === 'Escape') setEditing(false);
              }}
              className="input min-h-[60px] text-sm"
            />
            <div className="mt-1 flex gap-2 text-[11px] text-slate-500">
              <button onClick={saveEdit} className="text-neon-cyan hover:underline">
                save
              </button>
              <button onClick={() => setEditing(false)} className="hover:underline">
                cancel
              </button>
              <span>Enter to save · Esc to cancel</span>
            </div>
          </div>
        ) : (
          msg.content && (
            <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed text-slate-200">
              <MessageContent text={msg.content} />
              {msg.edited_at && <span className="ml-1 text-[10px] text-slate-600">(edited)</span>}
            </p>
          )
        )}

        {msg.kind === 'stock_share' && msg.metadata.stock && <StockShareCard meta={msg.metadata.stock} />}
        {msg.attachment_path && <ImageAttachment path={msg.attachment_path} />}
        {urls.map((u) => (
          <LinkPreview key={u} url={u} />
        ))}

        {Object.keys(grouped_r).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {Object.entries(grouped_r).map(([emoji, list]) => {
              const mine = list.some((r) => r.user_id === myId);
              return (
                <button
                  key={emoji}
                  onClick={() => void attempt(() => toggleReaction(msg.id, emoji, reactions))}
                  title={list.map((r) => profiles.find((p) => p.id === r.user_id)?.display_name).join(', ')}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs transition active:scale-90',
                    mine ? 'border-neon-cyan/40 bg-neon-cyan/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20',
                  )}
                >
                  {emoji} <span className="font-mono text-[10px] text-slate-400">{list.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* hover toolbar */}
      {!editing && (
        <div className="absolute -top-3 right-3 z-10 hidden items-center gap-0.5 rounded-xl border border-white/10 bg-void-800/95 p-0.5 shadow-panel backdrop-blur group-hover:flex [@media(hover:none)]:group-focus-within:flex">
          <div className="relative">
            <ToolBtn label="React" onClick={() => setPicker((p) => !p)}>
              <SmilePlus className="h-3.5 w-3.5" />
            </ToolBtn>
            {picker && (
              <div className="absolute right-0 top-8 z-20 grid w-44 grid-cols-5 gap-0.5 rounded-xl border border-white/10 bg-void-800 p-1.5 shadow-panel">
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setPicker(false);
                      void attempt(() => toggleReaction(msg.id, e, reactions));
                    }}
                    className="rounded-lg p-1 text-lg hover:bg-white/10"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ToolBtn label="Reply" onClick={() => onReply(msg)}>
            <CornerUpLeft className="h-3.5 w-3.5" />
          </ToolBtn>
          <ToolBtn label={msg.pinned ? 'Unpin' : 'Pin'} onClick={() => void attempt(() => togglePin(msg))}>
            {msg.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </ToolBtn>
          <ToolBtn
            label="Copy text"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(msg.content);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </ToolBtn>
          {isMine && msg.kind !== 'system' && (
            <ToolBtn
              label="Edit"
              onClick={() => {
                setDraft(msg.content);
                setEditing(true);
              }}
            >
              <Edit3 className="h-3.5 w-3.5" />
            </ToolBtn>
          )}
          {isMine && <DeleteBtn id={msg.id} />}
        </div>
      )}
    </motion.div>
  );
}

function ToolBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button title={label} aria-label={label} onClick={onClick} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white">
      {children}
    </button>
  );
}

function DeleteBtn({ id }: { id: string }) {
  const [armed, setArmed] = useState(false);
  return armed ? (
    <span className="flex items-center gap-0.5">
      <ToolBtn label="Confirm delete" onClick={() => void attempt(() => deleteMessage(id), 'Delete failed')}>
        <Check className="h-3.5 w-3.5 text-rose-400" />
      </ToolBtn>
      <ToolBtn label="Cancel" onClick={() => setArmed(false)}>
        <X className="h-3.5 w-3.5" />
      </ToolBtn>
    </span>
  ) : (
    <ToolBtn label="Delete" onClick={() => setArmed(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </ToolBtn>
  );
}

export const MessageItem = memo(MessageItemInner);
