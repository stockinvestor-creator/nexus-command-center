import { useCallback, useEffect, useRef, useState } from 'react';
import { backend, type QueryOptions } from '@/services/backend';
import type { Row, TableName } from '@/types/db';

export interface LiveTable<T> {
  rows: T[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Optimistically apply a local change (realtime will confirm) */
  mutate: (fn: (rows: T[]) => T[]) => void;
}

function sortRows<K extends TableName>(rows: Row<K>[], order?: QueryOptions<K>['order']): Row<K>[] {
  if (!order) return rows;
  const dir = order.ascending === false ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[order.column] as string | number | null;
    const bv = (b as unknown as Record<string, unknown>)[order.column] as string | number | null;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av < bv ? -dir : av > bv ? dir : 0;
  });
}

function matchesEq<K extends TableName>(row: Row<K>, opts: QueryOptions<K>): boolean {
  const r = row as unknown as Record<string, unknown>;
  if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) if (r[k] !== v) return false;
  if (opts.in && !opts.in.values.includes(r[opts.in.column] as string)) return false;
  return true;
}

/**
 * Loads rows from a table and keeps them in sync with realtime INSERT/UPDATE/DELETE events.
 * Pass `null` as table to disable (e.g. while an id is unknown).
 */
export function useLiveTable<K extends TableName>(table: K | null, opts: QueryOptions<K> = {}): LiveTable<Row<K>> {
  const [rows, setRows] = useState<Row<K>[]>([]);
  const [loading, setLoading] = useState(Boolean(table));
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const reload = useCallback(async () => {
    if (!table) return;
    try {
      setError(null);
      const data = await backend.select(table, optsRef.current);
      setRows(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);

  useEffect(() => {
    if (!table) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void reload();
    const o = optsRef.current;
    const eqEntries = Object.entries(o.eq ?? {}).filter(([, v]) => typeof v === 'string');
    const filter = eqEntries.length
      ? { column: eqEntries[0][0] as keyof Row<K> & string, value: eqEntries[0][1] as string }
      : undefined;
    const off = backend.subscribe(
      table,
      (e) => {
        setRows((prev) => {
          if (e.type === 'DELETE') {
            const id = (e.old as { id?: string } | null)?.id;
            return id ? prev.filter((r) => (r as unknown as { id: string }).id !== id) : prev;
          }
          const row = e.new;
          if (!row) return prev;
          const id = (row as unknown as { id: string }).id;
          const without = prev.filter((r) => (r as unknown as { id: string }).id !== id);
          if (!matchesEq(row, o)) return without;
          if (o.ilike || o.gte) {
            // complex filters: re-query instead of guessing
            void reload();
            return prev;
          }
          const next = sortRows([...without, row], o.order);
          return o.limit && o.order?.ascending === false ? next.slice(0, o.limit) : next;
        });
      },
      filter,
    );
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key]);

  const mutate = useCallback((fn: (rows: Row<K>[]) => Row<K>[]) => setRows((r) => fn(r)), []);

  return { rows, loading, error, reload, mutate };
}
