-- CoupleUp migration 0031: roulette economy rework -- cheaper wish-roulette
-- spins, a "Джекпот" sector that now pays a free intimate-roulette coupon
-- instead of BOND, and a brand-new paid, server-enforced intimate roulette.
--
-- Confirmed with the user before writing this:
--   1. Wish roulette spin cost: 10 BOND -> 2 BOND (200 points at the current
--      100-points-per-BOND rate). Every other sector, weight, wish and the
--      "Шопинг"/"Главный приз" money prizes stay exactly as they are.
--   2. The "Джекпот" sector (m_jackpot / f_jackpot, one per gender, same
--      weight=1 as before) no longer credits 50 BOND -- it now grants one
--      intimate-roulette coupon, banked in the user's OWN wish_inventory
--      (owner_id = auth.uid()), same table the wish prizes already use --
--      no second inventory/balance system.
--   3. Intimate roulette gets a real, server-enforced cost for the first
--      time: 10 BOND per spin (5x the new 2-BOND wish-roulette cost, as
--      asked), OR one coupon instead of BOND if the caller has one and asks
--      to use it. Every spin costs something, including "spin again" --
--      re-rolling for a better outcome is not free, otherwise the price
--      would be meaningless.
--   4. Which specific intimate result comes up is still chosen client-side
--      (src/constants/intimateRoulette.ts) -- nothing of economic value is
--      attached to WHICH result lands, only to whether a spin was actually
--      paid for, and that part is now fully server-checked. This mirrors
--      migration 0022's own original reasoning ("nothing here worth
--      forging") -- still true for the qualitative result, no longer true
--      for the payment, which is why intimate_roulette_results loses its
--      client-writable insert policy below (only the new RPC may write to
--      it from here on).
--
-- Both new/changed RPCs run their whole body (balance or coupon check +
-- debit/consume + result insert) inside one function call -- Postgres rolls
-- back every statement in a function automatically if it raises partway
-- through, so a mid-operation server error can never leave a coupon
-- consumed, BOND debited, or a result recorded without the others: it's all
-- of it or none of it, same guarantee spin_wish_roulette already has.
--
-- Does NOT touch: existing wish_roulette_results/intimate_roulette_results
-- rows, History, wish_inventory rows already won, consent/settings tables,
-- or any wheel's existing wishes/weights/titles.
--
-- Safe to re-run: ALTER TABLE ... ADD COLUMN IF NOT EXISTS, CREATE OR
-- REPLACE FUNCTION, guarded DROP POLICY IF EXISTS -- no data is ever
-- dropped.

