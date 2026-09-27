import type { Insert, Patch, Row, TableName, Tables } from '@/types/db';
import { uid } from '@/lib/id';
import { safeSession, safeStorage } from '@/lib/safeStorage';
import { useConnection } from '@/store/connectionStore';
import { DEMO_USERS, seedLocalDb, type LocalDB } from './localSeed';
import type { AuthUser, Backend, ChangeEvent, PresenceUser, QueryOptions, RealtimeRoom, RpcName, TypingEvent } from './types';

const DB_KEY = 'ncc.demo.db.v1';
const AS_KEY = 'ncc.demo.as';
const OUT_KEY = 'ncc.demo.signedOut';

type AnyRow = Record<string, unknown> & { id: string };
type Listener = (e: ChangeEvent<AnyRow>) => void;

/** Column defaults mirroring schema.sql */
const DEFAULTS: { [K in TableName]?: () => Partial<Tables[K]> } = {
  profiles: () => ({ display_name: 'Operator', avatar_color: '#22d3ee', avatar_url: null, status_text: null }),
  channels: () => ({ slug: null, description: null, dm_key: null, is_default: false, created_by: null }),
  channel_members: () => ({ role: 'member', last_read_at: new Date().toISOString() }),
  messages: () => ({ kind: 'text', metadata: {}, reply_to: null, pinned: false, attachment_path: null, edited_at: null }),
  watchlist_items: () => ({
    company: null, favorite: false, notes: null, thesis: null, category: 'Long Watch',
    risk_level: 'medium', catalyst_date: null, direction: 'watch', sort_order: 0,
  }),
  trade_ideas: () => ({
    entry: null, position_size: null, thesis: null, catalyst: null, target: null, downside: null, stop: null,
    expected_move: null, probability: null, catalyst_date: null, time_horizon: null, status: 'watching', exit_price: null,
  }),
  trade_events: () => ({ detail: {} }),
  catalysts: () => ({
    company: null, source_url: null, announced_at: null, catalyst_date: null, expected_impact: 'medium',
    bias: 'uncertain', notes: null, confidence: 50, expected_move: null, status: 'upcoming',
  }),
  notifications: () => ({ actor_id: null, body: null, link: null, read_at: null }),
  ticker_notes: () => ({ thesis: null, catalyst_score: null, momentum_score: null, volatility_score: null, risk_score: null, updated_by: null }),
  price_alerts: () => ({ active: true, triggered_at: null }),
  sim_accounts: () => ({ starting_cash: 100000 }),
  sim_positions: () => ({
    status: 'open', shares: 0, entry_date: new Date().toISOString().slice(0, 10), opened_at: new Date().toISOString(), closed_at: null,
    target: null, stop: null, thesis: null, catalyst: null, notes: null, realized_pnl: 0, closed_qty: 0, closed_value: 0,
    trade_idea_id: null, mistakes: null, lessons: null, result_notes: null, screenshots: [],
  }),
  sim_transactions: () => ({ realized_pnl: 0, executed_at: new Date().toISOString(), note: null }),
  research_notes: () => ({ content: '', updated_by: null }),
  research_note_history: () => ({ edited_by: null }),
  event_annotations: () => ({ event: {}, priority: null, note: null, bookmarked: false, updated_by: null }),
  notification_prefs: () => ({ prefs: {} }),
  briefings: () => ({ kind: 'morning', generated_at: new Date().toISOString(), data_refreshed_at: null, sources: [], snapshot: {} }),
  predictions: () => ({
    symbol: null, prediction_type: 'direction', expected_move: null, target_price: null, downside_price: null, time_horizon: null,
    catalyst: null, prediction_date: new Date().toISOString().slice(0, 10), resolution_date: null, thesis: null, invalidation: null,
    notes: null, baseline_price: null, baseline_source: null, baseline_at: null, status: 'open', actual_outcome: null, actual_move: null,
    actual_price: null, actual_price_source: null, resolved_at: null, resolved_by: null, result_notes: null, lesson: null,
  }),
  prediction_history: () => ({ changed_at: new Date().toISOString(), old_values: null, new_values: null, changed_by: null }),
  prediction_links: () => ({ label: null, url: null, created_by: null }),
};

