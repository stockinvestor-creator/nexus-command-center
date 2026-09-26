-- ═══════════════════════════════════════════════════════════════════════════
--  NEXUS Command Center — Supabase schema, RLS policies, whitelist, realtime
--  Safe to run more than once (idempotent). Paste into Supabase → SQL Editor → Run.
-- ═══════════════════════════════════════════════════════════════════════════
--
--  BEFORE creating your two user accounts, add both emails to the whitelist:
--
--    insert into public.allowed_emails (email) values
--      ('you@example.com'),
--      ('partner@example.com');
--
--  Any signup (even from the Supabase dashboard) with an email that is not in
--  public.allowed_emails is rejected by a trigger on auth.users.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- Utility: updated_at
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Whitelist
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.allowed_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;
-- No policies on purpose: only the SQL editor / service role can read or edit it.

-- Hard cap: this is a private two-person workspace. Raise the number if you ever need to.
create or replace function public.limit_allowed_emails()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.allowed_emails) >= 2 then
    raise exception 'This workspace is limited to two accounts';
  end if;
  new.email = lower(new.email);
  return new;
end;
$$;
drop trigger if exists limit_allowed_emails on public.allowed_emails;
create trigger limit_allowed_emails
  before insert on public.allowed_emails
  for each row execute function public.limit_allowed_emails();

-- Is the current JWT holder a whitelisted workspace member?
create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.allowed_emails a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null default 'Operator',
  avatar_color text not null default '#22d3ee',
  avatar_url text,
  status_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null check (char_length(name) between 1 and 60),
  description text,
  type text not null default 'channel' check (type in ('channel', 'group', 'dm')),
  dm_key text unique,
  is_default boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  last_read_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null default '' check (char_length(content) <= 8000),
  kind text not null default 'text' check (kind in ('text', 'stock_share', 'image', 'system')),
  metadata jsonb not null default '{}'::jsonb,
  reply_to uuid references public.messages (id) on delete set null,
  pinned boolean not null default false,
  attachment_path text,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Main' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  company text,
  favorite boolean not null default false,
  notes text,
  thesis text,
  category text not null default 'Long Watch' check (category in
    ('Catalyst','Earnings','Biotech','Low Float','Momentum','Defense','AI','Crypto','Short Watch','Long Watch')),
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','extreme')),
  catalyst_date date,
  direction text not null default 'watch' check (direction in ('long','short','watch')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, symbol)
);

