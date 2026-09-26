import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Swords } from 'lucide-react';
import { PageHeader } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState, SkeletonRows } from '@/components/ui/States';
import { GlassCard } from '@/components/ui/GlassCard';
import { useLiveTable } from '@/hooks/useLiveTable';
import { useAuth } from '@/store/authStore';
import { TRADE_STATUSES, type TradeIdea, type TradeStatus } from '@/types/db';
import { TradeCard } from '@/features/trades/TradeCard';
import { TradeForm } from '@/features/trades/TradeForm';
import { TradeDetail } from '@/features/trades/TradeDetail';
import { STATUS_META } from '@/features/trades/api';

type Filter = 'active' | 'all' | TradeStatus;

export default function WarRoom() {
  const trades = useLiveTable('trade_ideas', { order: { column: 'updated_at', ascending: false } });
  const reactions = useLiveTable('trade_reactions', {});
  const comments = useLiveTable('trade_comments', {});
  const profiles = useAuth((s) => s.profiles);
  const [params, setParams] = useSearchParams();
  const openId = params.get('trade');
  const [filter, setFilter] = useState<Filter>('active');
  const [who, setWho] = useState<string>('all');
  const [q, setQ] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TradeIdea | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: trades.rows.length, active: 0 };
    for (const t of trades.rows) {
      c[t.status] = (c[t.status] ?? 0) + 1;
      if (['watching', 'planning', 'entered'].includes(t.status)) c.active++;
    }
    return c;
  }, [trades.rows]);

  const list = useMemo(() => {
    const term = q.trim().toUpperCase();
    return trades.rows.filter(
      (t) =>
        (filter === 'all' || (filter === 'active' ? ['watching', 'planning', 'entered'].includes(t.status) : t.status === filter)) &&
        (who === 'all' || t.created_by === who) &&
        (!term || t.symbol.includes(term) || (t.thesis ?? '').toUpperCase().includes(term)),
    );
  }, [trades.rows, filter, who, q]);

  const open = trades.rows.find((t) => t.id === openId) ?? null;
  const commentCount = (id: string) => comments.rows.filter((c) => c.trade_id === id).length;

  return (
    <div>
      <PageHeader
        title="Trade War Room"
        subtitle="Shared trade ideas, debated in realtime. Paper-tracked — not advice, not execution."
        actions={
          <Button
            variant="primary"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            New idea
          </Button>
        }
      />
      <div className="space-y-3 px-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'active', label: 'Active', count: counts.active },
              ...TRADE_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, count: counts[s] ?? 0 })),
              { value: 'all', label: 'All', count: counts.all },
            ]}
          />
          <div className="ml-auto flex w-full gap-2 sm:w-auto">
            <Input className="sm:w-48" placeholder="Filter ticker / thesis…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select className="sm:w-40" value={who} onChange={setWho} options={[{ value: 'all', label: 'Everyone' }, ...profiles.map((p) => ({ value: p.id, label: p.display_name }))]} />
          </div>
        </div>

        {trades.loading ? (
          <SkeletonRows rows={6} />
        ) : trades.error ? (
          <GlassCard>
            <p className="text-sm text-amber-400">{trades.error}</p>
          </GlassCard>
        ) : list.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon={<Swords />}
              title="No ideas here"
              body="Post a trade idea with thesis, catalyst, entry and downside so you can pressure-test it together."
              action={
                <Button size="sm" variant="outline" onClick={() => setFormOpen(true)}>
                  Post the first idea
                </Button>
              }
            />
          </GlassCard>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((t) => (
              <TradeCard key={t.id} trade={t} reactions={reactions.rows} commentCount={commentCount(t.id)} onOpen={() => setParams({ trade: t.id })} />
            ))}
          </div>
        )}
      </div>

      <TradeDetail
        trade={open}
        reactions={reactions.rows}
        onClose={() => setParams({})}
        onEdit={(t) => {
          setEditing(t);
          setFormOpen(true);
        }}
      />
      <TradeForm open={formOpen} onClose={() => setFormOpen(false)} trade={editing} />
    </div>
  );
}
