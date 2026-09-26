/* Row types mirroring supabase/schema.sql. Keep in sync when you change the schema. */

export type UUID = string;
export type ISODate = string; // 2026-01-31
export type ISODateTime = string; // 2026-01-31T14:00:00.000Z

export interface Profile {
  id: UUID;
  email: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
  status_text: string | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type ChannelType = 'channel' | 'group' | 'dm';
export interface Channel {
  id: UUID;
  slug: string | null;
  name: string;
  description: string | null;
  type: ChannelType;
  dm_key: string | null;
  is_default: boolean;
  created_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface ChannelMember {
  id: UUID;
  channel_id: UUID;
  user_id: UUID;
  role: 'owner' | 'member';
  last_read_at: ISODateTime;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type MessageKind = 'text' | 'stock_share' | 'image' | 'system';
/**
 * Shared stock chart in chat. Stores ONLY what's needed to rebuild the official TradingView
 * chart on the receiving side — never prices, OHLC, volume or chart points.
 */
export interface StockShareMeta {
  /** TradingView symbol, e.g. "NASDAQ:NVDA" (older messages may hold a bare ticker) */
  symbol: string;
  ticker?: string;
  exchange?: string | null;
  provider?: 'tradingview';
  sharedChart?: boolean;
  /** Default chart interval: "5", "15", "60", "D", "W" */
  interval?: string;
  /** Company name from the local reference directory (not market data) */
  company?: string;
}
export interface MessageMetadata {
  stock?: StockShareMeta;
  mentions?: UUID[];
  tickers?: string[];
}
export interface Message {
  id: UUID;
  channel_id: UUID;
  user_id: UUID;
  content: string;
  kind: MessageKind;
  metadata: MessageMetadata;
  reply_to: UUID | null;
  pinned: boolean;
  attachment_path: string | null;
  edited_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface MessageReaction {
  id: UUID;
  message_id: UUID;
  user_id: UUID;
  emoji: string;
  created_at: ISODateTime;
}

export interface Watchlist {
  id: UUID;
  owner_id: UUID;
  name: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export const WATCH_CATEGORIES = [
  'Catalyst',
  'Earnings',
  'Biotech',
  'Low Float',
  'Momentum',
  'Defense',
  'AI',
  'Crypto',
  'Short Watch',
  'Long Watch',
] as const;
export type WatchCategory = (typeof WATCH_CATEGORIES)[number];
export const RISK_LEVELS = ['low', 'medium', 'high', 'extreme'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];
export const WATCH_DIRECTIONS = ['long', 'short', 'watch'] as const;
export type WatchDirection = (typeof WATCH_DIRECTIONS)[number];

export interface WatchlistItem {
  id: UUID;
  watchlist_id: UUID;
  owner_id: UUID;
  symbol: string;
  company: string | null;
  favorite: boolean;
  notes: string | null;
  thesis: string | null;
  category: WatchCategory;
  risk_level: RiskLevel;
  catalyst_date: ISODate | null;
  direction: WatchDirection;
  sort_order: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export const TRADE_STATUSES = ['watching', 'planning', 'entered', 'won', 'lost', 'closed', 'canceled'] as const;
export type TradeStatus = (typeof TRADE_STATUSES)[number];
export type TradeDirection = 'long' | 'short';
export interface TradeIdea {
  id: UUID;
  created_by: UUID;
  symbol: string;
  direction: TradeDirection;
  entry: number | null;
  position_size: number | null;
  thesis: string | null;
  catalyst: string | null;
  target: number | null;
  downside: string | null;
  stop: number | null;
  expected_move: number | null;
  probability: number | null;
  catalyst_date: ISODate | null;
  time_horizon: string | null;
  status: TradeStatus;
  exit_price: number | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface TradeComment {
  id: UUID;
  trade_id: UUID;
  user_id: UUID;
  content: string;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type TradeEventType = 'created' | 'status' | 'edited' | 'comment';
export interface TradeEvent {
  id: UUID;
  trade_id: UUID;
  user_id: UUID | null;
  event_type: TradeEventType;
  detail: { from?: string; to?: string; fields?: string[]; excerpt?: string };
  created_at: ISODateTime;
}

export const TRADE_REACTIONS = ['🔥', '👀', '⚠️', '✅', '❌'] as const;
export type TradeReactionEmoji = (typeof TRADE_REACTIONS)[number];
export interface TradeReaction {
  id: UUID;
  trade_id: UUID;
  user_id: UUID;
  emoji: TradeReactionEmoji;
  created_at: ISODateTime;
}

export const CATALYST_TYPES = [
  'Earnings',
  'SEC Filing',
  '8-K',
  'M&A',
  'Government Contract',
  'FDA',
  'Clinical Trial',
  'Financing',
  'Dilution',
  'Reverse Split',
  'Merger',
  'IPO',
  'De-SPAC',
  'Investor Day',
  'Analyst Action',
  'Legal',
  'Regulatory',
  'Macro',
  'Other',
] as const;
export type CatalystType = (typeof CATALYST_TYPES)[number];
export const CATALYST_STATUSES = ['upcoming', 'active', 'played_out', 'invalidated'] as const;
export type CatalystStatus = (typeof CATALYST_STATUSES)[number];
export type CatalystBias = 'bullish' | 'bearish' | 'uncertain';
export type Impact = 'low' | 'medium' | 'high';
export interface Catalyst {
  id: UUID;
  created_by: UUID;
  symbol: string;
  company: string | null;
  catalyst_type: CatalystType;
  headline: string;
  source_url: string | null;
  announced_at: ISODateTime | null;
  catalyst_date: ISODate | null;
  expected_impact: Impact;
  bias: CatalystBias;
  notes: string | null;
  confidence: number;
  expected_move: number | null;
  status: CatalystStatus;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type NotificationType =
  | 'message'
  | 'ticker_mention'
  | 'catalyst'
  | 'trade_update'
  | 'mention'
  | 'price_alert'
  | 'system';
export interface AppNotification {
  id: UUID;
  user_id: UUID;
  actor_id: UUID | null;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read_at: ISODateTime | null;
  created_at: ISODateTime;
}

export interface TickerNote {
  id: UUID;
  symbol: string;
  thesis: string | null;
  catalyst_score: number | null;
  momentum_score: number | null;
  volatility_score: number | null;
  risk_score: number | null;
  updated_by: UUID | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export interface PriceAlert {
  id: UUID;
  user_id: UUID;
  symbol: string;
  condition: 'above' | 'below';
  price: number;
  active: boolean;
  triggered_at: ISODateTime | null;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

/** Table name → row type */
export interface Tables {
  profiles: Profile;
  channels: Channel;
  channel_members: ChannelMember;
  messages: Message;
  message_reactions: MessageReaction;
  watchlists: Watchlist;
  watchlist_items: WatchlistItem;
  trade_ideas: TradeIdea;
  trade_comments: TradeComment;
  trade_events: TradeEvent;
  trade_reactions: TradeReaction;
  catalysts: Catalyst;
  notifications: AppNotification;
  ticker_notes: TickerNote;
  price_alerts: PriceAlert;
}
export type TableName = keyof Tables;
export type Row<K extends TableName> = Tables[K];

/** Columns the database fills in for us */
type Generated = 'id' | 'created_at' | 'updated_at';

/** Columns that must be provided on insert, per table. Everything else is optional (DB default). */
interface RequiredOnInsert {
  profiles: 'id' | 'email';
  channels: 'name' | 'type';
  channel_members: 'channel_id' | 'user_id';
  messages: 'channel_id' | 'user_id' | 'content';
  message_reactions: 'message_id' | 'user_id' | 'emoji';
  watchlists: 'owner_id' | 'name';
  watchlist_items: 'watchlist_id' | 'owner_id' | 'symbol';
  trade_ideas: 'created_by' | 'symbol' | 'direction';
  trade_comments: 'trade_id' | 'user_id' | 'content';
  trade_events: 'trade_id' | 'user_id' | 'event_type';
  trade_reactions: 'trade_id' | 'user_id' | 'emoji';
  catalysts: 'created_by' | 'symbol' | 'catalyst_type' | 'headline';
  notifications: 'user_id' | 'type' | 'title';
  ticker_notes: 'symbol';
  price_alerts: 'user_id' | 'symbol' | 'condition' | 'price';
}

type Req<K extends TableName> = Extract<RequiredOnInsert[K], keyof Tables[K]>;

export type Insert<K extends TableName> = Pick<Tables[K], Req<K>> &
  Partial<Omit<Tables[K], Req<K> | Generated>> &
  Partial<Pick<Tables[K], Extract<Generated, keyof Tables[K]>>>;

export type Patch<K extends TableName> = Partial<Omit<Tables[K], 'id' | 'created_at'>>;