-- ============================================================================
-- 1. spin_wish_roulette -- same signature as migration 0029 (no drop needed,
--    CREATE OR REPLACE is enough since the argument list is unchanged).
--    Only two things change: the spin cost, and what the "Джекпот" sector
--    hands out. Every other pool row, weight and value is copied verbatim.
-- ============================================================================

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
  v_prize_kind text;
  v_gender text;
  v_existing public.wish_roulette_results%rowtype;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID';
  end if;

  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

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

  select role into v_gender from public.profiles where id = auth.uid();
  if v_gender not in ('male', 'female') then
    raise exception 'INVALID_GENDER';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 2 * v_rate;

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  if v_balance < v_cost then
    raise exception 'ROULETTE_NOT_ENOUGH_BOND';
  end if;

  -- prize_kind: 'wish' (saved to inventory, never BOND), 'money' (real BOND,
  -- same as before), or 'coupon' (saved to inventory as an intimate-roulette
  -- free-spin token, never BOND). Only m_jackpot/f_jackpot changed kind
  -- (money -> coupon); every other row, weight and value_bond is identical
  -- to migration 0029.
  with pool(pool_gender, pool_key, weight, value_bond, prize_kind) as (
    values
      ('male'::text, 'm_tea_coffee'::text, 8::numeric, 1::int, 'wish'::text),
      ('male', 'm_treat', 8, 2, 'wish'),
      ('male', 'm_hugs', 8, 2, 'wish'),
      ('male', 'm_massage_10', 8, 2, 'wish'),
      ('male', 'm_walk', 8, 3, 'wish'),
      ('male', 'm_movie', 6, 6, 'wish'),
      ('male', 'm_favorite_dish', 6, 7, 'wish'),
      ('male', 'm_massage_20', 6, 8, 'wish'),
      ('male', 'm_evening_together', 6, 8, 'wish'),
      ('male', 'm_massage_30', 6, 9, 'wish'),
      ('male', 'm_dinner_choice', 4, 10, 'wish'),
      ('male', 'm_date', 4, 10, 'wish'),
      ('male', 'm_intimate_massage', 4, 10, 'wish'),
      ('male', 'm_special_closeness', 4, 10, 'wish'),
      ('male', 'm_intimate_evening', 4, 10, 'wish'),
      ('male', 'm_his_pose', 2, 30, 'wish'),
      ('male', 'm_special_scenario', 2, 30, 'wish'),
      ('male', 'm_big_day', 2, 30, 'wish'),
      ('male', 'm_jackpot', 1, 0, 'coupon'),
      ('male', 'm_grand_prize', 1, 50, 'money'),
      ('female', 'f_tea_coffee', 8, 1, 'wish'),
      ('female', 'f_chocolate', 8, 2, 'wish'),
      ('female', 'f_compliments', 8, 2, 'wish'),
      ('female', 'f_breakfast', 8, 2, 'wish'),
      ('female', 'f_cafe', 8, 3, 'wish'),
      ('female', 'f_foot_massage', 6, 6, 'wish'),
      ('female', 'f_movie', 6, 7, 'wish'),
      ('female', 'f_favorite_dish', 6, 8, 'wish'),
      ('female', 'f_flowers', 6, 8, 'wish'),
      ('female', 'f_massage_20', 6, 9, 'wish'),
      ('female', 'f_massage_30', 4, 10, 'wish'),
      ('female', 'f_dinner_choice', 4, 10, 'wish'),
      ('female', 'f_intimate_massage', 4, 10, 'wish'),
      ('female', 'f_special_closeness', 4, 10, 'wish'),
      ('female', 'f_date', 4, 10, 'wish'),
      ('female', 'f_intimate_evening', 2, 30, 'wish'),
      ('female', 'f_her_pose', 2, 30, 'wish'),
      ('female', 'f_big_day', 2, 30, 'wish'),
      ('female', 'f_jackpot', 1, 0, 'coupon'),
      ('female', 'f_shopping', 1, 50, 'money')
  ),
  gendered as (
    select pool_key, weight, value_bond, prize_kind from pool where pool_gender = v_gender
  ),
  ranked as (
    select pool_key, value_bond, prize_kind,
           sum(weight) over (order by pool_key) as cum_weight,
           sum(weight) over () as total_weight
    from gendered
  ),
  roll as (
    select random() * max(total_weight) as r from ranked
  )
  select ranked.pool_key, ranked.value_bond, ranked.prize_kind into v_item_key, v_value_bond, v_prize_kind
  from ranked, roll
  where ranked.cum_weight >= roll.r
  order by ranked.cum_weight
  limit 1;

  if v_prize_kind = 'money' then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка желаний: ' || v_item_key, (v_value_bond * v_rate) - v_cost, 'reward');
  elsif v_prize_kind = 'coupon' then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка желаний: ставка', -v_cost, 'reward');

    insert into public.wish_inventory (couple_id, owner_id, gender, item_key)
    values (p_couple_id, auth.uid(), v_gender, 'intimate_spin_coupon');
  else
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