/* Mirrors the SQL triggers on predictions (supabase/migrations/20260927_intelligence_release.sql). */
const P_CORE = ['symbol', 'title', 'prediction_type', 'direction', 'expected_move', 'target_price', 'downside_price', 'time_horizon', 'catalyst', 'prediction_date', 'resolution_date', 'confidence', 'thesis', 'invalidation'];
const P_RES = ['status', 'actual_outcome', 'actual_move', 'actual_price', 'actual_price_source', 'resolved_at'];
const P_NOTE = ['result_notes', 'lesson', 'notes'];
const P_IMMUTABLE = ['created_at', 'created_by', 'baseline_price', 'baseline_at', 'baseline_source'];

const UNIQUE: { [K in TableName]?: string[][] } = {
  channel_members: [['channel_id', 'user_id']],
  message_reactions: [['message_id', 'user_id', 'emoji']],
  trade_reactions: [['trade_id', 'user_id', 'emoji']],
  watchlist_items: [['watchlist_id', 'symbol']],
  ticker_notes: [['symbol']],
  channels: [['slug'], ['dm_key']],
  sim_accounts: [['user_id']],
  research_notes: [['symbol', 'section']],
  event_annotations: [['event_key']],
  notification_prefs: [['user_id']],
  briefings: [['user_id', 'briefing_date', 'kind']],
};

const HAS_UPDATED_AT = new Set<TableName>([
  'profiles', 'channels', 'channel_members', 'messages', 'watchlists', 'watchlist_items',
  'trade_ideas', 'trade_comments', 'catalysts', 'ticker_notes', 'price_alerts',
  'sim_accounts', 'sim_positions', 'research_notes', 'event_annotations', 'notification_prefs', 'briefings', 'predictions',
]);

function likeToRegex(pattern: string): RegExp {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'is');
}

function matches<K extends TableName>(row: Row<K>, opts: QueryOptions<K>): boolean {
  const r = row as unknown as Record<string, unknown>;
  if (opts.eq) for (const [k, v] of Object.entries(opts.eq)) if (r[k] !== v) return false;
  if (opts.in && !opts.in.values.includes(r[opts.in.column] as string)) return false;
  if (opts.ilike && !likeToRegex(opts.ilike.pattern).test(String(r[opts.ilike.column] ?? ''))) return false;
  if (opts.gte && !((r[opts.gte.column] as string | number) >= opts.gte.value)) return false;
  return true;
}

/**
 * Demo Mode backend. Stores the workspace in localStorage and syncs every change to other
 * open tabs via BroadcastChannel, so two tabs behave like two realtime-connected users.
 */
export class LocalBackend implements Backend {
  readonly mode = 'local' as const;
  private db: LocalDB;
  private listeners = new Map<TableName, Set<Listener>>();
  private authListeners = new Set<(u: AuthUser | null) => void>();
  private bc: BroadcastChannel | null = null;

