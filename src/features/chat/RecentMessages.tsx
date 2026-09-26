import { Link } from 'react-router-dom';
import { ClickRow } from '@/components/ui/ClickRow';
import { MessagesSquare } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { Avatar } from '@/components/ui/Avatar';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { timeAgo } from '@/lib/format';
import { MessageContent } from './MessageContent';
import { channelLabel } from './api';

export function RecentMessages({ className }: { className?: string }) {
  const messages = useLiveTable('messages', { order: { column: 'created_at', ascending: false }, limit: 8 });
  const channels = useLiveTable('channels', {});
  const profiles = useAuth((s) => s.profiles);
  const me = useAuth((s) => s.user?.id);
  return (
    <GlassCard
      collapseId="recent-msgs"
      className={className}
      title="Recent Messages"
      icon={<MessagesSquare />}
      actions={
        <Link to="/messages" className="text-[11px] text-neon-cyan hover:underline">
          Open chat
        </Link>
      }
    >
      {messages.loading ? (
        <SkeletonRows rows={5} />
      ) : messages.rows.length === 0 ? (
        <EmptyState icon={<MessagesSquare />} title="No messages yet" />
      ) : (
        <ul className="space-y-1">
          {messages.rows.map((m) => {
            const author = profiles.find((p) => p.id === m.user_id);
            const ch = channels.rows.find((c) => c.id === m.channel_id);
            return (
              <li key={m.id}>
                <ClickRow to={`/messages/${m.channel_id}`} className="flex gap-2.5 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]">
                  <Avatar profile={author} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 text-[11px]">
                      <span className="font-medium text-slate-200">{author?.display_name ?? 'Unknown'}</span>
                      {ch && <span className="text-slate-500">{ch.type === 'dm' ? '@' : '#'}{channelLabel(ch, profiles, me)}</span>}
                      <span className="ml-auto font-mono text-[10px] text-slate-600">{timeAgo(m.created_at)}</span>
                    </div>
                    <p className="line-clamp-2 text-xs text-slate-400">
                      {m.kind === 'stock_share' && m.metadata.stock ? `📈 Shared $${m.metadata.stock.symbol} ` : m.kind === 'image' ? '📷 ' : ''}
                      <MessageContent text={m.content} />
                    </p>
                  </div>
                </ClickRow>
              </li>
            );
          })}
        </ul>
      )}
    </GlassCard>
  );
}
