import type { Tables, TableName } from '@/types/db';

export type LocalDB = { [K in TableName]: Tables[K][] };

export const DEMO_USERS = [
  { id: 'demo-alpha', email: 'alpha@demo.local', display_name: 'Operator A', avatar_color: '#22d3ee' },
  { id: 'demo-bravo', email: 'bravo@demo.local', display_name: 'Operator B', avatar_color: '#a78bfa' },
] as const;

const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();
const dateIn = (days: number) => {
  const d = new Date(Date.now() + days * 86400000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const H = 3600_000;

/** Sample workspace for Demo Mode. Everything is clearly marked as sample content. */
export function seedLocalDb(): LocalDB {
  const [A, B] = DEMO_USERS;
  const now = iso(0);
  const profiles = DEMO_USERS.map((u) => ({
    ...u,
    avatar_url: null,
    status_text: 'Demo account',
    created_at: now,
    updated_at: now,
  }));

  const channelDefs: [string, string][] = [
    ['general', 'Everything and nothing'],
    ['stocks', 'Tickers, charts, setups'],
    ['catalysts', 'Filings, FDA dates, contracts, PRs'],
    ['earnings', 'Earnings plays and reactions'],
    ['moonshots', 'High risk / high reward ideas'],
    ['shorts', 'Short theses and squeeze watch'],
  ];
  const channels: Tables['channels'][] = channelDefs.map(([slug, description]) => ({
    id: `ch-${slug}`,
    slug,
    name: slug,
    description,
    type: 'channel',
    dm_key: null,
    is_default: true,
    created_by: null,
    created_at: now,
    updated_at: now,
  }));

  const channel_members: Tables['channel_members'][] = channels.flatMap((c) =>
    DEMO_USERS.map((u) => ({
      id: `cm-${c.id}-${u.id}`,
      channel_id: c.id,
      user_id: u.id,
      role: 'member' as const,
      last_read_at: iso(2 * H),
      created_at: now,
      updated_at: now,
    })),
  );

  const msg = (
    id: string,
    channel: string,
    user: string,
    content: string,
    ago: number,
    extra: Partial<Tables['messages']> = {},
  ): Tables['messages'] => ({
    id,
    channel_id: `ch-${channel}`,
    user_id: user,
    content,
    kind: 'text',
    metadata: {},
    reply_to: null,
    pinned: false,
    attachment_path: null,
    edited_at: null,
    created_at: iso(ago),
    updated_at: iso(ago),
    ...extra,
  });

  const messages = [
    msg('m1', 'general', A.id, 'Welcome to the command center. This is DEMO MODE — everything is stored in this browser only.', 5 * H, { pinned: true }),
    msg('m2', 'general', B.id, 'Tip: open a second tab and switch identity in Settings → Demo identity to test realtime chat between two operators.', 4.8 * H),
    msg('m3', 'stocks', A.id, 'Watching $NVDA and $MU into the next earnings cycle. Semis breadth is the tell.', 3 * H),
    msg('m4', 'stocks', B.id, '$MU memory pricing thesis still intact imo. Adding to watchlist.', 2.5 * H, { reply_to: 'm3' }),
    msg('m5', 'catalysts', B.id, 'Logged a sample FDA catalyst on $VRTX in the Catalyst Feed (demo data).', 1.5 * H),
    msg('m6', 'moonshots', A.id, '$ASTS and $RKLB on the space radar. Not advice, just vibes. 🚀', 1 * H),
  ];

  const message_reactions: Tables['message_reactions'][] = [
    { id: 'r1', message_id: 'm3', user_id: B.id, emoji: '🔥', created_at: iso(2.9 * H) },
    { id: 'r2', message_id: 'm4', user_id: A.id, emoji: '👀', created_at: iso(2.4 * H) },
  ];

  const watchlists: Tables['watchlists'][] = DEMO_USERS.map((u) => ({
    id: `wl-${u.id}`,
    owner_id: u.id,
    name: 'Main',
    created_at: now,
    updated_at: now,
  }));

  const item = (
    owner: string,
    symbol: string,
    category: Tables['watchlist_items']['category'],
    direction: Tables['watchlist_items']['direction'],
    risk: Tables['watchlist_items']['risk_level'],
    idx: number,
    extra: Partial<Tables['watchlist_items']> = {},
  ): Tables['watchlist_items'] => ({
    id: `wi-${owner}-${symbol}`,
    watchlist_id: `wl-${owner}`,
    owner_id: owner,
    symbol,
    company: null,
    favorite: false,
    notes: null,
    thesis: null,
    category,
    risk_level: risk,
    catalyst_date: null,
    direction,
    sort_order: idx,
    created_at: now,
    updated_at: now,
    ...extra,
  });

  const watchlist_items = [
    item(A.id, 'NVDA', 'AI', 'long', 'medium', 0, { favorite: true, thesis: 'Sample thesis: data-center demand.', catalyst_date: dateIn(12) }),
    item(A.id, 'MU', 'Earnings', 'long', 'high', 1, { catalyst_date: dateIn(5) }),
    item(A.id, 'PLTR', 'AI', 'watch', 'high', 2),
    item(A.id, 'LMT', 'Defense', 'watch', 'low', 3),
    item(A.id, 'VRTX', 'Biotech', 'watch', 'medium', 4, { catalyst_date: dateIn(20) }),
    item(A.id, 'COIN', 'Crypto', 'short', 'extreme', 5),
    item(B.id, 'TSLA', 'Momentum', 'watch', 'high', 0, { favorite: true }),
    item(B.id, 'ASTS', 'Low Float', 'long', 'extreme', 1),
    item(B.id, 'KTOS', 'Defense', 'long', 'medium', 2),
  ];

  const catalysts: Tables['catalysts'][] = [
    {
      id: 'c1',
      created_by: B.id,
      symbol: 'VRTX',
      company: 'Vertex Pharmaceuticals',
      catalyst_type: 'FDA',
      headline: 'SAMPLE: PDUFA decision date (demo entry — replace with a real, sourced catalyst)',
      source_url: null,
      announced_at: iso(26 * H),
      catalyst_date: dateIn(20),
      expected_impact: 'high',
      bias: 'uncertain',
      notes: 'Demo entry to show the layout.',
      confidence: 55,
      expected_move: 8,
      status: 'upcoming',
      created_at: iso(26 * H),
      updated_at: iso(26 * H),
    },
    {
      id: 'c2',
      created_by: A.id,
      symbol: 'MU',
      company: 'Micron Technology',
      catalyst_type: 'Earnings',
      headline: 'SAMPLE: Quarterly earnings (demo entry)',
      source_url: null,
      announced_at: iso(50 * H),
      catalyst_date: dateIn(5),
      expected_impact: 'high',
      bias: 'bullish',
      notes: null,
      confidence: 65,
      expected_move: 9.5,
      status: 'upcoming',
      created_at: iso(50 * H),
      updated_at: iso(50 * H),
    },
    {
      id: 'c3',
      created_by: A.id,
      symbol: 'KTOS',
      company: 'Kratos Defense & Security',
      catalyst_type: 'Government Contract',
      headline: 'SAMPLE: Contract award watch (demo entry)',
      source_url: null,
      announced_at: iso(80 * H),
      catalyst_date: dateIn(30),
      expected_impact: 'medium',
      bias: 'bullish',
      notes: null,
      confidence: 40,
      expected_move: 6,
      status: 'upcoming',
      created_at: iso(80 * H),
      updated_at: iso(80 * H),
    },
  ];

  const trade_ideas: Tables['trade_ideas'][] = [
    {
      id: 't1',
      created_by: A.id,
      symbol: 'MU',
      direction: 'long',
      entry: null,
      position_size: 50,
      thesis: 'SAMPLE idea: memory pricing recovery into earnings.',
      catalyst: 'Earnings',
      target: null,
      downside: 'Guide disappoints; semis sell-off.',
      stop: null,
      expected_move: 9,
      probability: 55,
      catalyst_date: dateIn(5),
      time_horizon: '2-4 weeks',
      status: 'planning',
      exit_price: null,
      created_at: iso(20 * H),
      updated_at: iso(20 * H),
    },
    {
      id: 't2',
      created_by: B.id,
      symbol: 'COIN',
      direction: 'short',
      entry: null,
      position_size: 20,
      thesis: 'SAMPLE idea: fade after extended run.',
      catalyst: 'Macro',
      target: null,
      downside: 'Crypto momentum continues; squeeze risk.',
      stop: null,
      expected_move: 12,
      probability: 40,
      catalyst_date: null,
      time_horizon: '1-2 weeks',
      status: 'watching',
      exit_price: null,
      created_at: iso(10 * H),
      updated_at: iso(10 * H),
    },
  ];

  const trade_events: Tables['trade_events'][] = trade_ideas.map((t) => ({
    id: `te-${t.id}`,
    trade_id: t.id,
    user_id: t.created_by,
    event_type: 'created',
    detail: {},
    created_at: t.created_at,
  }));

  return {
    profiles,
    channels,
    channel_members,
    messages,
    message_reactions,
    watchlists,
    watchlist_items,
    trade_ideas,
    trade_comments: [
      { id: 'tc1', trade_id: 't1', user_id: B.id, content: 'Sample comment: what is the invalidation level?', created_at: iso(18 * H), updated_at: iso(18 * H) },
    ],
    trade_events,
    trade_reactions: [{ id: 'tr1', trade_id: 't1', user_id: B.id, emoji: '👀', created_at: iso(18 * H) }],
    catalysts,
    notifications: [],
    ticker_notes: [],
    price_alerts: [],
  };
}
