-- CoupleUp migration 0024: Wish Roulette -- a paid (500 BOND), gendered
-- spin-to-win wheel, separate from the existing free CoupleRoulette and the
-- consent-gated IntimateRoulette. Points are real stakes here, so unlike
-- intimate_roulette_results the outcome MUST be decided server-side inside a
-- security-definer RPC -- a client can never be trusted to report its own
-- weighted-random draw when it pays for and profits from the result.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, the function is `create or replace`.

create table if not exists public.wish_roulette_results (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  spun_by uuid references public.profiles(id) on delete set null,
  gender text not null check (gender in ('male', 'female')),
  item_key text not null,
  value_points int not null,
  cost_points int not null,
  created_at timestamptz not null default now()
);

alter table public.wish_roulette_results enable row level security;

drop policy if exists "wish_roulette_results_select_member" on public.wish_roulette_results;
create policy "wish_roulette_results_select_member" on public.wish_roulette_results
  for select using (public.is_couple_member(couple_id));

-- No direct insert policy: rows are only ever written by spin_wish_roulette
-- below (security definer), which is the only place the payout is computed.

grant usage on schema public to authenticated;
grant select on public.wish_roulette_results to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wish_roulette_results'
  ) then
    alter publication supabase_realtime add table public.wish_roulette_results;
  end if;
end $$;

-- ============================================================================
-- spin_wish_roulette -- validates couple membership, re-derives the current
-- BOND rate and the caller's own balance server-side (never trusts the
-- client's numbers), charges 500 BOND worth of points exactly once, performs
-- the weighted-random draw itself, credits the prize, and logs one net
-- `actions` row (so the spin shows up in History for free) plus one
-- wish_roulette_results row (for the rich result card + realtime sync).
--
-- The prize pool (20 items per gender: 5 cheap + 5 almost-break-even + 5 at
-- 1x cost + 3 at 3x cost + 2 at 10x cost) is kept in sync by hand with
-- src/constants/wishRouletteConfig.ts -- item_key is the only thing the
-- client needs back; title/icon/rarity are resolved client-side from that
-- same static config.
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
