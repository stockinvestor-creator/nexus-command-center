import { useEffect, useMemo, useState } from 'react';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import { safeStorage } from '@/lib/safeStorage';
import { lookupSymbol } from '@/services/market/symbols';
import type { Patch, Watchlist, WatchlistItem } from '@/types/db';
import { toast } from '@/store/toastStore';

const ACTIVE_KEY = 'ncc.activeWatchlist';

// Several components use useMyWatchlist at once; make sure only one auto-creates "Main".
let autoCreate: Promise<unknown> | null = null;

export async function createWatchlist(name: string): Promise<Watchlist> {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  return backend.insert('watchlists', { owner_id: uid, name: name.trim() || 'Main' });
}

export async function addToWatchlist(watchlistId: string, symbol: string, extra: Partial<WatchlistItem> = {}) {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  const sym = symbol.toUpperCase();
  return backend.insert('watchlist_items', {
    watchlist_id: watchlistId,
    owner_id: uid,
    symbol: sym,
    company: extra.company ?? lookupSymbol(sym)?.name ?? null,
    ...extra,
  });
}

export const updateWatchItem = (id: string, patch: Patch<'watchlist_items'>) => backend.update('watchlist_items', id, patch);
export const removeWatchItem = (id: string) => backend.remove('watchlist_items', id);
export const renameWatchlist = (id: string, name: string) => backend.update('watchlists', id, { name });
export const deleteWatchlist = (id: string) => backend.remove('watchlists', id);

/** My watchlists + the active one + its live items. Auto-creates "Main" if none exist. */
export function useMyWatchlist() {
  const uid = useAuth((s) => s.user?.id);
  const lists = useLiveTable(uid ? 'watchlists' : null, { eq: { owner_id: uid ?? '' }, order: { column: 'created_at' } });
  const [activeId, setActiveIdState] = useState<string | null>(() => safeStorage.get<string | null>(ACTIVE_KEY, null));

  useEffect(() => {
    if (!uid || lists.loading || lists.error || lists.rows.length || autoCreate) return;
    autoCreate = backend
      .select('watchlists', { eq: { owner_id: uid } })
      .then(async (existing): Promise<unknown> => (existing.length ? existing : createWatchlist('Main')))
      .catch((e: Error) => toast.error('Could not create watchlist', e.message))
      .finally(() => {
        autoCreate = null;
        void lists.reload();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, lists.loading, lists.error, lists.rows.length]);

  const active = useMemo(
    () => lists.rows.find((l) => l.id === activeId) ?? lists.rows[0] ?? null,
    [lists.rows, activeId],
  );
  const items = useLiveTable(active ? 'watchlist_items' : null, {
    eq: { watchlist_id: active?.id ?? '' },
    order: { column: 'sort_order' },
  });

  const setActiveId = (id: string) => {
    safeStorage.set(ACTIVE_KEY, id);
    setActiveIdState(id);
  };

  return { lists, active, items, setActiveId };
}

/** Star toggle helper used by charts & stock pages */
export function useWatchToggle(symbol: string) {
  const { active, items } = useMyWatchlist();
  const item = items.rows.find((i) => i.symbol === symbol.toUpperCase());
  const toggle = async () => {
    if (!active) return toast.warning('Watchlist not ready yet');
    try {
      if (item) {
        await removeWatchItem(item.id);
        items.mutate((r) => r.filter((x) => x.id !== item.id));
        toast.info(`Removed $${symbol} from ${active.name}`);
      } else {
        const row = await addToWatchlist(active.id, symbol, { sort_order: items.rows.length });
        items.mutate((r) => (r.some((x) => x.id === row.id) ? r : [...r, row]));
        toast.success(`Added $${symbol} to ${active.name}`);
      }
    } catch (e) {
      toast.error('Watchlist update failed', (e as Error).message);
    }
  };
  return { item, toggle, active, loading: items.loading };
}