create table if not exists public.trade_ideas (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  direction text not null check (direction in ('long','short')),
  entry numeric(14,4),
  position_size numeric(14,4),
  thesis text,
  catalyst text,
  target numeric(14,4),
  downside text,
  stop numeric(14,4),
  expected_move numeric(8,2),
  probability integer check (probability between 0 and 100),
  catalyst_date date,
  time_horizon text,
  status text not null default 'watching' check (status in
    ('watching','planning','entered','won','lost','closed','canceled')),
  exit_price numeric(14,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_comments (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trade_events (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_ideas (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  event_type text not null check (event_type in ('created','status','edited','comment')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trade_reactions (
  id uuid primary key default gen_random_uuid(),
  trade_id uuid not null references public.trade_ideas (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (emoji in ('🔥','👀','⚠️','✅','❌')),
  created_at timestamptz not null default now(),
  unique (trade_id, user_id, emoji)
);

create table if not exists public.catalysts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  company text,
  catalyst_type text not null check (catalyst_type in
    ('Earnings','SEC Filing','8-K','M&A','Government Contract','FDA','Clinical Trial','Financing',
     'Dilution','Reverse Split','Merger','IPO','De-SPAC','Investor Day','Analyst Action','Legal',
     'Regulatory','Macro','Other')),
  headline text not null check (char_length(headline) between 1 and 300),
  source_url text check (source_url is null or source_url ~* '^https?://'),
  announced_at timestamptz,
  catalyst_date date,
  expected_impact text not null default 'medium' check (expected_impact in ('low','medium','high')),
  bias text not null default 'uncertain' check (bias in ('bullish','bearish','uncertain')),
  notes text,
  confidence integer not null default 50 check (confidence between 0 and 100),
  expected_move numeric(8,2),
  status text not null default 'upcoming' check (status in ('upcoming','active','played_out','invalidated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  type text not null check (type in ('message','ticker_mention','catalyst','trade_update','mention','price_alert','system')),
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ticker_notes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  thesis text,
  catalyst_score integer check (catalyst_score between 0 and 100),
  momentum_score integer check (momentum_score between 0 and 100),
  volatility_score integer check (volatility_score between 0 and 100),
  risk_score integer check (risk_score between 0 and 100),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  condition text not null check (condition in ('above','below')),
  price numeric(14,4) not null check (price > 0),
  active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_messages_channel_created on public.messages (channel_id, created_at desc);
create index if not exists idx_messages_user on public.messages (user_id);
create index if not exists idx_messages_reply on public.messages (reply_to);
create index if not exists idx_messages_pinned on public.messages (channel_id) where pinned;
create index if not exists idx_reactions_message on public.message_reactions (message_id);
create index if not exists idx_members_user on public.channel_members (user_id);
create index if not exists idx_watchlists_owner on public.watchlists (owner_id);
create index if not exists idx_watch_items_list on public.watchlist_items (watchlist_id, sort_order);
create index if not exists idx_watch_items_symbol on public.watchlist_items (symbol);
create index if not exists idx_trades_status on public.trade_ideas (status, updated_at desc);
create index if not exists idx_trades_symbol on public.trade_ideas (symbol);
create index if not exists idx_trade_comments_trade on public.trade_comments (trade_id, created_at);
create index if not exists idx_trade_events_trade on public.trade_events (trade_id, created_at);
create index if not exists idx_trade_reactions_trade on public.trade_reactions (trade_id);
create index if not exists idx_catalysts_symbol on public.catalysts (symbol);
create index if not exists idx_catalysts_date on public.catalysts (catalyst_date);
create index if not exists idx_catalysts_created on public.catalysts (created_at desc);
create index if not exists idx_notifications_user on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_unread on public.notifications (user_id) where read_at is null;
create index if not exists idx_price_alerts_user on public.price_alerts (user_id, symbol) where active;

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['profiles','channels','channel_members','messages','watchlists','watchlist_items',
                           'trade_ideas','trade_comments','catalysts','ticker_notes','price_alerts']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auth hooks: whitelist enforcement + profile bootstrap
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.enforce_email_whitelist()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.allowed_emails a where a.email = lower(new.email)) then
    raise exception 'Registration is closed for this private workspace';
  end if;
  return new;
end;
$$;
drop trigger if exists enforce_email_whitelist on auth.users;
create trigger enforce_email_whitelist
  before insert on auth.users
  for each row execute function public.enforce_email_whitelist();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array['#22d3ee','#a78bfa','#34d399','#f472b6','#fbbf24','#60a5fa'];
begin
  insert into public.profiles (id, email, display_name, avatar_color)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    palette[1 + (abs(hashtext(new.email)) % array_length(palette, 1))]
  )
  on conflict (id) do nothing;

  insert into public.channel_members (channel_id, user_id)
  select c.id, new.id from public.channels c where c.type = 'channel'
  on conflict (channel_id, user_id) do nothing;

  insert into public.watchlists (owner_id, name) values (new.id, 'Main');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Channel access helpers
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.can_access_channel(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.channels c
    where c.id = cid
      and (
        c.type = 'channel'
        or c.created_by = auth.uid()
        or exists (select 1 from public.channel_members m where m.channel_id = c.id and m.user_id = auth.uid())
      )
  );
$$;

create or replace function public.get_or_create_dm(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  k text;
  cid uuid;
begin
  if not public.is_member() then
    raise exception 'Not allowed';
  end if;
  if not exists (select 1 from public.profiles where id = other) then
    raise exception 'Unknown user';
  end if;
  k := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  select id into cid from public.channels where dm_key = k;
  if cid is null then
    insert into public.channels (name, type, dm_key, created_by)
    values ('Direct message', 'dm', k, me)
    on conflict (dm_key) do nothing
    returning id into cid;
    if cid is null then
      select id into cid from public.channels where dm_key = k;
    end if;
  end if;
  insert into public.channel_members (channel_id, user_id)
  values (cid, me), (cid, other)
  on conflict (channel_id, user_id) do nothing;
  return cid;
end;
$$;

create or replace function public.unread_counts()
returns table (channel_id uuid, unread bigint)
language sql
stable
security definer
set search_path = public
as $$
  select m.channel_id, count(*)::bigint
  from public.messages m
  left join public.channel_members cm
    on cm.channel_id = m.channel_id and cm.user_id = auth.uid()
  where public.can_access_channel(m.channel_id)
    and m.user_id <> auth.uid()
    and m.created_at > coalesce(cm.last_read_at, now() - interval '7 days')
  group by m.channel_id;
$$;

-- Only authors may change message content; anyone in the channel may pin.
create or replace function public.guard_message_update()
returns trigger
language plpgsql
as $$
begin
  if new.user_id <> old.user_id or new.channel_id <> old.channel_id then
    raise exception 'user_id and channel_id are immutable';
  end if;
  if (new.content is distinct from old.content
      or new.metadata is distinct from old.metadata
      or new.attachment_path is distinct from old.attachment_path)
     and old.user_id <> auth.uid() then
    raise exception 'Only the author can edit this message';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_message_update on public.messages;
create trigger guard_message_update
  before update on public.messages
  for each row execute function public.guard_message_update();

-- Trade idea creator is immutable
create or replace function public.guard_trade_update()
returns trigger
language plpgsql
as $$
begin
  if new.created_by <> old.created_by then
    raise exception 'created_by is immutable';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_trade_update on public.trade_ideas;
create trigger guard_trade_update
  before update on public.trade_ideas
  for each row execute function public.guard_trade_update();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles          enable row level security;
alter table public.channels          enable row level security;
alter table public.channel_members   enable row level security;
alter table public.messages          enable row level security;
alter table public.message_reactions enable row level security;
alter table public.watchlists        enable row level security;
alter table public.watchlist_items   enable row level security;
alter table public.trade_ideas       enable row level security;
alter table public.trade_comments    enable row level security;
alter table public.trade_events      enable row level security;
alter table public.trade_reactions   enable row level security;
alter table public.catalysts         enable row level security;
alter table public.notifications     enable row level security;
alter table public.ticker_notes      enable row level security;
alter table public.price_alerts      enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (public.is_member());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_member())
  with check (id = auth.uid() and email = lower(auth.jwt() ->> 'email'));

-- channels
drop policy if exists channels_select on public.channels;
-- Inline (not can_access_channel) so INSERT ... RETURNING can see the row it just created
create policy channels_select on public.channels for select to authenticated
  using (
    public.is_member() and (
      type = 'channel'
      or created_by = auth.uid()
      or exists (select 1 from public.channel_members m where m.channel_id = channels.id and m.user_id = auth.uid())
    )
  );
drop policy if exists channels_insert on public.channels;
create policy channels_insert on public.channels for insert to authenticated
  with check (public.is_member() and created_by = auth.uid() and type in ('channel','group') and dm_key is null);
drop policy if exists channels_update on public.channels;
create policy channels_update on public.channels for update to authenticated
  using (public.is_member() and created_by = auth.uid())
  with check (created_by = auth.uid());
drop policy if exists channels_delete on public.channels;
create policy channels_delete on public.channels for delete to authenticated
  using (public.is_member() and created_by = auth.uid() and not is_default);

-- channel_members
drop policy if exists members_select on public.channel_members;
create policy members_select on public.channel_members for select to authenticated using (public.is_member());
drop policy if exists members_insert on public.channel_members;
create policy members_insert on public.channel_members for insert to authenticated
  with check (
    public.is_member() and (
      exists (select 1 from public.channels c where c.id = channel_id and c.created_by = auth.uid())
      or (user_id = auth.uid() and exists (select 1 from public.channels c where c.id = channel_id and c.type = 'channel'))
    )
  );
drop policy if exists members_update on public.channel_members;
create policy members_update on public.channel_members for update to authenticated
  using (public.is_member() and user_id = auth.uid())
  with check (user_id = auth.uid());
drop policy if exists members_delete on public.channel_members;
create policy members_delete on public.channel_members for delete to authenticated
  using (
    public.is_member() and (
      user_id = auth.uid()
      or exists (select 1 from public.channels c where c.id = channel_id and c.created_by = auth.uid())
    )
  );

-- messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.can_access_channel(channel_id));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (user_id = auth.uid() and public.can_access_channel(channel_id));
drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages for update to authenticated
  using (public.can_access_channel(channel_id))
  with check (public.can_access_channel(channel_id));
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages for delete to authenticated
  using (user_id = auth.uid() and public.is_member());

-- message_reactions
drop policy if exists reactions_select on public.message_reactions;
create policy reactions_select on public.message_reactions for select to authenticated using (public.is_member());
drop policy if exists reactions_insert on public.message_reactions;
create policy reactions_insert on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());
drop policy if exists reactions_delete on public.message_reactions;
create policy reactions_delete on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- watchlists (both members can see each other's lists; only owners edit)
drop policy if exists watchlists_select on public.watchlists;
create policy watchlists_select on public.watchlists for select to authenticated using (public.is_member());
drop policy if exists watchlists_write on public.watchlists;
create policy watchlists_write on public.watchlists for all to authenticated
  using (owner_id = auth.uid() and public.is_member())
  with check (owner_id = auth.uid() and public.is_member());

drop policy if exists watch_items_select on public.watchlist_items;
create policy watch_items_select on public.watchlist_items for select to authenticated using (public.is_member());
drop policy if exists watch_items_write on public.watchlist_items;
create policy watch_items_write on public.watchlist_items for all to authenticated
  using (owner_id = auth.uid() and public.is_member())
  with check (
    owner_id = auth.uid() and public.is_member()
    and exists (select 1 from public.watchlists w where w.id = watchlist_id and w.owner_id = auth.uid())
  );

-- trade ideas (shared board: both can update status; only creator deletes)
drop policy if exists trades_select on public.trade_ideas;
create policy trades_select on public.trade_ideas for select to authenticated using (public.is_member());
drop policy if exists trades_insert on public.trade_ideas;
create policy trades_insert on public.trade_ideas for insert to authenticated
  with check (created_by = auth.uid() and public.is_member());
drop policy if exists trades_update on public.trade_ideas;
create policy trades_update on public.trade_ideas for update to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists trades_delete on public.trade_ideas;
create policy trades_delete on public.trade_ideas for delete to authenticated
  using (created_by = auth.uid() and public.is_member());

drop policy if exists trade_comments_select on public.trade_comments;
create policy trade_comments_select on public.trade_comments for select to authenticated using (public.is_member());
drop policy if exists trade_comments_insert on public.trade_comments;
create policy trade_comments_insert on public.trade_comments for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());
drop policy if exists trade_comments_update on public.trade_comments;
create policy trade_comments_update on public.trade_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists trade_comments_delete on public.trade_comments;
create policy trade_comments_delete on public.trade_comments for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists trade_events_select on public.trade_events;
create policy trade_events_select on public.trade_events for select to authenticated using (public.is_member());
drop policy if exists trade_events_insert on public.trade_events;
create policy trade_events_insert on public.trade_events for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists trade_reactions_select on public.trade_reactions;
create policy trade_reactions_select on public.trade_reactions for select to authenticated using (public.is_member());
drop policy if exists trade_reactions_insert on public.trade_reactions;
create policy trade_reactions_insert on public.trade_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());
drop policy if exists trade_reactions_delete on public.trade_reactions;
create policy trade_reactions_delete on public.trade_reactions for delete to authenticated
  using (user_id = auth.uid());

-- catalysts (shared)
drop policy if exists catalysts_select on public.catalysts;
create policy catalysts_select on public.catalysts for select to authenticated using (public.is_member());
drop policy if exists catalysts_insert on public.catalysts;
create policy catalysts_insert on public.catalysts for insert to authenticated
  with check (created_by = auth.uid() and public.is_member());
drop policy if exists catalysts_update on public.catalysts;
create policy catalysts_update on public.catalysts for update to authenticated
  using (public.is_member()) with check (public.is_member());
drop policy if exists catalysts_delete on public.catalysts;
create policy catalysts_delete on public.catalysts for delete to authenticated
  using (created_by = auth.uid() and public.is_member());

-- notifications (recipient-only read; any member can notify the other)
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.is_member() and actor_id = auth.uid());
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- ticker notes & scores (shared, manually edited)
drop policy if exists ticker_notes_select on public.ticker_notes;
create policy ticker_notes_select on public.ticker_notes for select to authenticated using (public.is_member());
drop policy if exists ticker_notes_insert on public.ticker_notes;
create policy ticker_notes_insert on public.ticker_notes for insert to authenticated
  with check (public.is_member() and updated_by = auth.uid());
drop policy if exists ticker_notes_update on public.ticker_notes;
create policy ticker_notes_update on public.ticker_notes for update to authenticated
  using (public.is_member()) with check (public.is_member() and updated_by = auth.uid());

-- price alerts (private per user)
drop policy if exists price_alerts_all on public.price_alerts;
create policy price_alerts_all on public.price_alerts for all to authenticated
  using (user_id = auth.uid() and public.is_member())
  with check (user_id = auth.uid() and public.is_member());

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC permissions
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.get_or_create_dm(uuid) from public, anon;
revoke all on function public.unread_counts() from public, anon;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.unread_counts() to authenticated;
grant execute on function public.is_member() to authenticated;
grant execute on function public.can_access_channel(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Default channels
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.channels (slug, name, description, type, is_default) values
  ('general',   'general',   'Everything and nothing',            'channel', true),
  ('stocks',    'stocks',    'Tickers, charts, setups',           'channel', true),
  ('catalysts', 'catalysts', 'Filings, FDA dates, contracts, PRs', 'channel', true),
  ('earnings',  'earnings',  'Earnings plays and reactions',      'channel', true),
  ('moonshots', 'moonshots', 'High risk / high reward ideas',     'channel', true),
  ('shorts',    'shorts',    'Short theses and squeeze watch',    'channel', true)
on conflict (slug) do nothing;

-- Backfill memberships for users created before this script ran
insert into public.channel_members (channel_id, user_id)
select c.id, p.id from public.channels c cross join public.profiles p where c.type = 'channel'
on conflict (channel_id, user_id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime (Supabase Realtime respects RLS for postgres_changes)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.messages replica identity full;
alter table public.message_reactions replica identity full;
alter table public.trade_reactions replica identity full;
alter table public.channel_members replica identity full;

do $$
declare t text;
begin
  foreach t in array array['messages','message_reactions','channels','channel_members','trade_ideas',
                           'trade_comments','trade_events','trade_reactions','catalysts','notifications',
                           'watchlist_items','watchlists','ticker_notes','profiles','price_alerts']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: private bucket for chat images (5 MB max per file)
-- Files are stored under <user_id>/<random>.<ext>
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880, array['image/png','image/jpeg','image/gif','image/webp'])
on conflict (id) do nothing;

drop policy if exists attachments_read on storage.objects;
create policy attachments_read on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_member());
drop policy if exists attachments_insert on storage.objects;
create policy attachments_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists attachments_delete on storage.objects;
create policy attachments_delete on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Done. Next: insert your two emails into public.allowed_emails (see top of file),
-- then create both users in Authentication → Users → "Add user" (auto-confirm).
