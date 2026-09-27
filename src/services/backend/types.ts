import type { Insert, Patch, Row, TableName } from '@/types/db';

export type RpcName = 'sim_open_position' | 'sim_apply_transaction';

export interface QueryOptions<K extends TableName> {
  eq?: Partial<Row<K>>;
  in?: { column: keyof Row<K> & string; values: (string | number)[] };
  /** SQL ILIKE pattern, e.g. `%$NVDA%` */
  ilike?: { column: keyof Row<K> & string; pattern: string };
  gte?: { column: keyof Row<K> & string; value: string | number };
  order?: { column: keyof Row<K> & string; ascending?: boolean };
  limit?: number;
}

export interface ChangeEvent<T> {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  new: T | null;
  old: Partial<T> | null;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface PresenceUser {
  id: string;
  name: string;
  color: string;
  online_at: string;
  /** "away" after inactivity / hidden tab. Presence only — never stored in the database. */
  status?: 'active' | 'away';
}

export interface TypingEvent {
  userId: string;
  name: string;
  channelId: string;
}

export interface RealtimeRoom {
  onPresence(cb: (users: PresenceUser[]) => void): () => void;
  onTyping(cb: (e: TypingEvent) => void): () => void;
  sendTyping(channelId: string): void;
  setStatus(status: 'active' | 'away'): void;
  leave(): void;
}

/**
 * Data backend used by every feature. Two implementations:
 *  - SupabaseBackend: production (Auth + Postgres + Realtime + Storage, all free tier)
 *  - LocalBackend: zero-config Demo Mode (localStorage + BroadcastChannel across tabs)
 */
export interface Backend {
  readonly mode: 'supabase' | 'local';

  getUser(): Promise<AuthUser | null>;
  onAuthChange(cb: (u: AuthUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;

  select<K extends TableName>(table: K, opts?: QueryOptions<K>): Promise<Row<K>[]>;
  insert<K extends TableName>(table: K, values: Insert<K>): Promise<Row<K>>;
  insertMany<K extends TableName>(table: K, values: Insert<K>[]): Promise<Row<K>[]>;
  update<K extends TableName>(table: K, id: string, patch: Patch<K>): Promise<Row<K>>;
  upsert<K extends TableName>(table: K, values: Insert<K>, onConflict: (keyof Row<K> & string)[]): Promise<Row<K>>;
  remove<K extends TableName>(table: K, id: string): Promise<void>;
  subscribe<K extends TableName>(
    table: K,
    cb: (e: ChangeEvent<Row<K>>) => void,
    filter?: { column: keyof Row<K> & string; value: string },
  ): () => void;

  /** Call a Postgres function (RPC). LocalBackend emulates the ones NEXUS uses. */
  rpc<T = unknown>(fn: RpcName, args: Record<string, unknown>): Promise<T>;

  unreadCounts(): Promise<Record<string, number>>;
  getOrCreateDm(otherUserId: string): Promise<string>;
  uploadImage(file: File, userId: string): Promise<string>;
  imageUrl(path: string): Promise<string>;
  joinRoom(me: PresenceUser): RealtimeRoom;
}