  constructor() {
    this.db = this.load();
    useConnection.getState().setStatus('demo');
    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel('ncc-demo-db');
      this.bc.onmessage = (ev: MessageEvent<{ table: TableName; event: ChangeEvent<AnyRow> }>) => {
        this.db = this.load();
        this.emit(ev.data.table, ev.data.event, false);
      };
    }
  }

  private load(): LocalDB {
    const stored = safeStorage.get<LocalDB | null>(DB_KEY, null);
    if (stored && stored.profiles) {
      // forward-compat: add tables that didn't exist in older saved demo DBs
      const seed = seedLocalDb();
      for (const k of Object.keys(seed) as TableName[]) if (!stored[k]) (stored as Record<string, unknown>)[k] = [];
      return stored;
    }
    const seeded = seedLocalDb();
    safeStorage.set(DB_KEY, seeded);
    return seeded;
  }

  private warned = false;
  private persist() {
    // If browser storage is unavailable or full, keep working in memory for this session.
    if (!safeStorage.set(DB_KEY, this.db) && !this.warned) {
      this.warned = true;
      console.warn('Demo data could not be saved to browser storage; changes will last until you close this tab.');
    }
  }

  private emit(table: TableName, event: ChangeEvent<AnyRow>, broadcast = true) {
    this.listeners.get(table)?.forEach((l) => l(event));
    if (broadcast) this.bc?.postMessage({ table, event });
  }

  private rows<K extends TableName>(table: K): Row<K>[] {
    return this.db[table] as Row<K>[];
  }

  private checkUnique<K extends TableName>(table: K, row: Row<K>, ignoreId?: string) {
    const r = row as unknown as Record<string, unknown>;
    for (const cols of UNIQUE[table] ?? []) {
      if (cols.some((c) => r[c] == null)) continue;
      const dup = this.rows(table).find(
        (x) => (x as unknown as AnyRow).id !== ignoreId && cols.every((c) => (x as unknown as Record<string, unknown>)[c] === r[c]),
      );
      if (dup) throw new Error(`duplicate key value violates unique constraint (${cols.join(', ')})`);
    }
  }

  static resetDemoData() {
    safeStorage.remove(DB_KEY);
  }

  /* ───── auth (demo identities) ───── */
  private currentUser(): AuthUser | null {
    if (safeSession.get(OUT_KEY) === '1') return null;
    const as = safeSession.get(AS_KEY) ?? DEMO_USERS[0].id;
    const u = DEMO_USERS.find((d) => d.id === as) ?? DEMO_USERS[0];
    return { id: u.id, email: u.email };
  }
  async getUser() {
    return this.currentUser();
  }
  onAuthChange(cb: (u: AuthUser | null) => void) {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }
  private notifyAuth() {
    const u = this.currentUser();
    this.authListeners.forEach((cb) => cb(u));
  }
  async signIn(email: string) {
    const match = DEMO_USERS.find((d) => d.email === email.trim().toLowerCase());
    safeSession.set(AS_KEY, match?.id ?? DEMO_USERS[0].id);
    safeSession.set(OUT_KEY, '0');
    this.notifyAuth();
  }
  async signOut() {
    safeSession.set(OUT_KEY, '1');
    this.notifyAuth();
  }
  /** Demo only: act as the other operator in this tab */
  switchIdentity(userId: string) {
    safeSession.set(AS_KEY, userId);
    safeSession.set(OUT_KEY, '0');
    this.notifyAuth();
  }
  async sendPasswordReset() {
    throw new Error('Password reset is not available in Demo Mode.');
  }
  async updatePassword() {
    throw new Error('Passwords are not used in Demo Mode.');
  }

  /* ───── data ───── */
  async select<K extends TableName>(table: K, opts: QueryOptions<K> = {}): Promise<Row<K>[]> {
    let out = this.rows(table).filter((r) => matches(r, opts));
    if (opts.order) {
      const col = opts.order.column;
      const dir = opts.order.ascending === false ? -1 : 1;
      out = [...out].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[col] as string | number | null;
        const bv = (b as unknown as Record<string, unknown>)[col] as string | number | null;
        if (av == null) return 1;
        if (bv == null) return -1;
        return av < bv ? -dir : av > bv ? dir : 0;
      });
    }
    if (opts.limit) out = out.slice(0, opts.limit);
    return structuredClone(out);
  }

  private build<K extends TableName>(table: K, values: Insert<K>): Row<K> {
    const now = new Date().toISOString();
    const base: Record<string, unknown> = { id: uid(), created_at: now };
    if (HAS_UPDATED_AT.has(table)) base.updated_at = now;
    const defaults = (DEFAULTS[table]?.() ?? {}) as Record<string, unknown>;
    return { ...base, ...defaults, ...(values as Record<string, unknown>) } as unknown as Row<K>;
  }

  async insert<K extends TableName>(table: K, values: Insert<K>): Promise<Row<K>> {
    const row = this.build(table, values);
    this.checkUnique(table, row);
    this.rows(table).push(row);
    this.persist();
    this.emit(table, { type: 'INSERT', new: row as unknown as AnyRow, old: null });
    this.afterInsert(table, row);
    return structuredClone(row);
  }

  async insertMany<K extends TableName>(table: K, values: Insert<K>[]): Promise<Row<K>[]> {
    const out: Row<K>[] = [];
    for (const v of values) out.push(await this.insert(table, v));
    return out;
  }

  async update<K extends TableName>(table: K, id: string, patch: Patch<K>): Promise<Row<K>> {
    const list = this.rows(table);
    const idx = list.findIndex((r) => (r as unknown as AnyRow).id === id);
    if (idx < 0) throw new Error('Row not found');
    const old = list[idx];
    const next = { ...old, ...patch } as Row<K>;
    if (HAS_UPDATED_AT.has(table)) (next as unknown as Record<string, unknown>).updated_at = new Date().toISOString();
    if (table === 'predictions') this.guardPrediction(old as unknown as Record<string, unknown>, next as unknown as Record<string, unknown>);
    this.checkUnique(table, next, id);
    list[idx] = next;
    this.persist();
    this.emit(table, { type: 'UPDATE', new: next as unknown as AnyRow, old: old as unknown as AnyRow });
    this.afterUpdate(table, old, next);
    return structuredClone(next);
  }

  async upsert<K extends TableName>(table: K, values: Insert<K>, onConflict: (keyof Row<K> & string)[]): Promise<Row<K>> {
    const v = values as unknown as Record<string, unknown>;
    const existing = this.rows(table).find((r) =>
      onConflict.every((c) => (r as unknown as Record<string, unknown>)[c] === v[c]),
    );
    if (existing) return this.update(table, (existing as unknown as AnyRow).id, values as unknown as Patch<K>);
    return this.insert(table, values);
  }

  async remove<K extends TableName>(table: K, id: string): Promise<void> {
    const list = this.rows(table);
    const idx = list.findIndex((r) => (r as unknown as AnyRow).id === id);
    if (idx < 0) return;
    const [old] = list.splice(idx, 1);
    this.cascade(table, id);
    this.persist();
    this.emit(table, { type: 'DELETE', new: null, old: old as unknown as AnyRow });
  }

  /** Minimal ON DELETE CASCADE / SET NULL emulation */
  private cascade(table: TableName, id: string) {
    const drop = <K extends TableName>(t: K, col: string) => {
      (this.db[t] as unknown) = (this.db[t] as unknown as Record<string, unknown>[]).filter((r) => r[col] !== id);
    };
    if (table === 'channels') {
      drop('messages', 'channel_id');
      drop('channel_members', 'channel_id');
    }
    if (table === 'messages') {
      drop('message_reactions', 'message_id');
      for (const m of this.db.messages) if (m.reply_to === id) m.reply_to = null;
    }
    if (table === 'watchlists') drop('watchlist_items', 'watchlist_id');
    if (table === 'sim_positions') drop('sim_transactions', 'position_id');
    if (table === 'research_notes') drop('research_note_history', 'note_id');
    if (table === 'predictions') {
      drop('prediction_history', 'prediction_id');
      drop('prediction_links', 'prediction_id');
    }
    if (table === 'trade_ideas') {
      drop('trade_comments', 'trade_id');
      drop('trade_events', 'trade_id');
      drop('trade_reactions', 'trade_id');
    }
  }

  private guardPrediction(o: Record<string, unknown>, n: Record<string, unknown>) {
    const diff = (keys: string[]) => keys.some((k) => JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null));
    if (diff(P_IMMUTABLE)) throw new Error('created_at, created_by and baseline values are immutable');
    const core = diff(P_CORE);
    const res = diff(P_RES);
    if (o.status !== 'open' && (core || res)) throw new Error('This prediction is resolved and locked. Add notes or a lesson instead.');
    if (res && n.status === 'open') throw new Error('Resolve a prediction with a final status (correct, partial, incorrect, invalidated or expired).');
    if (res) {
      n.resolved_at = n.resolved_at ?? new Date().toISOString();
      n.resolved_by = this.currentUser()?.id ?? null;
    }
  }

  private afterUpdate<K extends TableName>(table: K, oldRow: Row<K>, newRow: Row<K>) {
    const o = oldRow as unknown as Record<string, unknown>;
    const n = newRow as unknown as Record<string, unknown>;
    if (table === 'research_notes' && o.content !== n.content) {
      void this.insert('research_note_history', {
        note_id: o.id as string, symbol: o.symbol as string, section: o.section as Tables['research_notes']['section'],
        content: o.content as string, edited_by: (o.updated_by as string | null) ?? null, edited_at: o.updated_at as string,
      });
    }
    if (table === 'predictions') {
      const oldC: Record<string, unknown> = {};
      const newC: Record<string, unknown> = {};
      for (const k of [...P_CORE, ...P_RES, 'notes', 'result_notes', 'lesson']) {
        if (JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null)) {
          oldC[k] = o[k] ?? null;
          newC[k] = n[k] ?? null;
        }
      }
      const keys = Object.keys(oldC);
      if (!keys.length) return;
      const kind = keys.some((k) => P_RES.includes(k)) ? 'resolve' : keys.every((k) => P_NOTE.includes(k)) ? 'note' : 'edit';
      void this.insert('prediction_history', { prediction_id: n.id as string, change_type: kind, changed_by: this.currentUser()?.id ?? null, old_values: oldC, new_values: newC });
    }
  }

  /** Local emulation of the simulator RPCs (same maths as the SQL functions). */
  async rpc<T = unknown>(fn: RpcName, args: Record<string, unknown>): Promise<T> {
    const me = this.currentUser();
    if (!me) throw new Error('Not signed in');
    const num = (v: unknown) => (v == null || v === '' ? null : Number(v));
    const r2 = (v: number) => Math.round(v * 100) / 100;
    const r4 = (v: number) => Math.round(v * 10000) / 10000;
    if (fn === 'sim_open_position') {
      const shares = num(args.p_shares);
      const price = num(args.p_price);
      if (!shares || shares <= 0) throw new Error('Shares must be positive');
      if (!price || price <= 0) throw new Error('Price must be positive');
      const entry = (args.p_entry_date as string) || new Date().toISOString().slice(0, 10);
      const pos = await this.insert('sim_positions', {
        owner_id: me.id, symbol: String(args.p_symbol).toUpperCase(), direction: args.p_direction as 'long' | 'short', shares, avg_entry: price,
        entry_date: entry, target: num(args.p_target), stop: num(args.p_stop), thesis: (args.p_thesis as string) ?? null,
        catalyst: (args.p_catalyst as string) ?? null, notes: (args.p_notes as string) ?? null, trade_idea_id: (args.p_trade_idea as string) ?? null,
      });
      await this.insert('sim_transactions', { position_id: pos.id, user_id: me.id, type: 'open', shares, price, executed_at: new Date(entry).toISOString() });
      return pos as T;
    }
    if (fn === 'sim_apply_transaction') {
      const pos = this.db.sim_positions.find((p) => p.id === args.p_position);
      if (!pos) throw new Error('Position not found');
      if (pos.owner_id !== me.id) throw new Error('Only the owner can trade this simulated position');
      if (pos.status !== 'open') throw new Error('Position is closed');
      const price = num(args.p_price);
      if (!price || price <= 0) throw new Error('Price must be positive');
      let type = args.p_type as 'add' | 'reduce' | 'close';
      let qty = num(args.p_shares) ?? 0;
      const dir = pos.direction === 'long' ? 1 : -1;
      const at = (args.p_executed_at as string) || new Date().toISOString();
      let pnl = 0;
      let next: Tables['sim_positions'];
      if (type === 'add') {
        if (qty <= 0) throw new Error('Shares must be positive');
        next = await this.update('sim_positions', pos.id, { avg_entry: r4((pos.shares * pos.avg_entry + qty * price) / (pos.shares + qty)), shares: pos.shares + qty });
      } else if (type === 'reduce' || type === 'close') {
        if (type === 'close') qty = pos.shares;
        if (qty <= 0 || qty > pos.shares) throw new Error('Shares must be between 0 and the open quantity');
        pnl = r2((price - pos.avg_entry) * qty * dir);
        const left = pos.shares - qty;
        next = await this.update('sim_positions', pos.id, {
          shares: left, realized_pnl: r2(pos.realized_pnl + pnl), closed_qty: pos.closed_qty + qty, closed_value: pos.closed_value + qty * price,
          status: left === 0 ? 'closed' : 'open', closed_at: left === 0 ? at : pos.closed_at,
        });
        if (type === 'reduce' && left === 0) type = 'close';
      } else throw new Error(`Unknown transaction type ${String(type)}`);
      await this.insert('sim_transactions', { position_id: pos.id, user_id: me.id, type, shares: qty, price, realized_pnl: pnl, executed_at: at, note: (args.p_note as string) ?? null });
      return next as T;
    }
    throw new Error(`RPC ${fn} is not available in Demo Mode`);
  }

  private afterInsert<K extends TableName>(table: K, row: Row<K>) {
    if (table === 'predictions') {
      const p = row as unknown as Tables['predictions'];
      const { updated_at: _u, ...rest } = p;
      void _u;
      void this.insert('prediction_history', { prediction_id: p.id, change_type: 'create', changed_by: p.created_by, new_values: rest as unknown as Record<string, unknown> });
    }
    // mirror the SQL trigger that gives new public channels to everyone
    if (table === 'channels') {
      const c = row as unknown as Tables['channels'];
      if (c.type === 'channel') {
        for (const u of DEMO_USERS) {
          if (!this.db.channel_members.some((m) => m.channel_id === c.id && m.user_id === u.id)) {
            void this.insert('channel_members', { channel_id: c.id, user_id: u.id });
          }
        }
      }
    }
  }

  subscribe<K extends TableName>(
    table: K,
    cb: (e: ChangeEvent<Row<K>>) => void,
    filter?: { column: keyof Row<K> & string; value: string },
  ) {
    const wrapped: Listener = (e) => {
      const row = (e.new ?? e.old) as Record<string, unknown> | null;
      if (filter && e.type !== 'DELETE' && row && row[filter.column] !== filter.value) return;
      cb(e as unknown as ChangeEvent<Row<K>>);
    };
    if (!this.listeners.has(table)) this.listeners.set(table, new Set());
    this.listeners.get(table)!.add(wrapped);
    return () => {
      this.listeners.get(table)?.delete(wrapped);
    };
  }

  /* ───── special ───── */
  async unreadCounts(): Promise<Record<string, number>> {
    const me = this.currentUser();
    if (!me) return {};
    const out: Record<string, number> = {};
    for (const m of this.db.messages) {
      if (m.user_id === me.id) continue;
      const mem = this.db.channel_members.find((x) => x.channel_id === m.channel_id && x.user_id === me.id);
      if (!mem) continue;
      if (m.created_at > mem.last_read_at) out[m.channel_id] = (out[m.channel_id] ?? 0) + 1;
    }
    return out;
  }

  async getOrCreateDm(otherUserId: string): Promise<string> {
    const me = this.currentUser();
    if (!me) throw new Error('Not signed in');
    const key = [me.id, otherUserId].sort().join(':');
    const existing = this.db.channels.find((c) => c.dm_key === key);
    if (existing) return existing.id;
    const ch = await this.insert('channels', { name: 'Direct message', type: 'dm', dm_key: key, created_by: me.id });
    await this.insert('channel_members', { channel_id: ch.id, user_id: me.id });
    if (otherUserId !== me.id) await this.insert('channel_members', { channel_id: ch.id, user_id: otherUserId });
    return ch.id;
  }

  async uploadImage(file: File): Promise<string> {
    if (file.size > 1_200_000) throw new Error('Demo Mode stores images in the browser — max 1.2 MB. Connect Supabase for 5 MB uploads.');
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('Could not read image'));
      r.readAsDataURL(file);
    });
  }

  async imageUrl(path: string): Promise<string> {
    return path;
  }

  joinRoom(me: PresenceUser): RealtimeRoom {
    const presenceCbs = new Set<(u: PresenceUser[]) => void>();
    const typingCbs = new Set<(e: TypingEvent) => void>();
    const seen = new Map<string, { user: PresenceUser; at: number }>();
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ncc-demo-presence') : null;
    const list = () => {
      const now = Date.now();
      const out = new Map<string, PresenceUser>([[me.id, me]]);
      seen.forEach((v) => {
        if (now - v.at < 12_000) out.set(v.user.id, v.user);
      });
      return [...out.values()];
    };
    const publish = () => presenceCbs.forEach((cb) => cb(list()));
    if (bc) {
      bc.onmessage = (ev: MessageEvent<{ kind: 'hb' | 'typing' | 'bye'; user: PresenceUser; channelId?: string }>) => {
        const d = ev.data;
        if (d.kind === 'hb') {
          const prev = seen.get(d.user.id);
          const isNew = !prev;
          seen.set(d.user.id, { user: d.user, at: Date.now() });
          if (prev && prev.user.status !== d.user.status) publish();
          if (isNew) {
            bc.postMessage({ kind: 'hb', user: me });
            publish();
          }
        } else if (d.kind === 'bye') {
          seen.delete(d.user.id);
          publish();
        } else if (d.kind === 'typing' && d.channelId) {
          typingCbs.forEach((cb) => cb({ userId: d.user.id, name: d.user.name, channelId: d.channelId! }));
        }
      };
    }
    const beat = () => bc?.postMessage({ kind: 'hb', user: me });
    beat();
    const hb = window.setInterval(() => {
      beat();
      publish();
    }, 5000);
    const bye = () => bc?.postMessage({ kind: 'bye', user: me });
    window.addEventListener('beforeunload', bye);
    let lastTyping = 0;
    return {
      onPresence: (cb) => {
        presenceCbs.add(cb);
        cb(list());
        return () => presenceCbs.delete(cb);
      },
      onTyping: (cb) => {
        typingCbs.add(cb);
        return () => typingCbs.delete(cb);
      },
      sendTyping: (channelId) => {
        if (Date.now() - lastTyping < 2500) return;
        lastTyping = Date.now();
        bc?.postMessage({ kind: 'typing', user: me, channelId });
      },
      setStatus: (status) => {
        if (me.status === status) return;
        me.status = status;
        beat();
        publish();
      },
      leave: () => {
        bye();
        window.clearInterval(hb);
        window.removeEventListener('beforeunload', bye);
        bc?.close();
      },
    };
  }
}
