import { useMemo } from 'react';
import { backend } from '@/services/backend';
import { useAuth } from '@/store/authStore';
import { useLiveTable } from '@/hooks/useLiveTable';
import type { EventAnnotation, UserPriority } from '@/types/db';
import type { IntelEvent } from '@/types/intel';

/** Minimal snapshot stored with an annotation (never article bodies). */
export const eventSnapshot = (e: IntelEvent) => ({
  id: e.id,
  title: e.title,
  source: e.source,
  publisher: e.publisher ?? null,
  url: e.url,
  at: e.at,
  atPrecision: e.atPrecision,
  tickers: e.tickers,
  form: e.form ?? null,
  categories: e.classifications.map((c) => c.label),
});

export function useAnnotations() {
  const t = useLiveTable('event_annotations', { order: { column: 'updated_at', ascending: false } });
  const byKey = useMemo(() => new Map(t.rows.map((a) => [a.event_key, a])), [t.rows]);
  return { ...t, byKey };
}

export async function annotate(e: IntelEvent, patch: { priority?: UserPriority | null; note?: string | null; bookmarked?: boolean }): Promise<EventAnnotation> {
  const uid = useAuth.getState().user?.id;
  if (!uid) throw new Error('Not signed in');
  return backend.upsert('event_annotations', { event_key: e.id, event: eventSnapshot(e), ...patch, updated_by: uid }, ['event_key']);
}
