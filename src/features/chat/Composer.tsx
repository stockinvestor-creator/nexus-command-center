import { useEffect, useRef, useState } from 'react';
import { CandlestickChart, ImagePlus, Loader2, Send, Smile, X } from 'lucide-react';
import type { Channel, Message, Profile, StockShareMeta } from '@/types/db';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useRealtime } from '@/store/realtimeStore';
import { attempt, toast } from '@/store/toastStore';
import { cn } from '@/lib/cn';
import { handleFor, sendMessage } from './api';
import { ShareStockModal } from './ShareStockModal';
import { QUICK_EMOJI } from './MessageItem';

const MORE_EMOJI = ['🙏', '💰', '📈', '🤝', '🎯', '🧠', '😬', '🤡', '🐻', '🐂', '⏰', '💥', '🫡', '👑', '🌙'];

export function Composer({
  channel,
  memberIds,
  replyTo,
  onCancelReply,
  label,
}: {
  channel: Channel;
  memberIds: string[];
  replyTo: Message | null;
  onCancelReply: () => void;
  label: string;
}) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const room = useRealtime((s) => s.room);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [share, setShare] = useState(false);
  const [mention, setMention] = useState<{ q: string; idx: number } | null>(null);
  const ta = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftKey = `ncc.draft.${channel.id}`;

  // per-channel drafts
  useEffect(() => {
    try {
      setText(sessionStorage.getItem(draftKey) ?? '');
    } catch {
      setText('');
    }
    setPending(null);
  }, [draftKey]);
  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(draftKey, text);
      else sessionStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [text, draftKey]);

  // autosize
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (replyTo) ta.current?.focus();
  }, [replyTo]);

  const mentionOptions: Profile[] = mention
    ? profiles.filter((p) => handleFor(p).toLowerCase().startsWith(mention.q.toLowerCase()) || p.display_name.toLowerCase().startsWith(mention.q.toLowerCase()))
    : [];

  const onChange = (v: string) => {
    setText(v);
    room?.sendTyping(channel.id);
    const caret = ta.current?.selectionStart ?? v.length;
    const before = v.slice(0, caret);
    const m = /(^|\s)@([\w.-]*)$/.exec(before);
    setMention(m ? { q: m[2], idx: caret - m[2].length - 1 } : null);
  };

  const insertMention = (p: Profile) => {
    if (!mention) return;
    const caret = ta.current?.selectionStart ?? text.length;
    const next = `${text.slice(0, mention.idx)}@${handleFor(p)} ${text.slice(caret)}`;
    setText(next);
    setMention(null);
    requestAnimationFrame(() => ta.current?.focus());
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast.warning('Only images can be attached');
    if (f.size > 5 * 1024 * 1024) return toast.warning('Max image size is 5 MB');
    setPending({ file: f, preview: URL.createObjectURL(f) });
  };

  const send = async () => {
    const content = text.trim();
    if ((!content && !pending) || sending || !me) return;
    setSending(true);
    let attachmentPath: string | null = null;
    if (pending) {
      setUploading(true);
      attachmentPath = (await attempt(() => backend.uploadImage(pending.file, me), 'Upload failed')) ?? null;
      setUploading(false);
      if (!attachmentPath) {
        setSending(false);
        return;
      }
    }
    const ok = await attempt(() => sendMessage({ channel, content, replyTo: replyTo?.id ?? null, attachmentPath, memberIds }), 'Message failed');
    setSending(false);
    if (ok) {
      setText('');
      if (pending) URL.revokeObjectURL(pending.preview);
      setPending(null);
      onCancelReply();
      ta.current?.focus();
    }
  };

  const shareStock = async (meta: StockShareMeta, comment: string) => {
    await attempt(
      () => sendMessage({ channel, content: comment, kind: 'stock_share', metadata: { stock: meta }, replyTo: replyTo?.id ?? null, memberIds }),
      'Share failed',
    );
    onCancelReply();
  };

  return (
    <div className="border-t border-white/[0.06] bg-void-900/60 px-3 pb-3 pt-2 backdrop-blur-xl sm:px-5">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border-l-2 border-neon-cyan bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400">
          Replying to <span className="font-medium text-slate-200">{profiles.find((p) => p.id === replyTo.user_id)?.display_name}</span>
          <span className="truncate text-slate-500">{replyTo.content}</span>
          <button onClick={onCancelReply} className="ml-auto text-slate-500 hover:text-white" aria-label="Cancel reply">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {pending && (
        <div className="mb-2 flex items-center gap-3">
          <div className="relative">
            <img src={pending.preview} alt="" className="h-16 w-16 rounded-lg object-cover" />
            <button
              onClick={() => {
                URL.revokeObjectURL(pending.preview);
                setPending(null);
              }}
              className="absolute -right-1.5 -top-1.5 rounded-full bg-void-800 p-0.5 text-slate-300 hover:text-white"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-slate-500">
            {pending.file.name} · {(pending.file.size / 1024).toFixed(0)} KB {uploading && <Loader2 className="ml-1 inline h-3 w-3 animate-spin" />}
          </span>
        </div>
      )}
      <div className="relative flex items-end gap-1.5 rounded-2xl border border-white/10 bg-void-800/80 p-1.5 transition focus-within:border-neon-cyan/40 focus-within:shadow-glow">
        {mention && mentionOptions.length > 0 && (
          <div className="absolute bottom-full left-2 mb-2 w-56 rounded-xl border border-white/10 bg-void-800 p-1 shadow-panel">
            {mentionOptions.map((p) => (
              <button key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => insertMention(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5">
                <span className="h-2 w-2 rounded-full" style={{ background: p.avatar_color }} />
                {p.display_name} <span className="font-mono text-[10px] text-slate-500">@{handleFor(p)}</span>
              </button>
            ))}
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => {
          pickFile(e.target.files?.[0]);
          e.target.value = '';
        }} />
        <button onClick={() => fileRef.current?.click()} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-white" aria-label="Attach image" title="Attach image">
          <ImagePlus className="h-[18px] w-[18px]" />
        </button>
        <button onClick={() => setShare(true)} className="rounded-xl p-2 text-slate-400 transition hover:bg-white/5 hover:text-neon-cyan" aria-label="Share ticker" title="Share a ticker card">
          <CandlestickChart className="h-[18px] w-[18px]" />
        </button>
        <textarea
          ref={ta}
          value={text}
          rows={1}
          onChange={(e) => onChange(e.target.value)}
          onPaste={(e) => {
            const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/'));
            if (f) {
              e.preventDefault();
              pickFile(f);
            }
          }}
          onKeyDown={(e) => {
            if (mention && mentionOptions.length && (e.key === 'Enter' || e.key === 'Tab')) {
              e.preventDefault();
              insertMention(mentionOptions[0]);
              return;
            }
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={`Message ${label} — use $TICKER, @name`}
          className="max-h-[180px] min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-[14px] text-slate-100 outline-none placeholder:text-slate-500"
        />
        <div className="relative">
          <button onClick={() => setEmoji((v) => !v)} className={cn('rounded-xl p-2 transition hover:bg-white/5', emoji ? 'text-neon-cyan' : 'text-slate-400 hover:text-white')} aria-label="Emoji">
            <Smile className="h-[18px] w-[18px]" />
          </button>
          {emoji && (
            <div className="absolute bottom-11 right-0 z-20 grid w-56 grid-cols-6 gap-0.5 rounded-xl border border-white/10 bg-void-800 p-1.5 shadow-panel">
              {[...QUICK_EMOJI, ...MORE_EMOJI].map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setText((t) => t + e);
                    setEmoji(false);
                    ta.current?.focus();
                  }}
                  className="rounded-lg p-1 text-lg hover:bg-white/10"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => void send()}
          disabled={sending || (!text.trim() && !pending)}
          className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 p-2 text-white shadow-glow transition hover:brightness-110 disabled:opacity-30 disabled:shadow-none"
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Send className="h-[18px] w-[18px]" />}
        </button>
      </div>
      <p className="mt-1 hidden font-mono text-[10px] text-slate-600 sm:block">Enter to send · Shift+Enter for newline · paste images · $TICKER becomes a chip</p>
      <ShareStockModal open={share} onClose={() => setShare(false)} onShare={shareStock} />
    </div>
  );
}
