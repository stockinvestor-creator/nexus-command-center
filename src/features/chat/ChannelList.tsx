import { NavLink, useNavigate } from 'react-router-dom';
import { Hash, Lock, Plus, Search } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { Channel, Profile } from '@/types/db';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/store/authStore';
import { presenceOf, useRealtime } from '@/store/realtimeStore';
import { backend } from '@/services/backend';
import { attempt } from '@/store/toastStore';
import { cn } from '@/lib/cn';

function Row({ to, icon, label, unread, active }: { to: string; icon: ReactNode; label: string; unread: number; active?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition',
          isActive || active ? 'bg-neon-cyan/10 text-white shadow-[inset_2px_0_0_#22d3ee]' : unread ? 'text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
        )
      }
    >
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className={cn('min-w-0 flex-1 truncate', unread > 0 && 'font-semibold')}>{label}</span>
      {unread > 0 && <span className="rounded-full bg-neon-magenta px-1.5 font-mono text-[10px] font-bold text-void">{unread}</span>}
    </NavLink>
  );
}

export function ChannelList({ channels, members, activeId }: { channels: Channel[]; members: { channel_id: string; user_id: string }[]; activeId?: string }) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const unread = useRealtime((s) => s.unread);
  const online = useRealtime((s) => s.online);
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');

  const mine = (c: Channel) => c.type === 'channel' || members.some((m) => m.channel_id === c.id && m.user_id === me);
  const match = (label: string) => !filter || label.toLowerCase().includes(filter.toLowerCase());
  const pub = channels.filter((c) => c.type === 'channel' && match(c.name)).sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name));
  const groups = channels.filter((c) => c.type === 'group' && mine(c) && match(c.name));
  const dms = channels.filter((c) => c.type === 'dm' && mine(c));

  const openDm = async (p: Profile) => {
    const id = await attempt(() => backend.getOrCreateDm(p.id), 'Could not open DM');
    if (id) navigate(`/messages/${id}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Jump to…" className="input h-8 pl-8 text-xs" />
        </div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
        <section>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="label">Channels</span>
            <button onClick={() => navigate('/groups?new=channel')} className="text-slate-500 hover:text-neon-cyan" aria-label="New channel">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {pub.map((c) => (
            <Row key={c.id} to={`/messages/${c.id}`} icon={<Hash className="h-4 w-4" />} label={c.name} unread={unread[c.id] ?? 0} active={c.id === activeId} />
          ))}
        </section>
        <section>
          <div className="mb-1 flex items-center justify-between px-2.5">
            <span className="label">Groups</span>
            <button onClick={() => navigate('/groups?new=group')} className="text-slate-500 hover:text-neon-cyan" aria-label="New group">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {groups.length === 0 && <p className="px-2.5 text-[11px] text-slate-600">No private groups yet.</p>}
          {groups.map((c) => (
            <Row key={c.id} to={`/messages/${c.id}`} icon={<Lock className="h-3.5 w-3.5" />} label={c.name} unread={unread[c.id] ?? 0} active={c.id === activeId} />
          ))}
        </section>
        <section>
          <div className="mb-1 px-2.5">
            <span className="label">Direct messages</span>
          </div>
          {profiles
            .filter((p) => match(p.display_name))
            .map((p) => {
              const key = [me, p.id].sort().join(':');
              const ch = dms.find((c) => c.dm_key === key);
              const isOnline = presenceOf(online, p.id);
              const label = p.id === me ? `${p.display_name} (notes to self)` : p.display_name;
              return ch ? (
                <Row key={p.id} to={`/messages/${ch.id}`} icon={<Avatar profile={p} size={20} online={isOnline} />} label={label} unread={unread[ch.id] ?? 0} active={ch.id === activeId} />
              ) : (
                <button key={p.id} onClick={() => void openDm(p)} className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-sm text-slate-400 transition hover:bg-white/[0.04] hover:text-slate-200">
                  <Avatar profile={p} size={20} online={isOnline} />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
        </section>
      </div>
    </div>
  );
}
