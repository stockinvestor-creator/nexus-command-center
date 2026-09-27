import { useMemo, useState, type ReactNode } from 'react';
import { Hash, Lock, Send, User } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Field, Textarea } from '@/components/ui/Field';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { attempt, toast } from '@/store/toastStore';
import type { SharedCard } from '@/types/db';
import { cn } from '@/lib/cn';
import { channelLabel, sendMessage } from './api';
import { notifyOthers } from '@/features/notifications/api';

/** Share a structured card (event / prediction / Why-Is-It-Moving) into any conversation. */
export function ShareCardModal({ open, onClose, card, preview, defaultSlug = 'catalysts' }: { open: boolean; onClose: () => void; card: SharedCard; preview?: ReactNode; defaultSlug?: string }) {
  const channels = useLiveTable(open ? 'channels' : null, { order: { column: 'created_at' } });
  const members = useLiveTable(open ? 'channel_members' : null, {});
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const [target, setTarget] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const visible = useMemo(
    () => channels.rows.filter((c) => c.type === 'channel' || members.rows.some((m) => m.channel_id === c.id && m.user_id === me)),
    [channels.rows, members.rows, me],
  );
  const chosen = visible.find((c) => c.id === target) ?? visible.find((c) => c.slug === defaultSlug) ?? visible[0];

  const send = async () => {
    if (!chosen) return;
    setBusy(true);
    const memberIds = chosen.type === 'channel' ? profiles.map((p) => p.id) : members.rows.filter((m) => m.channel_id === chosen.id).map((m) => m.user_id);
    const ok = await attempt(() => sendMessage({ channel: chosen, content: comment.trim(), metadata: { card }, memberIds }), 'Share failed');
    setBusy(false);
    if (ok) {
      if (card.type === 'event' || card.type === 'manual_catalyst') {
        const title = card.type === 'event' ? card.event.title : card.headline;
        void notifyOthers({ type: 'catalyst', title: `Catalyst shared: ${title.slice(0, 90)}`, link: `/messages/${chosen.id}` });
      }
      toast.success(`Shared to ${chosen.type === 'dm' ? channelLabel(chosen, profiles, me) : `#${chosen.name}`}`);
      setComment('');
      onClose();
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share to chat"
      footer={
        <Button variant="primary" loading={busy} disabled={!chosen} onClick={send} icon={<Send className="h-4 w-4" />}>
          Share
        </Button>
      }
    >
      <div className="space-y-4">
        {preview && <div className="rounded-xl border border-white/10 bg-black/20 p-3">{preview}</div>}
        <Field label="Conversation">
          <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
            {visible.map((c) => (
              <button
                key={c.id}
                onClick={() => setTarget(c.id)}
                className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs', chosen?.id === c.id ? 'border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan' : 'border-white/10 text-slate-300 hover:border-white/25')}
              >
                {c.type === 'dm' ? <User className="h-3 w-3" /> : c.type === 'group' ? <Lock className="h-3 w-3" /> : <Hash className="h-3 w-3" />}
                {channelLabel(c, profiles, me)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Comment (optional)">
          <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Why does this matter?" />
        </Field>
      </div>
    </Modal>
  );
}
