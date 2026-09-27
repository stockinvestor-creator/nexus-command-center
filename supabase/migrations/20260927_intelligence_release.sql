-- ═══════════════════════════════════════════════════════════════════════════
--  NEXUS — Intelligence release migration (v3)
--  Adds: simulated portfolio, research notes, event annotations, notification prefs,
--        shared intel cache, morning briefings, prediction tracker.
--
--  • Additive only: creates new tables/functions/policies. Existing tables and data are untouched.
--  • Idempotent: safe to run more than once.
--  • Requires supabase/schema.sql (v1) to have been run already (uses public.is_member()).
--
--  Run: Supabase → SQL Editor → New query → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Simulated portfolio (NOT a brokerage — no orders are ever placed)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.sim_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  starting_cash numeric(16,2) not null default 100000 check (starting_cash >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sim_positions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  direction text not null check (direction in ('long','short')),
  status text not null default 'open' check (status in ('open','closed')),
  shares numeric(16,4) not null default 0 check (shares >= 0),
  avg_entry numeric(16,4) not null check (avg_entry > 0),
  entry_date date not null default current_date,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  target numeric(16,4),
  stop numeric(16,4),
  thesis text,
  catalyst text,
  notes text,
  realized_pnl numeric(16,2) not null default 0,
  closed_qty numeric(16,4) not null default 0,
  closed_value numeric(18,4) not null default 0,
  trade_idea_id uuid references public.trade_ideas (id) on delete set null,
  mistakes text,
  lessons text,
  result_notes text,
  screenshots text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sim_transactions (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.sim_positions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('open','add','reduce','close')),
  shares numeric(16,4) not null check (shares > 0),
  price numeric(16,4) not null check (price > 0),
  realized_pnl numeric(16,2) not null default 0,
  executed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sim_positions_owner on public.sim_positions (owner_id, status);
create index if not exists idx_sim_positions_symbol on public.sim_positions (symbol);
create index if not exists idx_sim_tx_position on public.sim_transactions (position_id, executed_at);

-- Open a position and record the opening transaction atomically.
create or replace function public.sim_open_position(
  p_symbol text, p_direction text, p_shares numeric, p_price numeric,
  p_entry_date date default current_date, p_target numeric default null, p_stop numeric default null,
  p_thesis text default null, p_catalyst text default null, p_notes text default null,
  p_trade_idea uuid default null
) returns public.sim_positions
language plpgsql
security invoker
set search_path = public
as $$
declare pos public.sim_positions;
begin
  if p_shares is null or p_shares <= 0 then raise exception 'Shares must be positive'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price must be positive'; end if;
  insert into public.sim_positions (owner_id, symbol, direction, shares, avg_entry, entry_date, target, stop, thesis, catalyst, notes, trade_idea_id)
  values (auth.uid(), upper(p_symbol), p_direction, p_shares, p_price, coalesce(p_entry_date, current_date), p_target, p_stop, p_thesis, p_catalyst, p_notes, p_trade_idea)
  returning * into pos;
  insert into public.sim_transactions (position_id, user_id, type, shares, price, executed_at)
  values (pos.id, auth.uid(), 'open', p_shares, p_price, coalesce(p_entry_date::timestamptz, now()));
  return pos;
end;
$$;

-- Add / reduce / close with correct average-cost and realized P&L maths, atomically.
create or replace function public.sim_apply_transaction(
  p_position uuid, p_type text, p_shares numeric, p_price numeric, p_note text default null, p_executed_at timestamptz default now()
) returns public.sim_positions
language plpgsql
security invoker
set search_path = public
as $$
declare
  pos public.sim_positions;
  qty numeric := p_shares;
  dir numeric;
  pnl numeric := 0;
begin
  select * into pos from public.sim_positions where id = p_position for update;
  if not found then raise exception 'Position not found'; end if;
  if pos.owner_id <> auth.uid() then raise exception 'Only the owner can trade this simulated position'; end if;
  if pos.status <> 'open' then raise exception 'Position is closed'; end if;
  if p_price is null or p_price <= 0 then raise exception 'Price must be positive'; end if;
  dir := case when pos.direction = 'long' then 1 else -1 end;

  if p_type = 'add' then
    if qty is null or qty <= 0 then raise exception 'Shares must be positive'; end if;
    update public.sim_positions
      set avg_entry = round(((shares * avg_entry) + (qty * p_price)) / (shares + qty), 4),
          shares = shares + qty
      where id = pos.id returning * into pos;
  elsif p_type in ('reduce','close') then
    if p_type = 'close' then qty := pos.shares; end if;
    if qty is null or qty <= 0 or qty > pos.shares then raise exception 'Shares must be between 0 and the open quantity'; end if;
    pnl := round((p_price - pos.avg_entry) * qty * dir, 2);
    update public.sim_positions
      set shares = shares - qty,
          realized_pnl = realized_pnl + pnl,
          closed_qty = closed_qty + qty,
          closed_value = closed_value + qty * p_price,
          status = case when shares - qty = 0 then 'closed' else 'open' end,
          closed_at = case when shares - qty = 0 then coalesce(p_executed_at, now()) else closed_at end
      where id = pos.id returning * into pos;
    if p_type = 'reduce' and pos.shares = 0 then p_type := 'close'; end if;
  else
    raise exception 'Unknown transaction type %', p_type;
  end if;

  insert into public.sim_transactions (position_id, user_id, type, shares, price, realized_pnl, executed_at, note)
  values (pos.id, auth.uid(), p_type, qty, p_price, pnl, coalesce(p_executed_at, now()), p_note);
  return pos;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Shared research / thesis notes per ticker (+ edit history)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.research_notes (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  section text not null check (section in ('bull','bear','catalysts','risks','valuation','technical','links','general')),
  content text not null default '' check (char_length(content) <= 20000),
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, section)
);

