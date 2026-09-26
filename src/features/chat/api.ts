import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { extractMentions, extractTickers } from '@/lib/tickers';
import type { Channel, Message, MessageKind, MessageMetadata, MessageReaction, Profile } from '@/types/db';
import { notifyUsers } from '@/features/notifications/api';

const me = () => {
  const u = useAuth.getState().user;
  if (!u) throw new Error('Not signed in');
  return u.id;
};

export const handleFor = (p: Pick<Profile, 'display_name'>) => p.display_name.replace(/\s+/g, '');

export function resolveMentions(content: string, profiles: Profile[]): string[] {
  const handles = extractMentions(content);
  if (!handles.length) return [];
  return profiles
    .filter((p) => {
      const opts = [handleFor(p).toLowerCase(), p.display_name.split(/\s+/)[0].toLowerCase(), p.email.split('@')[0].toLowerCase()];
      return handles.some((h) => opts.includes(h));
    })
    .map((p) => p.id);
}

export function channelLabel(c: Channel, profiles: Profile[], myId?: string): string {
  if (c.type === 'dm') {
    const ids = (c.dm_key ?? '').split(':');
    const other = ids.find((id) => id !== myId) ?? myId;
    return profiles.find((p) => p.id === other)?.display_name ?? 'Direct message';
  }
  return c.name;
}

export interface SendInput {
  channel: Channel;
  content: string;
  replyTo?: string | null;
  kind?: MessageKind;
  metadata?: MessageMetadata;
  attachmentPath?: string | null;
  memberIds: string[];
}

export async function sendMessage(input: SendInput): Promise<Message> {
  const uid = me();
  const { profiles, profile } = useAuth.getState();
  const tickers = extractTickers(input.content);
  const mentions = resolveMentions(input.content, profiles);
  const msg = await backend.insert('messages', {
    channel_id: input.channel.id,
    user_id: uid,
    content: input.content,
    kind: input.kind ?? (input.attachmentPath ? 'image' : 'text'),
    metadata: { ...(input.metadata ?? {}), tickers, mentions },
    reply_to: input.replyTo ?? null,
    attachment_path: input.attachmentPath ?? null,
  });

  // mark my own read pointer forward
  void markChannelRead(input.channel.id);

  // notifications (best-effort)
  const name = profile?.display_name ?? 'Someone';
  const where = input.channel.type === 'dm' ? 'a direct message' : `#${input.channel.name}`;
  const link = `/messages/${input.channel.id}`;
  const preview = input.content.slice(0, 140) || (input.attachmentPath ? '📷 Image' : input.metadata?.stock ? `Shared $${input.metadata.stock.symbol}` : '');
  const recipients = input.memberIds.filter((id) => id !== uid);
  const mentioned = mentions.filter((id) => id !== uid);
  if (mentioned.length) {
    await notifyUsers(mentioned, { type: 'mention', title: `${name} mentioned you in ${where}`, body: preview, link });
  }
  if (input.channel.type === 'dm') {
    await notifyUsers(recipients.filter((id) => !mentioned.includes(id)), { type: 'message', title: `New message from ${name}`, body: preview, link });
  }
  if (tickers.length && recipients.length) {
    try {
      const watched = await backend.select('watchlist_items', { in: { column: 'symbol', values: tickers } });
      const byOwner = new Map<string, string[]>();
      for (const w of watched) {
        if (!recipients.includes(w.owner_id)) continue;
        byOwner.set(w.owner_id, [...(byOwner.get(w.owner_id) ?? []), w.symbol]);
      }
      for (const [owner, syms] of byOwner) {
        await notifyUsers([owner], {
          type: 'ticker_mention',
          title: `${name} mentioned ${[...new Set(syms)].map((s) => '$' + s).join(', ')} (on your watchlist)`,
          body: preview,
          link,
        });
      }
    } catch {
      /* ignore */
    }
  }
  return msg;
}

export async function editMessage(msg: Message, content: string) {
  const { profiles } = useAuth.getState();
  return backend.update('messages', msg.id, {
    content,
    edited_at: new Date().toISOString(),
    metadata: { ...msg.metadata, tickers: extractTickers(content), mentions: resolveMentions(content, profiles) },
  });
}

export const deleteMessage = (id: string) => backend.remove('messages', id);

export const togglePin = (m: Message) => backend.update('messages', m.id, { pinned: !m.pinned });

export async function toggleReaction(messageId: string, emoji: string, existing: MessageReaction[]) {
  const uid = me();
  const mine = existing.find((r) => r.message_id === messageId && r.user_id === uid && r.emoji === emoji);
  if (mine) await backend.remove('message_reactions', mine.id);
  else await backend.insert('message_reactions', { message_id: messageId, user_id: uid, emoji });
}

export async function markChannelRead(channelId: string) {
  const uid = me();
  try {
    await backend.upsert(
      'channel_members',
      { channel_id: channelId, user_id: uid, last_read_at: new Date().toISOString() },
      ['channel_id', 'user_id'],
    );
  } catch {
    /* non-members of a public channel can't upsert until joined; ignore */
  }
}

export async function createChannel(input: { name: string; description?: string; type: 'channel' | 'group'; memberIds: string[] }): Promise<Channel> {
  const uid = me();
  const name = input.name.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 60);
  if (!name) throw new Error('Name is required');
  const ch = await backend.insert('channels', {
    name,
    description: input.description?.trim() || null,
    type: input.type,
    created_by: uid,
  });
  const members = [...new Set([uid, ...input.memberIds])];
  if (input.type === 'group') {
    await backend.insertMany(
      'channel_members',
      members.map((user_id) => ({ channel_id: ch.id, user_id, role: user_id === uid ? ('owner' as const) : ('member' as const) })),
    );
  } else {
    // public channel: make sure everyone is a member (local backend does this automatically)
    const existing = await backend.select('channel_members', { eq: { channel_id: ch.id } });
    const missing = members.filter((id) => !existing.some((m) => m.user_id === id));
    if (missing.length) await backend.insertMany('channel_members', missing.map((user_id) => ({ channel_id: ch.id, user_id })));
  }
  return ch;
}

export async function updateChannel(id: string, patch: { name?: string; description?: string | null }) {
  return backend.update('channels', id, {
    ...(patch.name ? { name: patch.name.trim().toLowerCase().replace(/\s+/g, '-') } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
  });
}

export const deleteChannel = (id: string) => backend.remove('channels', id);

export async function setGroupMembers(channelId: string, memberIds: string[], current: { id: string; user_id: string }[]) {
  const toAdd = memberIds.filter((id) => !current.some((m) => m.user_id === id));
  const toRemove = current.filter((m) => !memberIds.includes(m.user_id));
  if (toAdd.length) await backend.insertMany('channel_members', toAdd.map((user_id) => ({ channel_id: channelId, user_id })));
  await Promise.all(toRemove.map((m) => backend.remove('channel_members', m.id)));
}
