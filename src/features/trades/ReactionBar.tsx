import { TRADE_REACTIONS, type TradeReaction } from '@/types/db';
import { useAuth } from '@/store/authStore';
import { cn } from '@/lib/cn';
import { attempt } from '@/store/toastStore';
import { toggleTradeReaction } from './api';

export function ReactionBar({ tradeId, reactions, compact }: { tradeId: string; reactions: TradeReaction[]; compact?: boolean }) {
  const me = useAuth((s) => s.user?.id);
  const profiles = useAuth((s) => s.profiles);
  const mine = reactions.filter((r) => r.trade_id === tradeId);
  return (
    <div className="flex items-center gap-1">
      {TRADE_REACTIONS.map((e) => {
        const list = mine.filter((r) => r.emoji === e);
        const active = list.some((r) => r.user_id === me);
        if (compact && list.length === 0) return null;
        return (
          <button
            key={e}
            title={list.map((r) => profiles.find((p) => p.id === r.user_id)?.display_name).join(', ') || 'React'}
            onClick={() => void attempt(() => toggleTradeReaction(tradeId, e, reactions))}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-1.5 py-0.5 text-xs transition active:scale-90',
              active ? 'border-neon-cyan/40 bg-neon-cyan/10' : 'border-white/5 bg-white/[0.02] hover:border-white/15',
            )}
          >
            <span>{e}</span>
            {list.length > 0 && <span className="font-mono text-[10px] text-slate-400">{list.length}</span>}
          </button>
        );
      })}
    </div>
  );
}