create table if not exists public.research_note_history (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.research_notes (id) on delete cascade,
  symbol text not null,
  section text not null,
  content text not null,
  edited_by uuid references public.profiles (id) on delete set null,
  edited_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_research_history_note on public.research_note_history (note_id, edited_at desc);

create or replace function public.log_research_note_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.content is distinct from old.content then
    insert into public.research_note_history (note_id, symbol, section, content, edited_by, edited_at)
    values (old.id, old.symbol, old.section, old.content, old.updated_by, old.updated_at);
  end if;
  return new;
end;
$$;
drop trigger if exists log_research_note_history on public.research_notes;
create trigger log_research_note_history after update on public.research_notes
  for each row execute function public.log_research_note_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Annotations on external events (USER analysis: priority, note, bookmark)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.event_annotations (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (char_length(event_key) <= 200),
  event jsonb not null default '{}'::jsonb,
  priority text check (priority in ('low','medium','high','critical')),
  note text check (char_length(note) <= 4000),
  bookmarked boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Notification preferences
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.notification_prefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Shared cache for public external data (normalized SEC / news / FDA / policy / macro)
--    Written by Netlify Functions using the signed-in member's JWT. Headlines/metadata only.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.intel_cache (
  key text primary key check (char_length(key) <= 300),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists idx_intel_cache_expires on public.intel_cache (expires_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Morning briefings (structured snapshots, one per user per day per kind)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  briefing_date date not null,
  kind text not null default 'morning' check (kind in ('morning','eod')),
  generated_at timestamptz not null default now(),
  data_refreshed_at timestamptz,
  sources jsonb not null default '[]'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, briefing_date, kind)
);
create index if not exists idx_briefings_user_date on public.briefings (user_id, briefing_date desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Prediction tracker (USER predictions; locked once resolved; full history)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  symbol text check (symbol is null or symbol ~ '^[A-Z0-9.\-]{1,12}$'),
  title text not null check (char_length(title) between 1 and 200),
  prediction_type text not null default 'custom' check (prediction_type in
    ('price_target','direction','earnings_reaction','catalyst_outcome','fda_outcome','sec_financing_outcome',
     'macro_reaction','short_thesis','long_thesis','volatility','custom')),
  direction text not null check (direction in ('bullish','bearish','neutral','volatility')),
  expected_move numeric(8,2),
  target_price numeric(16,4),
  downside_price numeric(16,4),
  time_horizon text,
  catalyst text,
  prediction_date date not null default current_date,
  resolution_date date,
  confidence integer not null check (confidence between 0 and 100),
  thesis text,
  invalidation text,
  notes text,
  baseline_price numeric(16,4),
  baseline_source text,
  baseline_at timestamptz,
  status text not null default 'open' check (status in ('open','correct','partial','incorrect','invalidated','expired')),
  actual_outcome text,
  actual_move numeric(8,2),
  actual_price numeric(16,4),
  actual_price_source text,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  result_notes text,
  lesson text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_predictions_status on public.predictions (status, resolution_date);
create index if not exists idx_predictions_symbol on public.predictions (symbol);

create table if not exists public.prediction_history (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions (id) on delete cascade,
  change_type text not null check (change_type in ('create','edit','resolve','note')),
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  old_values jsonb,
  new_values jsonb
);
create index if not exists idx_prediction_history on public.prediction_history (prediction_id, changed_at);

create table if not exists public.prediction_links (
  id uuid primary key default gen_random_uuid(),
  prediction_id uuid not null references public.predictions (id) on delete cascade,
  link_type text not null check (link_type in ('trade_idea','position','catalyst','event','news','filing','research')),
  ref_id text not null check (char_length(ref_id) <= 300),
  label text check (char_length(label) <= 300),
  url text check (url is null or url ~* '^https?://' or url ~ '^/'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_prediction_links on public.prediction_links (prediction_id);

-- Core fields are locked once a prediction is resolved; resolution can only happen once;
-- created_at / created_by / baseline can never change. Every change is logged.
create or replace function public.guard_prediction_update()
returns trigger language plpgsql as $$
declare
  core_changed boolean := (
    new.symbol is distinct from old.symbol or new.title is distinct from old.title or
    new.prediction_type is distinct from old.prediction_type or new.direction is distinct from old.direction or
    new.expected_move is distinct from old.expected_move or new.target_price is distinct from old.target_price or
    new.downside_price is distinct from old.downside_price or new.time_horizon is distinct from old.time_horizon or
    new.catalyst is distinct from old.catalyst or new.prediction_date is distinct from old.prediction_date or
    new.resolution_date is distinct from old.resolution_date or new.confidence is distinct from old.confidence or
    new.thesis is distinct from old.thesis or new.invalidation is distinct from old.invalidation);
  resolution_changed boolean := (
    new.status is distinct from old.status or new.actual_outcome is distinct from old.actual_outcome or
    new.actual_move is distinct from old.actual_move or new.actual_price is distinct from old.actual_price or
    new.actual_price_source is distinct from old.actual_price_source or new.resolved_at is distinct from old.resolved_at);
begin
  if new.created_at is distinct from old.created_at or new.created_by is distinct from old.created_by
     or new.baseline_price is distinct from old.baseline_price or new.baseline_at is distinct from old.baseline_at
     or new.baseline_source is distinct from old.baseline_source then
    raise exception 'created_at, created_by and baseline values are immutable';
  end if;
  if old.status <> 'open' and (core_changed or resolution_changed) then
    raise exception 'This prediction is resolved and locked. Add notes or a lesson instead.';
  end if;
  if resolution_changed and new.status = 'open' then
    raise exception 'Resolve a prediction with a final status (correct, partial, incorrect, invalidated or expired).';
  end if;
  if resolution_changed then
    new.resolved_at := coalesce(new.resolved_at, now());
    new.resolved_by := auth.uid();
  end if;
  return new;
end;
$$;
drop trigger if exists guard_prediction_update on public.predictions;
create trigger guard_prediction_update before update on public.predictions
  for each row execute function public.guard_prediction_update();

create or replace function public.log_prediction_history()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  core_keys text[] := array['symbol','title','prediction_type','direction','expected_move','target_price','downside_price',
                            'time_horizon','catalyst','prediction_date','resolution_date','confidence','thesis','invalidation','notes'];
  res_keys text[] := array['status','actual_outcome','actual_move','actual_price','actual_price_source','resolved_at'];
  note_keys text[] := array['result_notes','lesson','notes'];
  o jsonb; n jsonb; old_c jsonb := '{}'; new_c jsonb := '{}'; k text; kind text;
begin
  if tg_op = 'INSERT' then
    insert into public.prediction_history (prediction_id, change_type, changed_by, new_values)
    values (new.id, 'create', new.created_by, to_jsonb(new) - 'updated_at');
    return new;
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  foreach k in array core_keys || res_keys || array['result_notes','lesson'] loop
    if (o -> k) is distinct from (n -> k) then
      old_c := old_c || jsonb_build_object(k, o -> k);
      new_c := new_c || jsonb_build_object(k, n -> k);
    end if;
  end loop;
  if old_c = '{}'::jsonb then return new; end if;
  kind := case
    when (select bool_or(old_c ? r) from unnest(res_keys) r) then 'resolve'
    when (select bool_and(k2 = any(note_keys)) from jsonb_object_keys(old_c) k2) then 'note'
    else 'edit' end;
  insert into public.prediction_history (prediction_id, change_type, changed_by, old_values, new_values)
  values (new.id, kind, auth.uid(), old_c, new_c);
  return new;
end;
$$;
drop trigger if exists log_prediction_insert on public.predictions;
create trigger log_prediction_insert after insert on public.predictions
  for each row execute function public.log_prediction_history();
drop trigger if exists log_prediction_update on public.predictions;
create trigger log_prediction_update after update on public.predictions
  for each row execute function public.log_prediction_history();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sim_accounts','sim_positions','research_notes','event_annotations','notification_prefs','briefings','predictions']
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Row Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.sim_accounts          enable row level security;
alter table public.sim_positions         enable row level security;
alter table public.sim_transactions      enable row level security;
alter table public.research_notes        enable row level security;
alter table public.research_note_history enable row level security;
alter table public.event_annotations     enable row level security;
alter table public.notification_prefs    enable row level security;
alter table public.intel_cache           enable row level security;
alter table public.briefings             enable row level security;
alter table public.predictions           enable row level security;
alter table public.prediction_history    enable row level security;
alter table public.prediction_links      enable row level security;

-- sim_accounts: both can read, each manages their own
drop policy if exists sim_accounts_select on public.sim_accounts;
create policy sim_accounts_select on public.sim_accounts for select to authenticated using (public.is_member());
drop policy if exists sim_accounts_write on public.sim_accounts;
create policy sim_accounts_write on public.sim_accounts for all to authenticated
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid() and public.is_member());

-- sim_positions: shared visibility, owner writes
drop policy if exists sim_positions_select on public.sim_positions;
create policy sim_positions_select on public.sim_positions for select to authenticated using (public.is_member());
drop policy if exists sim_positions_insert on public.sim_positions;
create policy sim_positions_insert on public.sim_positions for insert to authenticated
  with check (owner_id = auth.uid() and public.is_member());
drop policy if exists sim_positions_update on public.sim_positions;
create policy sim_positions_update on public.sim_positions for update to authenticated
  using (owner_id = auth.uid() and public.is_member()) with check (owner_id = auth.uid());
drop policy if exists sim_positions_delete on public.sim_positions;
create policy sim_positions_delete on public.sim_positions for delete to authenticated
  using (owner_id = auth.uid() and public.is_member());

-- sim_transactions: append-only ledger
drop policy if exists sim_tx_select on public.sim_transactions;
create policy sim_tx_select on public.sim_transactions for select to authenticated using (public.is_member());
drop policy if exists sim_tx_insert on public.sim_transactions;
create policy sim_tx_insert on public.sim_transactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member()
              and exists (select 1 from public.sim_positions p where p.id = position_id and p.owner_id = auth.uid()));

-- research notes: collaborative
drop policy if exists research_select on public.research_notes;
create policy research_select on public.research_notes for select to authenticated using (public.is_member());
drop policy if exists research_insert on public.research_notes;
create policy research_insert on public.research_notes for insert to authenticated
  with check (public.is_member() and updated_by = auth.uid());
drop policy if exists research_update on public.research_notes;
create policy research_update on public.research_notes for update to authenticated
  using (public.is_member()) with check (public.is_member() and updated_by = auth.uid());
drop policy if exists research_history_select on public.research_note_history;
create policy research_history_select on public.research_note_history for select to authenticated using (public.is_member());

-- event annotations: shared workspace analysis
drop policy if exists annotations_all on public.event_annotations;
create policy annotations_all on public.event_annotations for all to authenticated
  using (public.is_member()) with check (public.is_member() and updated_by = auth.uid());

-- notification prefs: private
drop policy if exists notif_prefs_all on public.notification_prefs;
create policy notif_prefs_all on public.notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member());

-- intel cache: members only
drop policy if exists intel_cache_select on public.intel_cache;
create policy intel_cache_select on public.intel_cache for select to authenticated using (public.is_member());
drop policy if exists intel_cache_insert on public.intel_cache;
create policy intel_cache_insert on public.intel_cache for insert to authenticated with check (public.is_member());
drop policy if exists intel_cache_update on public.intel_cache;
create policy intel_cache_update on public.intel_cache for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists intel_cache_delete on public.intel_cache;
create policy intel_cache_delete on public.intel_cache for delete to authenticated using (public.is_member() and expires_at < now());

-- briefings: both can read, each writes their own
drop policy if exists briefings_select on public.briefings;
create policy briefings_select on public.briefings for select to authenticated using (public.is_member());
drop policy if exists briefings_write on public.briefings;
create policy briefings_write on public.briefings for all to authenticated
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid() and public.is_member());

