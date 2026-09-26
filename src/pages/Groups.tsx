import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Edit3, Hash, Lock, MessageSquare, Plus, Trash2, Users } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button, IconButton } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ConfirmButton } from '@/components/ui/ConfirmButton';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { useRealtime } from '@/store/realtimeStore';
import { attempt, toast } from '@/store/toastStore';
import { createChannel, deleteChannel, setGroupMembers, updateChannel } from '@/features/chat/api';
import type { Channel } from '@/types/db';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';

function ChannelEditor({ open, onClose, kind, editing, currentMembers }: { open: boolean; onClose: () => void; kind: 'channel' | 'group'; editing: Channel | null; currentMembers: { id: string; user_id: string }[] }) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setDesc(editing?.description ?? '');
    setSelected(editing ? currentMembers.map((m) => m.user_id) : profiles.map((p) => p.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const save = async () => {
    if (!name.trim()) return toast.warning('Name is required');
    setSaving(true);
    if (editing) {
      const ok = await attempt(async () => {
        await updateChannel(editing.id, { name, description: desc.trim() || null });
        if (editing.type === 'group') await setGroupMembers(editing.id, [...new Set([...(me ? [me] : []), ...selected])], currentMembers);
        return true;
      }, 'Could not save');
      setSaving(false);
      if (ok) {
        toast.success('Saved');
        onClose();
      }
    } else {
      const ch = await attempt(() => createChannel({ name, description: desc, type: kind, memberIds: selected }), 'Could not create');
      setSaving(false);
      if (ch) {
        toast.success(`${kind === 'group' ? 'Group' : 'Channel'} created`);
        onClose();
        navigate(`/messages/${ch.id}`);
      }
    }
  };

  const type = editing?.type ?? kind;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${type}` : type === 'group' ? 'New private group' : 'New channel'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name" hint="Lowercase, spaces become dashes">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={type === 'group' ? 'e.g. biotech-desk' : 'e.g. options'} />
        </Field>
        <Field label="Description">
          <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What's this for?" />
        </Field>
        {type === 'group' && (
          <Field label="Members">
            <div className="space-y-1">
              {profiles.map((p) => {
                const on = selected.includes(p.id) || p.id === me;
                return (
                  <button
                    key={p.id}
                    disabled={p.id === me}
                    onClick={() => setSelected((s) => (s.includes(p.id) ? s.filter((x) => x !== p.id) : [...s, p.id]))}
                    className={cn('flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition', on ? 'border-neon-cyan/30 bg-neon-cyan/5' : 'border-white/5 hover:border-white/15')}
                  >
                    <Avatar profile={p} size={24} />
                    {p.display_name}
                    {p.id === me && <span className="text-xs text-slate-500">(you)</span>}
                    <span className={cn('ml-auto h-4 w-4 rounded border', on ? 'border-neon-cyan bg-neon-cyan' : 'border-white/20')} />
                  </button>
                );
              })}
            </div>
          </Field>
        )}
        {type === 'channel' && <p className="text-xs text-slate-500">Channels are visible to everyone in the workspace. Use a group for a private room.</p>}
      </div>
    </Modal>
  );
}

export default function Groups() {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const unread = useRealtime((s) => s.unread);
  const channels = useLiveTable('channels', { order: { column: 'created_at' } });
  const members = useLiveTable('channel_members', {});
  const messages = useLiveTable('messages', { order: { column: 'created_at', ascending: false }, limit: 300 });
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const newKind = params.get('new');
  const [editor, setEditor] = useState<{ kind: 'channel' | 'group'; editing: Channel | null } | null>(null);

  useEffect(() => {
    if (newKind === 'channel' || newKind === 'group') {
      setEditor({ kind: newKind, editing: null });
      setParams({}, { replace: true });
    }
  }, [newKind, setParams]);

  const visible = channels.rows.filter((c) => c.type !== 'dm' && (c.type === 'channel' || members.rows.some((m) => m.channel_id === c.id && m.user_id === me)));
  const last = (id: string) => messages.rows.find((m) => m.channel_id === id);

  const section = (title: string, list: Channel[], icon: typeof Hash) => (
    <div>
      <p className="label mb-2">{title}</p>
      {list.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} yet`} className="glass" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const mem = members.rows.filter((m) => m.channel_id === c.id);
            const lm = last(c.id);
            const Icon = icon;
            return (
              <motion.div key={c.id} layout whileHover={{ y: -2 }} className="glass glow-border flex flex-col p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-neon-cyan/20 bg-neon-cyan/10 text-neon-cyan">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{c.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{c.description ?? (c.is_default ? 'Default channel' : '')}</p>
                  </div>
                  {(unread[c.id] ?? 0) > 0 && <Badge tone="pink" className="ml-auto">{unread[c.id]} new</Badge>}
                </div>
                <div className="mt-3 flex -space-x-1.5">
                  {(c.type === 'channel' ? profiles : profiles.filter((p) => mem.some((m) => m.user_id === p.id))).map((p) => (
                    <Avatar key={p.id} profile={p} size={22} className="ring-2 ring-void-800 rounded-xl" />
                  ))}
                </div>
                <p className="mt-2 line-clamp-1 text-xs text-slate-500">{lm ? `${profiles.find((p) => p.id === lm.user_id)?.display_name}: ${lm.content || '📎'} · ${timeAgo(lm.created_at)}` : 'No messages yet'}</p>
                <div className="mt-3 flex items-center gap-1 border-t border-white/5 pt-3">
                  <Button size="sm" variant="outline" icon={<MessageSquare className="h-3.5 w-3.5" />} onClick={() => navigate(`/messages/${c.id}`)}>
                    Open
                  </Button>
                  {c.created_by === me && (
                    <>
                      <IconButton label="Edit" className="ml-auto" onClick={() => setEditor({ kind: c.type === 'group' ? 'group' : 'channel', editing: c })}>
                        <Edit3 className="h-4 w-4" />
                      </IconButton>
                      {!c.is_default && (
                        <ConfirmButton onConfirm={() => void attempt(() => deleteChannel(c.id)).then(() => toast.info(`Deleted ${c.name}`))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </ConfirmButton>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Groups & Channels"
        subtitle="Public channels for everyone, private groups for focused rooms."
        actions={
          <>
            <Button icon={<Hash className="h-4 w-4" />} onClick={() => setEditor({ kind: 'channel', editing: null })}>
              New channel
            </Button>
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ kind: 'group', editing: null })}>
              New group
            </Button>
          </>
        }
      />
      <div className="space-y-6 px-3 sm:px-5">
        {channels.loading ? (
          <SkeletonRows rows={6} />
        ) : (
          <>
            {section('Private groups', visible.filter((c) => c.type === 'group'), Lock)}
            {section('Channels', visible.filter((c) => c.type === 'channel'), Hash)}
            <div className="glass flex items-center gap-3 p-4 text-sm text-slate-400">
              <Users className="h-5 w-5 text-neon-cyan" />
              Direct messages live in the Messages sidebar. Workspace members: {profiles.map((p) => p.display_name).join(', ')}.
            </div>
          </>
        )}
      </div>
      <ChannelEditor
        open={editor != null}
        onClose={() => setEditor(null)}
        kind={editor?.kind ?? 'channel'}
        editing={editor?.editing ?? null}
        currentMembers={editor?.editing ? members.rows.filter((m) => m.channel_id === editor.editing!.id) : []}
      />
    </div>
  );
}
