-- CoupleUp migration 0027: personal BOND ledger + personal wish inventory.
--
-- Fully independent from public.actions / public.couples.points -- the
-- couple-wide ledger, its trigger, and every RPC that writes to it (quests,
-- agreements, daily actions, penalties, reward requests) are untouched by
-- this migration. This is a SECOND, separate personal wallet:
-- spin_wish_roulette below is rewritten to charge/pay ONLY this ledger, so a
-- spin can never move the shared "Баллы пары" total.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- 1. personal_bond_ledger -- one row per personal-balance event. Balance for
--    a user = sum(delta_points) where user_id = that user. Private: only the
--    owner may read their own rows (not even their partner) -- this is a
--    personal wallet, not couple-shared data.
-- ============================================================================

create table if not exists public.personal_bond_ledger (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta_points int not null,
  title text not null,
  type text not null check (type in ('roulette', 'test_credit')),
  created_at timestamptz not null default now()
);

alter table public.personal_bond_ledger enable row level security;

drop policy if exists "personal_bond_ledger_select_own" on public.personal_bond_ledger;
create policy "personal_bond_ledger_select_own" on public.personal_bond_ledger
  for select using (user_id = auth.uid());

-- No insert/update/delete policy for clients -- only spin_wish_roulette
-- (security definer) writes here during normal use; the one-off test credit
-- at the bottom of this file is applied directly by you in the SQL editor.

grant usage on schema public to authenticated;
grant select on public.personal_bond_ledger to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'personal_bond_ledger'
  ) then
    alter publication supabase_realtime add table public.personal_bond_ledger;
  end if;
end $$;

-- ============================================================================
-- 2. wish_inventory -- one row per WON item that hasn't been discarded yet.
--    Never deleted, only status-transitioned (available -> pending_use ->
--    used, or pending_use -> available again on decline) -- a saved reward
--    must never silently disappear. Couple-visible (unlike the ledger
--    above): the partner needs to see and respond to a pending_use request.
-- ============================================================================

create table if not exists public.wish_inventory (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  gender text not null check (gender in ('male', 'female')),
  item_key text not null,
  status text not null default 'available' check (status in ('available', 'pending_use', 'used')),
  won_at timestamptz not null default now(),
  requested_at timestamptz,
  used_at timestamptz
);

alter table public.wish_inventory enable row level security;

drop policy if exists "wish_inventory_select_member" on public.wish_inventory;
create policy "wish_inventory_select_member" on public.wish_inventory
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy for clients -- only the three RPCs below (all
-- security definer) can write here.

grant select on public.wish_inventory to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wish_inventory'
  ) then
    alter publication supabase_realtime add table public.wish_inventory;
  end if;
end $$;

-- ============================================================================
-- 3. spin_wish_roulette -- REPLACES the 0024 version. Same weighted pool,
--    same 500 BOND cost, same server-side draw -- the only change is WHERE
--    the balance check and the debit/credit are written: personal_bond_ledger
--    instead of public.actions, so a spin can never touch couples.points.
-- ============================================================================

create or replace function public.spin_wish_roulette(p_couple_id uuid, p_gender text)
returns table(item_key text, value_points int, cost_points int, balance_after int)
language plpgsql
security definer
as $$
declare
  v_rate int;
  v_cost int;
  v_balance int;
  v_item_key text;
  v_value_bond int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_gender not in ('male', 'female') then
    raise exception 'INVALID_GENDER';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 500 * v_rate;

  select coalesce(sum(l.delta_points), 0) into v_balance
  from public.personal_bond_ledger l
  where l.couple_id = p_couple_id and l.user_id = auth.uid();

  if v_balance < v_cost then
    raise exception 'ROULETTE_NOT_ENOUGH_BOND';
  end if;

  with pool(pool_gender, pool_key, weight, value_bond) as (
    values
      ('male'::text, 'm_tea_coffee'::text, 8::numeric, 50::int),
      ('male', 'm_treat', 8, 80),
      ('male', 'm_hugs', 8, 100),
      ('male', 'm_massage_10', 8, 120),
      ('male', 'm_walk', 8, 150),
      ('male', 'm_movie', 6, 300),
      ('male', 'm_favorite_dish', 6, 350),
      ('male', 'm_massage_20', 6, 380),
      ('male', 'm_evening_together', 6, 400),
      ('male', 'm_massage_30', 6, 450),
      ('male', 'm_dinner_choice', 4, 500),
      ('male', 'm_date', 4, 500),
      ('male', 'm_intimate_massage', 4, 500),
      ('male', 'm_special_closeness', 4, 500),
      ('male', 'm_intimate_evening', 4, 500),
      ('male', 'm_his_pose', 2, 1500),
      ('male', 'm_special_scenario', 2, 1500),
      ('male', 'm_big_day', 2, 1500),
      ('male', 'm_jackpot', 1, 5000),
      ('male', 'm_grand_prize', 1, 5000),
      ('female', 'f_tea_coffee', 8, 50),
      ('female', 'f_chocolate', 8, 80),
      ('female', 'f_compliments', 8, 100),
      ('female', 'f_breakfast', 8, 120),
      ('female', 'f_cafe', 8, 150),
      ('female', 'f_foot_massage', 6, 300),
      ('female', 'f_movie', 6, 350),
      ('female', 'f_favorite_dish', 6, 380),
      ('female', 'f_flowers', 6, 400),
      ('female', 'f_massage_20', 6, 450),
      ('female', 'f_massage_30', 4, 500),
      ('female', 'f_dinner_choice', 4, 500),
      ('female', 'f_intimate_massage', 4, 500),
      ('female', 'f_special_closeness', 4, 500),
      ('female', 'f_date', 4, 500),
      ('female', 'f_intimate_evening', 2, 1500),
      ('female', 'f_her_pose', 2, 1500),
      ('female', 'f_big_day', 2, 1500),
      ('female', 'f_jackpot', 1, 5000),
      ('female', 'f_shopping', 1, 5000)
  ),
  gendered as (
    select pool_key, weight, value_bond from pool where pool_gender = p_gender
  ),
  ranked as (
    select pool_key, value_bond,
           sum(weight) over (order by pool_key) as cum_weight,
           sum(weight) over () as total_weight
    from gendered
  ),
  roll as (
    select random() * max(total_weight) as r from ranked
  )
  select ranked.pool_key, ranked.value_bond into v_item_key, v_value_bond
  from ranked, roll
  where ranked.cum_weight >= roll.r
  order by ranked.cum_weight
  limit 1;

  insert into public.personal_bond_ledger (couple_id, user_id, delta_points, title, type)
  values (p_couple_id, auth.uid(), (v_value_bond * v_rate) - v_cost, 'Рулетка желаний: ' || v_item_key, 'roulette');

  select coalesce(sum(l.delta_points), 0) into v_balance
  from public.personal_bond_ledger l
  where l.couple_id = p_couple_id and l.user_id = auth.uid();

  return query select v_item_key, v_value_bond * v_rate, v_cost, v_balance;