-- predictions: both can read; only the author edits/resolves; delete only within 1 hour of creation (typo window)
drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions for select to authenticated using (public.is_member());
drop policy if exists predictions_insert on public.predictions;
create policy predictions_insert on public.predictions for insert to authenticated
  with check (created_by = auth.uid() and public.is_member());
drop policy if exists predictions_update on public.predictions;
create policy predictions_update on public.predictions for update to authenticated
  using (created_by = auth.uid() and public.is_member()) with check (created_by = auth.uid());
drop policy if exists predictions_delete on public.predictions;
create policy predictions_delete on public.predictions for delete to authenticated
  using (created_by = auth.uid() and status = 'open' and created_at > now() - interval '1 hour');

drop policy if exists prediction_history_select on public.prediction_history;
create policy prediction_history_select on public.prediction_history for select to authenticated using (public.is_member());

drop policy if exists prediction_links_select on public.prediction_links;
create policy prediction_links_select on public.prediction_links for select to authenticated using (public.is_member());
drop policy if exists prediction_links_insert on public.prediction_links;
create policy prediction_links_insert on public.prediction_links for insert to authenticated
  with check (created_by = auth.uid() and public.is_member());
drop policy if exists prediction_links_delete on public.prediction_links;
create policy prediction_links_delete on public.prediction_links for delete to authenticated
  using (created_by = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPC permissions + realtime
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on function public.sim_open_position(text, text, numeric, numeric, date, numeric, numeric, text, text, text, uuid) from public, anon;
revoke all on function public.sim_apply_transaction(uuid, text, numeric, numeric, text, timestamptz) from public, anon;
grant execute on function public.sim_open_position(text, text, numeric, numeric, date, numeric, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.sim_apply_transaction(uuid, text, numeric, numeric, text, timestamptz) to authenticated;

do $$
declare t text;
begin
  foreach t in array array['sim_positions','sim_transactions','research_notes','event_annotations','briefings',
                           'predictions','prediction_history','prediction_links','sim_accounts']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Done. No existing table, policy or row was modified.
