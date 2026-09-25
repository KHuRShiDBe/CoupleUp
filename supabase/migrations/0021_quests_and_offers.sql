-- CoupleUp migration 0021: Quest system (daily/weekly/monthly/yearly quests +
-- daily bonus milestones) + couple offers (partner-to-partner priced
-- proposals with counter-offer negotiation).
--
-- Purely additive: no existing table, column, or function is touched. The
-- old daily_action_completions/daily_progress system (migration 0019) keeps
-- working exactly as-is -- this is a parallel, more general system that the
-- new Rewards screen uses instead going forward.
--
-- ============================================================================
-- 1. quest_progress -- one row per (couple, period, period_key, item) that
--    was actually completed. Which items apply on a given day/week/month/
--    year is never stored -- it's deterministic client-side content (see
--    src/constants/questSelection.ts, seeded by couple_id + period + key),
--    same "static content, real completion state" split as daily_action_*.
--    title/points are denormalized onto the row itself (same as actions.*
--    everywhere else) so a custom user-added item never needs a server-side
--    price lookup.
-- ============================================================================

create table if not exists public.quest_progress (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  period_key text not null,
  item_key text not null,
  title text not null,
  points int not null check (points > 0),
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (couple_id, period, period_key, item_key)
);

alter table public.quest_progress enable row level security;

drop policy if exists "quest_progress_select_member" on public.quest_progress;
create policy "quest_progress_select_member" on public.quest_progress
  for select using (public.is_couple_member(couple_id));

-- No insert policy for clients -- only complete_quest_item() below writes
-- here, so "same item twice" can't be bypassed by calling the table directly.

grant usage on schema public to authenticated;
grant select on public.quest_progress to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quest_progress') then
    alter publication supabase_realtime add table public.quest_progress;
  end if;
end $$;

-- ============================================================================
-- 1b. quest_custom_items -- user-added quests, PENDING (not yet completed).
--    System-pool quests need no such table (their existence is deterministic
--    client-side content, see questSelection.ts); a custom item has no pool
--    entry, so it needs somewhere to live between "added" and "completed".
--    Plain client-writable insert (same trust level as couple_offers/
--    reward_requests) -- price is only ever paid out once, through
--    complete_quest_item() below, same as every pool item.
-- ============================================================================

create table if not exists public.quest_custom_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  period_key text not null,
  item_key text not null,
  title text not null,
  points int not null check (points > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (couple_id, period, period_key, item_key)
);

alter table public.quest_custom_items enable row level security;

drop policy if exists "quest_custom_items_select_member" on public.quest_custom_items;
create policy "quest_custom_items_select_member" on public.quest_custom_items
  for select using (public.is_couple_member(couple_id));

drop policy if exists "quest_custom_items_insert_member" on public.quest_custom_items;
create policy "quest_custom_items_insert_member" on public.quest_custom_items
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());

grant select, insert on public.quest_custom_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quest_custom_items') then
    alter publication supabase_realtime add table public.quest_custom_items;
  end if;
end $$;

-- ============================================================================
-- 2. quest_bonus_claims -- one row per (couple, period, period_key, milestone)
--    that has already been paid out. Table is period-generic even though the
--    only milestones defined today (src/constants/questEconomy.ts) are daily.
-- ============================================================================

create table if not exists public.quest_bonus_claims (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  period_key text not null,
  milestone int not null,
  points int not null check (points > 0),
  claimed_at timestamptz not null default now(),
  unique (couple_id, period, period_key, milestone)
);

alter table public.quest_bonus_claims enable row level security;

drop policy if exists "quest_bonus_claims_select_member" on public.quest_bonus_claims;
create policy "quest_bonus_claims_select_member" on public.quest_bonus_claims
  for select using (public.is_couple_member(couple_id));

-- No insert policy for clients -- only claim_quest_bonus() below writes here.

grant select on public.quest_bonus_claims to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quest_bonus_claims') then
    alter publication supabase_realtime add table public.quest_bonus_claims;
  end if;
end $$;

-- ============================================================================
-- 3. couple_offers -- "I propose <title> for <price_points>". Plain
--    client-writable insert (same pattern as reward_requests in 0001_init):
--    the payout only ever happens through respond_couple_offer /
--    respond_couple_offer_counter below, so a forged insert can't move points
--    on its own.
-- ============================================================================

create table if not exists public.couple_offers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  price_points int not null check (price_points > 0),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.couple_offers enable row level security;

drop policy if exists "couple_offers_select_member" on public.couple_offers;
create policy "couple_offers_select_member" on public.couple_offers
  for select using (public.is_couple_member(couple_id));

drop policy if exists "couple_offers_insert_member" on public.couple_offers;
create policy "couple_offers_insert_member" on public.couple_offers
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());

-- No update policy for clients -- status only ever changes via the RPCs
-- below (respond_couple_offer / respond_couple_offer_counter), both
-- security definer, so "accept my own offer" can't be forged.

grant select, insert on public.couple_offers to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_offers') then
    alter publication supabase_realtime add table public.couple_offers;
  end if;
end $$;

-- ============================================================================
-- 4. couple_offer_counters -- the haggle thread for a couple_offer. Direct
--    structural copy of purchase_request_offers (migration 0020): a new
--    counter auto-supersedes any still-pending one, so there's only ever one
--    live counter per offer at a time.
-- ============================================================================

