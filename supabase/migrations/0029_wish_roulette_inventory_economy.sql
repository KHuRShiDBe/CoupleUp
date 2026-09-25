-- CoupleUp migration 0029: Wish Roulette economy redesign.
--
-- Problem this fixes: at the new 10 BOND spin cost, every prize on the wheel
-- was still auto-credited as real BOND, and the cheapest prize (50 BOND) was
-- already 5x the cost -- every spin was guaranteed to increase the balance.
--
-- New model (confirmed with the user):
--   - Spin still costs 10 BOND, always debited.
--   - 18 of the 20 sectors per wheel are WISHES: they no longer touch BOND
--     at all. Winning one only records it in the new `wish_inventory` table
--     (status='available') for later use -- nothing here builds a
--     redeem/use flow yet, this migration only stops the balance leak and
--     starts capturing what was won.
--   - The remaining 2 sectors per wheel (the x10 tier -- already thematically
--     "money": Джекпот / Главный приз / Шоппинг) stay real BOND prizes, set
--     to 50 BOND each (5x the spin cost, expected payout of the whole wheel
--     is now ~1.02 BOND against a 10 BOND cost -- no scenario increases the
--     balance on average).
--   - Gender is now read from the caller's own `profiles.role` server-side
--     instead of trusting the `p_gender` argument -- the argument is kept
--     for signature/client compatibility but no longer used to pick the pool.
--   - A per-user advisory lock serializes concurrent spins from the same
--     account, so two near-simultaneous calls (double-tap bypassing the
--     client guard, or a network retry) can never both pass the balance
--     check against the same pre-spin balance.
--   - A client-supplied `p_client_request_id` (fresh UUID per app-level spin
--     attempt) makes the RPC idempotent: if this exact request id was
--     already processed -- e.g. the client's first call succeeded but the
--     response was lost and got retried -- the RPC returns the SAME
--     original result instead of spinning/charging again. The advisory lock
--     alone only stops two calls racing each other; it does nothing for a
--     retry that arrives after the first call already committed and
--     released the lock, which is what this closes. The idempotency lookup
--     is scoped to `spun_by = auth.uid() and couple_id = p_couple_id` -- a
--     request_id belonging to someone else (or another couple) never
--     matches, so it can't be replayed to fetch a result without paying.
--   - `set search_path = public, pg_temp` on the function itself: standard
--     hardening for SECURITY DEFINER functions so it can't be tricked by a
--     caller-controlled search_path into resolving an unqualified name to a
--     rogue object. (Every table/function reference inside was already
--     schema-qualified, so this is defense in depth, not a behavior fix.)
--
-- Does NOT touch: existing rows in `actions`, `wish_roulette_results`,
-- History, or the wheel's weights/probabilities/keys/titles -- only what
-- happens to the balance after a sector is chosen.
--
-- Safe to re-run: table creation is IF NOT EXISTS, the function is
-- CREATE OR REPLACE, no column or row is ever dropped.