-- ============================================================================
-- 2. intimate_roulette_results -- gains the same idempotency key as
--    wish_roulette_results, plus used_coupon so a replayed/idempotent
--    response can correctly report how that spin was paid for. Nullable +
--    partial unique index, default false -- every existing row keeps
--    working untouched.
-- ============================================================================

alter table public.intimate_roulette_results add column if not exists client_request_id uuid;
alter table public.intimate_roulette_results add column if not exists used_coupon boolean not null default false;
alter table public.intimate_roulette_results add column if not exists cost_points int not null default 0;

create unique index if not exists intimate_roulette_results_client_request_id_key
  on public.intimate_roulette_results (client_request_id)
  where client_request_id is not null;

-- Payment now has to be server-enforced, so the table can no longer be
-- client-writable -- only spin_intimate_roulette() (security definer, below)
-- may insert here from now on. Existing rows and the select policy are
-- untouched.
drop policy if exists "intimate_roulette_results_insert_member" on public.intimate_roulette_results;
revoke insert on public.intimate_roulette_results from authenticated;

-- ============================================================================
-- 3. spin_intimate_roulette -- new. Cost is always 10 BOND (5x the new
--    2-BOND wish-roulette cost) unless p_use_coupon is true and the caller
--    actually has one, in which case one coupon is consumed and no BOND
--    moves. The specific result (p_result_key) is still picked client-side
--    (see migration header) -- this function's only job is making sure a
--    spin is genuinely paid for, exactly once, before it's logged.
-- ============================================================================

create or replace function public.spin_intimate_roulette(
  p_couple_id uuid,
  p_result_key text,
  p_use_coupon boolean,
  p_client_request_id uuid
)
returns table(result_key text, used_coupon boolean, cost_points int, balance_after int, coupons_remaining int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate int;
  v_cost int;
  v_balance int;
  v_coupon_id uuid;
  v_coupons_remaining int;
  v_existing public.intimate_roulette_results%rowtype;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID';
  end if;
  if p_result_key is null or length(trim(p_result_key)) = 0 then
    raise exception 'MISSING_RESULT_KEY';
  end if;

  -- Same per-caller serialization as spin_wish_roulette: two near-simultaneous
  -- spins (double-tap, network retry) from the same account can never both
  -- read the same pre-spin balance/coupon count.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select * into v_existing from public.intimate_roulette_results
  where client_request_id = p_client_request_id
    and spun_by = auth.uid()
    and couple_id = p_couple_id;
  if found then
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();
    select count(*) into v_coupons_remaining from public.wish_inventory
      where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available';
    return query select v_existing.result_key, v_existing.used_coupon, v_existing.cost_points, v_balance, v_coupons_remaining;
    return;
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 10 * v_rate;

  if p_use_coupon then
    select id into v_coupon_id from public.wish_inventory
    where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available'
    order by won_at asc
    limit 1
    for update;

    if v_coupon_id is null then
      raise exception 'NO_COUPON_AVAILABLE';
    end if;

    -- Consumed only here, inside the same transaction as the result insert
    -- below -- if anything after this raises, the whole function rolls back
    -- and the coupon is never actually lost.
    update public.wish_inventory set status = 'used', used_at = now() where id = v_coupon_id;
  else
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

    if v_balance < v_cost then
      raise exception 'ROULETTE_NOT_ENOUGH_BOND';
    end if;

    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Интимная рулетка: ставка', -v_cost, 'reward');
  end if;

  insert into public.intimate_roulette_results (couple_id, spun_by, result_key, used_coupon, cost_points, client_request_id)
  values (p_couple_id, auth.uid(), p_result_key, p_use_coupon, (case when p_use_coupon then 0 else v_cost end), p_client_request_id);

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  select count(*) into v_coupons_remaining from public.wish_inventory
    where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available';

  return query select p_result_key, p_use_coupon, (case when p_use_coupon then 0 else v_cost end), v_balance, v_coupons_remaining;
end;
$$;

grant execute on function public.spin_intimate_roulette(uuid, text, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
