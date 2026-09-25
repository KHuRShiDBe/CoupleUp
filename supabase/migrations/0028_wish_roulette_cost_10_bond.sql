-- CoupleUp migration 0028: lower the Wish Roulette spin cost from 500 BOND
-- to 10 BOND. This is a `create or replace` of spin_wish_roulette with
-- exactly ONE line changed (the BOND-to-points cost multiplier); the prize
-- pool, weighted-random draw, balance check, actions/History logging and
-- wish_roulette_results logging are byte-for-byte identical to migration
-- 0024. Nothing here touches previously recorded results -- it only changes
-- how the NEXT spin's cost is computed.
--
-- Safe to re-run: `create or replace function`, no table/column dropped.

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
  v_cost := 10 * v_rate; -- was: 500 * v_rate

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  if v_balance < v_cost then
    raise exception 'ROULETTE_NOT_ENOUGH_BOND';
  end if;

  with pool(pool_gender, pool_key, weight, value_bond) as (
    values
      -- male pool: 5 cheap (w8) + 5 almost-break-even (w6) + 5 at 1x cost (w4) + 3 at 3x cost (w2) + 2 at 10x cost (w1)
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
      -- female pool: same 5/5/5/3/2 shape
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

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка желаний: ' || v_item_key, (v_value_bond * v_rate) - v_cost, 'reward');

  insert into public.wish_roulette_results (couple_id, spun_by, gender, item_key, value_points, cost_points)
  values (p_couple_id, auth.uid(), p_gender, v_item_key, v_value_bond * v_rate, v_cost);

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  return query select v_item_key, v_value_bond * v_rate, v_cost, v_balance;
end;
$$;

grant execute on function public.spin_wish_roulette(uuid, text) to authenticated;

-- Safety net: makes sure PostgREST picks up the replaced function
-- immediately instead of possibly serving a cached old version.
notify pgrst, 'reload schema';