create table if not exists public.couple_offer_counters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  offer_id uuid not null references public.couple_offers(id) on delete cascade,
  proposed_by uuid references public.profiles(id) on delete set null,
  price_points int not null check (price_points > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'superseded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.couple_offer_counters enable row level security;

drop policy if exists "couple_offer_counters_select_member" on public.couple_offer_counters;
create policy "couple_offer_counters_select_member" on public.couple_offer_counters
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy for clients -- only the two RPCs below (both
-- security definer) can write here.

grant select on public.couple_offer_counters to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_offer_counters') then
    alter publication supabase_realtime add table public.couple_offer_counters;
  end if;
end $$;

-- ============================================================================
-- 5. complete_quest_item -- guarded by quest_progress's own unique
--    (couple_id, period, period_key, item_key): a second call for the same
--    item is a no-op (returns false), never a second payout.
-- ============================================================================

create or replace function public.complete_quest_item(
  p_couple_id uuid,
  p_period text,
  p_period_key text,
  p_item_key text,
  p_title text,
  p_points int
)
returns boolean
language plpgsql
security definer
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.quest_progress (couple_id, period, period_key, item_key, title, points, completed_by)
  values (p_couple_id, p_period, p_period_key, p_item_key, p_title, p_points, auth.uid());

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, 'action');

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 6. claim_quest_bonus -- re-counts the ACTUAL completed quest_progress rows
--    for (couple, period, period_key) server-side before paying (never
--    trusts the client's "X done"), guarded against double-pay by the
--    unique (couple_id, period, period_key, milestone) constraint.
-- ============================================================================

create or replace function public.claim_quest_bonus(
  p_couple_id uuid,
  p_period text,
  p_period_key text,
  p_milestone int,
  p_bonus_points int,
  p_title text
)
returns boolean
language plpgsql
security definer
as $$
declare
  actual_count int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select count(*) into actual_count
  from public.quest_progress
  where couple_id = p_couple_id and period = p_period and period_key = p_period_key;

  if actual_count < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  insert into public.quest_bonus_claims (couple_id, period, period_key, milestone, points)
  values (p_couple_id, p_period, p_period_key, p_milestone, p_bonus_points);

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_bonus_points, 'action');

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 7. respond_couple_offer -- only the partner who did NOT create the offer
--    may accept/decline its original price (same "other party responds"
--    rule as respond_reward_request). Accepting pays nothing by itself --
--    the offer becoming an accepted item is what the app surfaces as
--    "partner's wishes"; points only move when the underlying quest/action
--    it represents is actually completed elsewhere.
-- ============================================================================

create or replace function public.respond_couple_offer(p_offer_id uuid, p_accept boolean)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if o.created_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if o.status <> 'pending' then
    return o;
  end if;

  update public.couple_offers
  set status = case when p_accept then 'accepted' else 'declined' end,
      resolved_at = now()
  where id = p_offer_id
  returning * into o;

  return o;
end;
$$;

-- ============================================================================
-- 8. propose_couple_offer_counter -- only the partner who did NOT create the
--    offer may propose a different price, only while the offer is pending.
-- ============================================================================

create or replace function public.propose_couple_offer_counter(
  p_offer_id uuid,
  p_price_points int,
  p_note text default null
)
returns public.couple_offer_counters
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
  c public.couple_offer_counters;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if o.created_by = auth.uid() then
    raise exception 'CANNOT_COUNTER_OWN_OFFER';
  end if;
  if o.status <> 'pending' then
    raise exception 'OFFER_NOT_PENDING';
  end if;
  if p_price_points is null or p_price_points <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  update public.couple_offer_counters
  set status = 'superseded', resolved_at = now()
  where offer_id = p_offer_id and status = 'pending';

  insert into public.couple_offer_counters (couple_id, offer_id, proposed_by, price_points, note)
  values (o.couple_id, p_offer_id, auth.uid(), p_price_points, p_note)
  returning * into c;

  return c;
end;
$$;

-- ============================================================================
-- 9. respond_couple_offer_counter -- only the ORIGINAL PROPOSER of the
--    parent offer may accept/decline a counter. Accepting atomically
--    re-prices AND accepts the parent offer in the same transaction.
-- ============================================================================

create or replace function public.respond_couple_offer_counter(p_counter_id uuid, p_accept boolean)
returns public.couple_offer_counters
language plpgsql
security definer
as $$
declare
  c public.couple_offer_counters;
  o public.couple_offers;
begin
  select * into c from public.couple_offer_counters where id = p_counter_id for update;
  if c.id is null then
    raise exception 'COUNTER_NOT_FOUND';
  end if;
  if not public.is_couple_member(c.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into o from public.couple_offers where id = c.offer_id for update;

  if auth.uid() <> o.created_by then
    raise exception 'NOT_PROPOSER';
  end if;
  if c.status <> 'pending' then
    return c;
  end if;

  if p_accept then
    if o.status <> 'pending' then
      raise exception 'OFFER_NOT_PENDING';
    end if;

    update public.couple_offers
    set price_points = c.price_points, status = 'accepted', resolved_at = now()
    where id = o.id;

    update public.couple_offer_counters
    set status = 'accepted', resolved_at = now()
    where id = p_counter_id
    returning * into c;
  else
    update public.couple_offer_counters
    set status = 'declined', resolved_at = now()
    where id = p_counter_id
    returning * into c;
  end if;

  return c;
end;
$$;
