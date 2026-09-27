import { useMemo } from 'react';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';

/**
 * My tickers for every intel feature: open simulated positions first, then favorites, then every
 * symbol on any of my watchlists (max 25 — keeps free API budgets predictable).
 */
export function useMyTickers() {
  const uid = useAuth((s) => s.user?.id);
  const items = useLiveTable(uid ? 'watchlist_items' : null, { eq: { owner_id: uid ?? '' }, order: { column: 'sort_order' } });
  const positions = useLiveTable(uid ? 'sim_positions' : null, { eq: { owner_id: uid ?? '', status: 'open' } });
  const tickers = useMemo(() => {
    const fav = items.rows.filter((i) => i.favorite).map((i) => i.symbol);
    return [...new Set([...positions.rows.map((p) => p.symbol), ...fav, ...items.rows.map((i) => i.symbol)].map((s) => s.toUpperCase()))].slice(0, 25);
  }, [items.rows, positions.rows]);
  return { tickers, watchlist: items.rows, positions: positions.rows, loading: !uid || items.loading || positions.loading };
}
