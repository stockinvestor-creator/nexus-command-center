import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { Insert, Patch, Row, TableName } from '@/types/db';
import { uid } from '@/lib/id';
import { useConnection } from '@/store/connectionStore';
import type { AuthUser, Backend, ChangeEvent, PresenceUser, QueryOptions, RealtimeRoom, RpcName, TypingEvent } from './types';

const mapUser = (u: User | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;
  private signedUrls = new Map<string, { url: string; exp: number }>();

  constructor(private readonly sb: SupabaseClient) {
    window.addEventListener('offline', () => useConnection.getState().setStatus('offline'));
    window.addEventListener('online', () => useConnection.getState().setStatus('connecting'));
  }

  /* ───── auth ───── */
  async getUser() {
    const { data } = await this.sb.auth.getSession();
    return mapUser(data.session?.user);
  }
  onAuthChange(cb: (u: AuthUser | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_evt, session) => cb(mapUser(session?.user)));
    return () => data.subscription.unsubscribe();
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Invalid email or password.' : error.message);
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async sendPasswordReset(email: string) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/settings`,
    });
    fail(error);
  }
  async updatePassword(password: string) {
    const { error } = await this.sb.auth.updateUser({ password });
    fail(error);
  }

  /* ───── data ───── */
  async select<K extends TableName>(table: K, opts: QueryOptions<K> = {}): Promise<Row<K>[]> {
    let q = this.sb.from(table as string).select('*');
    if (opts.eq) {
      for (const [k, v] of Object.entries(opts.eq)) q = v === null ? q.is(k, null) : q.eq(k, v as string);
    }
    if (opts.in) q = q.in(opts.in.column as string, opts.in.values);
    if (opts.ilike) q = q.ilike(opts.ilike.column as string, opts.ilike.pattern);
    if (opts.gte) q = q.gte(opts.gte.column as string, opts.gte.value);
    const ordered = opts.order ? q.order(opts.order.column, { ascending: opts.order.ascending ?? true }) : q;
    const limited = opts.limit ? ordered.limit(opts.limit) : ordered;
    const { data, error } = await limited;
    fail(error);
    return (data ?? []) as Row<K>[];
  }

  async rpc<T = unknown>(fn: RpcName, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args);
    fail(error);
    return data as T;
  }

  async insert<K extends TableName>(table: K, values: Insert<K>): Promise<Row<K>> {
    const { data, error } = await this.sb.from(table).insert(values as Record<string, unknown>).select('*').single();
    fail(error);
    return data as Row<K>;
  }

  async insertMany<K extends TableName>(table: K, values: Insert<K>[]): Promise<Row<K>[]> {
    if (values.length === 0) return [];
    const { data, error } = await this.sb.from(table).insert(values as Record<string, unknown>[]).select('*');
    fail(error);
    return (data ?? []) as Row<K>[];
  }

  async update<K extends TableName>(table: K, id: string, patch: Patch<K>): Promise<Row<K>> {
    const { data, error } = await this.sb.from(table).update(patch as Record<string, unknown>).eq('id', id).select('*').single();
    fail(error);
    return data as Row<K>;
  }

  async upsert<K extends TableName>(table: K, values: Insert<K>, onConflict: (keyof Row<K> & string)[]): Promise<Row<K>> {
    const { data, error } = await this.sb
      .from(table)
      .upsert(values as Record<string, unknown>, { onConflict: onConflict.join(',') })
      .select('*')
      .single();
    fail(error);
    return data as Row<K>;
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const { error } = await this.sb.from(table).delete().eq('id', id);
    fail(error);
  }

  subscribe<K extends TableName>(
    table: K,
    cb: (e: ChangeEvent<Row<K>>) => void,
    filter?: { column: keyof Row<K> & string; value: string },
  ) {
    const channel = this.sb
      .channel(`db:${table}:${filter ? `${filter.column}=${filter.value}` : 'all'}:${uid().slice(0, 8)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter: `${filter.column}=eq.${filter.value}` } : {}),
        },
        (payload) => {
          const hasNew = payload.new && Object.keys(payload.new).length > 0;
          const hasOld = payload.old && Object.keys(payload.old).length > 0;
          cb({
            type: payload.eventType,
            new: hasNew ? (payload.new as Row<K>) : null,
            old: hasOld ? (payload.old as Partial<Row<K>>) : null,
          });
        },
      )
      .subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }

  /* ───── special ───── */
  async unreadCounts(): Promise<Record<string, number>> {
    const { data, error } = await this.sb.rpc('unread_counts');
    fail(error);
    const out: Record<string, number> = {};
    for (const r of (data ?? []) as { channel_id: string; unread: number }[]) out[r.channel_id] = Number(r.unread);
    return out;
  }

  async getOrCreateDm(otherUserId: string): Promise<string> {
    const { data, error } = await this.sb.rpc('get_or_create_dm', { other: otherUserId });
    fail(error);
    return data as string;
  }

  async uploadImage(file: File, userId: string): Promise<string> {
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${userId}/${uid()}.${ext}`;
    const { error } = await this.sb.storage.from('attachments').upload(path, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: '31536000',
    });
    fail(error);
    return path;
  }

  async imageUrl(path: string): Promise<string> {
    const hit = this.signedUrls.get(path);
    if (hit && hit.exp > Date.now()) return hit.url;
    const { data, error } = await this.sb.storage.from('attachments').createSignedUrl(path, 3600);
    fail(error);
    const url = data?.signedUrl ?? '';
    this.signedUrls.set(path, { url, exp: Date.now() + 50 * 60_000 });
    return url;
  }

  joinRoom(me: PresenceUser): RealtimeRoom {
    const presenceCbs = new Set<(u: PresenceUser[]) => void>();
    const typingCbs = new Set<(e: TypingEvent) => void>();
    const setStatus = useConnection.getState().setStatus;
    setStatus('connecting');

    const ch = this.sb.channel('room:workspace', {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    });
    const users = () => {
      const state = ch.presenceState<PresenceUser>();
      const seen = new Map<string, PresenceUser>();
      for (const list of Object.values(state)) for (const p of list) seen.set(p.id, p);
      return [...seen.values()];
    };
    ch.on('presence', { event: 'sync' }, () => {
      const list = users();
      presenceCbs.forEach((cb) => cb(list));
    });
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      typingCbs.forEach((cb) => cb(payload as TypingEvent));
    });
    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setStatus('online');
        await ch.track(me);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setStatus(navigator.onLine ? 'connecting' : 'offline');
      }
    });

    let lastTyping = 0;
    return {
      onPresence: (cb) => {
        presenceCbs.add(cb);
        cb(users());
        return () => presenceCbs.delete(cb);
      },
      onTyping: (cb) => {
        typingCbs.add(cb);
        return () => typingCbs.delete(cb);
      },
      sendTyping: (channelId) => {
        if (Date.now() - lastTyping < 2500) return; // throttle
        lastTyping = Date.now();
        void ch.send({ type: 'broadcast', event: 'typing', payload: { userId: me.id, name: me.name, channelId } });
      },
      setStatus: (status) => {
        if (me.status === status) return;
        me.status = status;
        void ch.track(me);
      },
      leave: () => {
        void ch.untrack();
        void this.sb.removeChannel(ch);
      },
    };
  }
}