-- ============================================================================
-- 1. wish_inventory -- one row per won, not-yet-cash wish prize.
--    Couple-visible (the partner needs to see what's owed/available), but
--    only the RPC below (security definer) may write to it.
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

-- No insert/update policy for clients -- only spin_wish_roulette (security
-- definer) writes here, so a client can never forge or edit a won wish.

grant usage on schema public to authenticated;
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
-- 2. wish_roulette_results gains an idempotency key. Nullable + a PARTIAL
--    unique index (only enforced when not null) so every row inserted by
--    migration 0024/0028 keeps working untouched -- this never rewrites or
--    drops a single existing row.
-- ============================================================================

alter table public.wish_roulette_results add column if not exists client_request_id uuid;

create unique index if not exists wish_roulette_results_client_request_id_key
  on public.wish_roulette_results (client_request_id)
  where client_request_id is not null;

-- ============================================================================
-- 3. spin_wish_roulette -- REPLACES migration 0028. Same pool, same weights,
--    same balance source (public.actions, recipient_id = auth.uid() -- the
--    exact same query Home/Rewards/CoupleProfile already use, confirmed
--    identical, so this never diverges from what the app displays).
--
--    Signature changed (added p_client_request_id), so the OLD 2-argument
--    overload is dropped explicitly first -- CREATE OR REPLACE cannot change
--    a function's argument list, it would just add a second overload and
--    leave the vulnerable 2-arg version callable.
-- ============================================================================

drop function if exists public.spin_wish_roulette(uuid, text);

create or replace function public.spin_wish_roulette(p_couple_id uuid, p_gender text, p_client_request_id uuid)
returns table(item_key text, value_points int, cost_points int, balance_after int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate int;
  v_cost int;
  v_balance int;
  v_item_key text;
  v_value_bond int;
  v_is_money boolean;
  v_gender text;
  v_existing public.wish_roulette_results%rowtype;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID';
  end if;

  -- Serialize concurrent spins from the same account (double-tap that
  -- bypassed the client guard, a network retry, two devices signed into the
  -- same account) so they can never both read the same pre-spin balance.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  -- Idempotency check, inside the lock: if this exact request id was already
  -- processed BY THIS CALLER FOR THIS COUPLE, return the ORIGINAL result
  -- instead of spinning/charging a second time. Scoped to spun_by=auth.uid()
  -- and couple_id=p_couple_id so a request_id belonging to someone else (or
  -- to a different couple) is never treated as a match -- it falls through
  -- and pays for a real spin like any other unrecognized id, instead of
  -- handing back a cached result with no charge. Placed after the lock so
  -- two truly simultaneous replays of the same id can't both pass this
  -- check before either has inserted.
  select * into v_existing from public.wish_roulette_results
  where client_request_id = p_client_request_id
    and spun_by = auth.uid()
    and couple_id = p_couple_id;
  if found then
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a
    where a.couple_id = p_couple_id and a.recipient_id = auth.uid();
    return query select v_existing.item_key, v_existing.value_points, v_existing.cost_points, v_balance;
    return;
  end if;

  -- Gender is derived from the caller's own profile, never trusted from the
  -- client argument -- prevents a tampered p_gender from drawing the wrong
  -- wheel's pool.
  select role into v_gender from public.profiles where id = auth.uid();
  if v_gender not in ('male', 'female') then
    raise exception 'INVALID_GENDER';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 10 * v_rate;

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  if v_balance < v_cost then
    raise exception 'ROULETTE_NOT_ENOUGH_BOND';
  end if;

  with pool(pool_gender, pool_key, weight, value_bond, is_money) as (
    values
      -- male pool: 5 cheap (w8) + 5 almost-break-even (w6) + 5 at "1x" (w4) + 3 at "3x" (w2) -- all WISHES (is_money=false)
      -- + 2 at the top tier (w1) -- real BOND prizes (is_money=true)
      ('male'::text, 'm_tea_coffee'::text, 8::numeric, 1::int, false),
      ('male', 'm_treat', 8, 2, false),
      ('male', 'm_hugs', 8, 2, false),
      ('male', 'm_massage_10', 8, 2, false),
      ('male', 'm_walk', 8, 3, false),
      ('male', 'm_movie', 6, 6, false),
      ('male', 'm_favorite_dish', 6, 7, false),
      ('male', 'm_massage_20', 6, 8, false),
      ('male', 'm_evening_together', 6, 8, false),
      ('male', 'm_massage_30', 6, 9, false),
      ('male', 'm_dinner_choice', 4, 10, false),
      ('male', 'm_date', 4, 10, false),
      ('male', 'm_intimate_massage', 4, 10, false),
      ('male', 'm_special_closeness', 4, 10, false),
      ('male', 'm_intimate_evening', 4, 10, false),
      ('male', 'm_his_pose', 2, 30, false),
      ('male', 'm_special_scenario', 2, 30, false),
      ('male', 'm_big_day', 2, 30, false),
      ('male', 'm_jackpot', 1, 50, true),
      ('male', 'm_grand_prize', 1, 50, true),
      -- female pool: same 5/5/5/3/2 shape
      ('female', 'f_tea_coffee', 8, 1, false),
      ('female', 'f_chocolate', 8, 2, false),
      ('female', 'f_compliments', 8, 2, false),
      ('female', 'f_breakfast', 8, 2, false),
      ('female', 'f_cafe', 8, 3, false),
      ('female', 'f_foot_massage', 6, 6, false),
      ('female', 'f_movie', 6, 7, false),
      ('female', 'f_favorite_dish', 6, 8, false),
      ('female', 'f_flowers', 6, 8, false),
      ('female', 'f_massage_20', 6, 9, false),
      ('female', 'f_massage_30', 4, 10, false),
      ('female', 'f_dinner_choice', 4, 10, false),
      ('female', 'f_intimate_massage', 4, 10, false),
      ('female', 'f_special_closeness', 4, 10, false),
      ('female', 'f_date', 4, 10, false),
      ('female', 'f_intimate_evening', 2, 30, false),
      ('female', 'f_her_pose', 2, 30, false),
      ('female', 'f_big_day', 2, 30, false),
      ('female', 'f_jackpot', 1, 50, true),
      ('female', 'f_shopping', 1, 50, true)
  ),
  gendered as (
    select pool_key, weight, value_bond, is_money from pool where pool_gender = v_gender
  ),
  ranked as (
    select pool_key, value_bond, is_money,
           sum(weight) over (order by pool_key) as cum_weight,
           sum(weight) over () as total_weight
    from gendered
  ),
  roll as (
    select random() * max(total_weight) as r from ranked
  )
  select ranked.pool_key, ranked.value_bond, ranked.is_money into v_item_key, v_value_bond, v_is_money
  from ranked, roll
  where ranked.cum_weight >= roll.r
  order by ranked.cum_weight
  limit 1;

  if v_is_money then
    -- Real BOND prize: one net-delta row, same as before (win minus cost).
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка желаний: ' || v_item_key, (v_value_bond * v_rate) - v_cost, 'reward');
  else
    -- Wish prize: only the stake is debited -- the win itself is banked in
    -- wish_inventory, never converted to BOND.
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка желаний: ставка', -v_cost, 'reward');

    insert into public.wish_inventory (couple_id, owner_id, gender, item_key)
    values (p_couple_id, auth.uid(), v_gender, v_item_key);
  end if;

  insert into public.wish_roulette_results (couple_id, spun_by, gender, item_key, value_points, cost_points, client_request_id)
  values (p_couple_id, auth.uid(), v_gender, v_item_key, v_value_bond * v_rate, v_cost, p_client_request_id);

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  return query select v_item_key, v_value_bond * v_rate, v_cost, v_balance;
end;
$$;

grant execute on function public.spin_wish_roulette(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
