import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import { invalidateMarketQueries } from '@/hooks/useMarketQuery';
import { useMyTickers } from '@/features/intel/useMyTickers';
import { useAnnotations } from '@/features/intel/annotations';
import { safeStorage } from '@/lib/safeStorage';
import { isoDay } from '@/lib/format';
import { toast } from '@/store/toastStore';
import type { BriefingRow } from '@/types/db';
import { buildBriefing, REFRESH_COOLDOWN_MS, type BriefingKind, type BriefingSnapshot } from './build';

const LAST_KEY = 'ncc.briefing.lastRefresh';

export const snapshotOf = (r: BriefingRow | undefined | null) => (r?.snapshot && (r.snapshot as BriefingSnapshot).version === 1 ? (r.snapshot as BriefingSnapshot) : null);

/** Read-only: my briefings, newest first (used by widgets and history). */
export function useMyBriefings(kind: BriefingKind = 'morning') {
  const uid = useAuth((s) => s.user?.id);
  const rows = useLiveTable(uid ? 'briefings' : null, { eq: { user_id: uid ?? '', kind }, order: { column: 'briefing_date', ascending: false } });
  const today = isoDay(0);
  return { ...rows, today: rows.rows.find((r) => r.briefing_date === today) ?? null };
}

/** Generator + storage. Auto-creates today's briefing on first visit; REFRESH is rate-limited. */
export function useBriefingEngine(kind: BriefingKind = 'morning', autoGenerate = true) {
  const uid = useAuth((s) => s.user?.id);
  const stored = useMyBriefings(kind);
  const my = useMyTickers();
  const predictions = useLiveTable('predictions', {});
  const catalysts = useLiveTable('catalysts', {});
  const allPositions = useLiveTable(uid ? 'sim_positions' : null, { eq: { owner_id: uid ?? '' } });
  const { rows: annotations, loading: annLoading } = useAnnotations();
  const [busy, setBusy] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(() => safeStorage.get<number>(LAST_KEY, 0));
  const started = useRef(false);

  const ready = !stored.loading && !my.loading && !predictions.loading && !catalysts.loading && !allPositions.loading && !annLoading;

  const generate = useCallback(
    async (force: boolean) => {
      if (!uid) return;
      setBusy(true);
      try {
        const today = isoDay(0);
        const previous = stored.rows.find((r) => r.briefing_date < today) ?? null;
        const snap = await buildBriefing({
          kind,
          tickers: my.tickers,
          watchlist: my.watchlist,
          positions: allPositions.rows,
          predictions: predictions.rows,
          catalysts: catalysts.rows,
          annotations,
          previous: snapshotOf(previous),
          force,
        });
        await backend.upsert(
          'briefings',
          { user_id: uid, briefing_date: snap.date, kind, generated_at: snap.generatedAt, data_refreshed_at: snap.dataRefreshedAt, sources: snap.sources, snapshot: snap },
          ['user_id', 'briefing_date', 'kind'],
        );
        if (force) invalidateMarketQueries();
      } catch (e) {
        toast.error('Briefing could not be generated', (e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [uid, kind, stored.rows, my.tickers, my.watchlist, allPositions.rows, predictions.rows, catalysts.rows, annotations],
  );

  useEffect(() => {
    if (!autoGenerate || !ready || started.current || stored.today) return;
    started.current = true;
    void generate(false);
  }, [autoGenerate, ready, stored.today, generate]);

  const cooldownLeft = Math.max(0, lastRefresh + REFRESH_COOLDOWN_MS - Date.now());
  const refresh = useCallback(async () => {
    if (Date.now() - lastRefresh < REFRESH_COOLDOWN_MS) {
      toast.warning('Refresh rate-limited', 'Briefings refresh at most every 5 minutes to protect free API quotas.');
      return;
    }
    const t = Date.now();
    safeStorage.set(LAST_KEY, t);
    setLastRefresh(t);
    await generate(true);
  }, [generate, lastRefresh]);

  return useMemo(() => ({ stored, ready, busy, refresh, cooldownLeft, tickers: my.tickers, generate }), [stored, ready, busy, refresh, cooldownLeft, my.tickers, generate]);
}