end;
$$;

grant execute on function public.spin_wish_roulette(uuid, text) to authenticated;

-- ============================================================================
-- 4. add_wish_to_inventory -- called right after the result modal, based on
--    which button the player pressed. use_now=true goes straight to
--    'pending_use' (pressing "use now" sends a request to the partner, it
--    isn't an instant redemption -- confirmation still happens via
--    respond_inventory_use below); use_now=false stores it as 'available'.
-- ============================================================================

create or replace function public.add_wish_to_inventory(
  p_couple_id uuid,
  p_gender text,
  p_item_key text,
  p_use_now boolean
)
returns public.wish_inventory
language plpgsql
security definer
as $$
declare
  row_ public.wish_inventory;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_gender not in ('male', 'female') then
    raise exception 'INVALID_GENDER';
  end if;

  insert into public.wish_inventory (couple_id, owner_id, gender, item_key, status, requested_at)
  values (
    p_couple_id, auth.uid(), p_gender, p_item_key,
    case when p_use_now then 'pending_use' else 'available' end,
    case when p_use_now then now() else null end
  )
  returning * into row_;

  return row_;
end;
$$;

grant execute on function public.add_wish_to_inventory(uuid, text, text, boolean) to authenticated;

-- ============================================================================
-- 5. request_use_inventory_item -- activates a previously SAVED item from
--    the "Мои награды" screen. Only the owner may call, only while
--    'available'.
-- ============================================================================

create or replace function public.request_use_inventory_item(p_item_id uuid)
returns public.wish_inventory
language plpgsql
security definer
as $$
declare
  row_ public.wish_inventory;
begin
  select * into row_ from public.wish_inventory where id = p_item_id for update;
  if row_.id is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if auth.uid() <> row_.owner_id then
    raise exception 'NOT_OWNER';
  end if;
  if row_.status <> 'available' then
    raise exception 'ITEM_NOT_AVAILABLE';
  end if;

  update public.wish_inventory
  set status = 'pending_use', requested_at = now()
  where id = p_item_id
  returning * into row_;

  return row_;
end;
$$;

grant execute on function public.request_use_inventory_item(uuid) to authenticated;

-- ============================================================================
-- 6. respond_inventory_use -- only the PARTNER (never the owner) may
--    confirm/decline a pending_use request. Decline returns it to
--    'available' -- it is never deleted.
-- ============================================================================

create or replace function public.respond_inventory_use(p_item_id uuid, p_accept boolean)
returns public.wish_inventory
language plpgsql
security definer
as $$
declare
  row_ public.wish_inventory;
begin
  select * into row_ from public.wish_inventory where id = p_item_id for update;
  if row_.id is null then
    raise exception 'ITEM_NOT_FOUND';
  end if;
  if not public.is_couple_member(row_.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if auth.uid() = row_.owner_id then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if row_.status <> 'pending_use' then
    raise exception 'ITEM_NOT_PENDING';
  end if;

  update public.wish_inventory
  set status = case when p_accept then 'used' else 'available' end,
      used_at = case when p_accept then now() else null end,
      requested_at = case when p_accept then requested_at else null end
  where id = p_item_id
  returning * into row_;

  return row_;
end;
$$;

grant execute on function public.respond_inventory_use(uuid, boolean) to authenticated;

-- ============================================================================
-- 7. TEMPORARY: +1000 BOND personal test credit, current couple members
--    only, personal_bond_ledger ONLY -- never touches public.actions or
--    public.couples.points, so "Баллы пары" is guaranteed unaffected.
--    Idempotent: guarded by title, credited at most once per user.
-- ============================================================================

insert into public.personal_bond_ledger (couple_id, user_id, delta_points, title, type)
select
  cm.couple_id,
  cm.user_id,
  1000 * coalesce((select b.points_per_bond from public.bond_rates b order by b.effective_from desc limit 1), 100),
  'Тестовый личный баланс (временно)',
  'test_credit'
from public.couple_members cm
where not exists (
  select 1 from public.personal_bond_ledger l
  where l.user_id = cm.user_id and l.title = 'Тестовый личный баланс (временно)'
);
