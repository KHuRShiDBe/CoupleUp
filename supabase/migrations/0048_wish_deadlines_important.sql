-- CoupleUp migration 0048: wish deadlines, important wishes, weekly bonus 10.
--
-- Requires 0003 (notifications, create_notification, get_partner_id), 0008
-- (bond_rates), 0017 (wishlist_items), 0045/0046 (notification types),
-- 0047 (claim_quest_bonus, daily cap). Uses the existing wishlist_items table
-- only -- no new tables. Additive / create-or-replace: no table, column or
-- row is dropped; existing wishes keep their data (the priority column stays,
-- unused by the app), get no deadline and are not important. Safe to re-run.
-- Run inside BEGIN; ... COMMIT;.
--
-- 1. wishlist_items.deadline_hours: 1 (one hour), 24 (one day) or NULL (no
--    deadline), counted from created_at.
-- 2. Important wishes: is_important / important_at / important_seen_at.
--    make_wish_important(): the author marks their own ACTIVE wish important
--    for 1 BOND, debited once in the same transaction (negative 'reward' row,
--    outside the daily earning cap). Anti-abuse: a wish can be made
--    important only once; one unread important wish per author at a time;
--    at least 1 hour apart; at most 3 per rolling 24 hours. The partner gets
--    one notification. acknowledge_wish_important(): the partner presses OK
--    (read receipt only) -- the wish stays in the list until it is fulfilled
--    via the existing request_/respond_wish_completion flow (0045).
-- 3. notifications_type_check: 0046 list + 'wish_important'.
-- 4. claim_quest_bonus (from 0047): weekly list is 10 items now, so the
--    weekly top milestone is 10 (+50) like daily; 15 is still accepted.
-- 5. spin_wish_roulette (from 0047): cooldown 48 h -> 12 h from the last
--    spin. Cost (3 BOND), prize pool, odds and payouts unchanged.

-- ============================================================================
-- 1. Wish deadlines
-- ============================================================================

alter table public.wishlist_items add column if not exists deadline_hours int;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.wishlist_items'::regclass and conname = 'wishlist_items_deadline_hours_check') then
    alter table public.wishlist_items add constraint wishlist_items_deadline_hours_check
      check (deadline_hours is null or deadline_hours in (1, 24));
  end if;
end $$;

-- ============================================================================
-- 2. Important wishes (columns on the existing table)
-- ============================================================================

alter table public.wishlist_items
  add column if not exists is_important boolean not null default false,
  add column if not exists important_at timestamptz,
  add column if not exists important_seen_at timestamptz;

create index if not exists wishlist_items_important_author_idx
  on public.wishlist_items (created_by, important_at desc) where is_important;

-- ============================================================================
-- 3. notifications: new type
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal',
    'compliment', 'promise_completed', 'challenge_completed', 'goal_completed',
    'purchase_request', 'purchase_response', 'nudge',
    'action_request', 'action_response',
    'wish_completion_request', 'wish_completion_response',
    'prize_use_request',
    'wish_important'
  ));

-- ============================================================================
-- 4. Important-wish RPCs
-- ============================================================================

create or replace function public.make_wish_important(p_item_id uuid)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wishlist_items;
  v_partner uuid;
  v_rate int;
  v_cost int;
  v_balance int;
  v_last timestamptz;
begin
  -- One author at a time: the checks and the debit below are atomic.
  perform pg_advisory_xact_lock(hashtext('coupleup-important:' || auth.uid()::text));

  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if w.created_by is distinct from auth.uid() then
    raise exception 'NOT_OWNER';
  end if;
  if w.status <> 'active' then
    raise exception 'WISH_NOT_ACTIVE';
  end if;
  if w.is_important then
    raise exception 'WISH_ALREADY_IMPORTANT';
  end if;
  v_partner := public.get_partner_id(w.couple_id, auth.uid());
  if v_partner is null then
    raise exception 'NO_PARTNER';
  end if;

  if exists (select 1 from public.wishlist_items
             where created_by = auth.uid() and is_important and important_seen_at is null
               and status <> 'done') then
    raise exception 'IMPORTANT_PENDING';
  end if;
  select max(important_at) into v_last from public.wishlist_items
  where created_by = auth.uid() and is_important;
  if v_last is not null and v_last > now() - interval '1 hour' then
    raise exception 'IMPORTANT_COOLDOWN';
  end if;
  if (select count(*) from public.wishlist_items
      where created_by = auth.uid() and is_important and important_at > now() - interval '24 hours') >= 3 then
    raise exception 'IMPORTANT_DAILY_LIMIT';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 1 * v_rate;  -- 1 BOND

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = w.couple_id and a.recipient_id = auth.uid();
  if v_balance < v_cost then
    raise exception 'IMPORTANT_NOT_ENOUGH_BOND';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (w.couple_id, auth.uid(), auth.uid(), 'Важное желание: ' || w.title, -v_cost, 'reward');

  update public.wishlist_items
     set is_important = true, important_at = now(), important_seen_at = null
   where id = p_item_id
  returning * into w;

  perform public.create_notification(w.couple_id, v_partner, 'wish_important', 'wishlist_item', w.id,
    '🚨 Важное желание', w.title);
  return w;
end;
$$;

-- Partner pressed OK: read receipt only, the wish is NOT completed.
create or replace function public.acknowledge_wish_important(p_item_id uuid)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wishlist_items;
begin
  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if not public.is_couple_member(w.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if w.created_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if w.is_important and w.important_seen_at is null then
    update public.wishlist_items set important_seen_at = now() where id = p_item_id
    returning * into w;
  end if;
  return w;
end;
$$;

revoke all on function public.make_wish_important(uuid) from public, anon;
revoke all on function public.acknowledge_wish_important(uuid) from public, anon;
grant execute on function public.make_wish_important(uuid) to authenticated;
grant execute on function public.acknowledge_wish_important(uuid) to authenticated;

-- ============================================================================
-- 5. claim_quest_bonus (0047 + weekly milestone 10)
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
set search_path = public, pg_temp
as $$
declare
  actual_count int;
  v_points int;
  v_pay int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_period not in ('daily', 'weekly') then
    raise exception 'MILESTONES_NOT_AVAILABLE';
  end if;

  -- Server-fixed amounts (p_bonus_points is ignored). Daily and weekly lists
  -- have 10 items each now.
  v_points := case
    when p_milestone = 5 then 20
    when p_milestone = 7 then 30
    when p_milestone = 10 then 50                         -- 0048: daily AND weekly (10 items each)
    when p_milestone = 15 and p_period = 'weekly' then 50 -- legacy weekly milestone, still honoured
    else null
  end;
  if v_points is null then
    raise exception 'INVALID_MILESTONE';
  end if;

  -- quest_progress rows exist only for partner-approved items.
  select count(*) into actual_count
  from public.quest_progress
  where couple_id = p_couple_id
    and period = p_period
    and period_key = p_period_key
    and completed_by = auth.uid();

  if actual_count < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || auth.uid()::text));
  v_pay := least(v_points, public.daily_earn_remaining_points(auth.uid()));
  if v_pay <= 0 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  -- Claim first: the partial unique index makes a second claim a no-op, so
  -- the bonus can never be credited twice for the same period.
  insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
  values (p_couple_id, auth.uid(), p_period, p_period_key, p_milestone, v_pay)
  on conflict (user_id, period, period_key, milestone) where user_id is not null do nothing;

  if not found then
    return false;
  end if;

  -- Bonuses are not announced to the partner.
  perform set_config('coupleup.suppress_action_notify', 'on', true);
  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, v_pay, 'action');

  return true;
end;
$$;

grant execute on function public.claim_quest_bonus(uuid, text, text, int, int, text) to authenticated;

-- ============================================================================
-- 6. spin_wish_roulette (0047 + 12 h cooldown instead of 48 h)
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

  -- 0048: one paid spin per user every 12 hours, counted from the last
  -- spin (was 48 h in 0047). Placed after the idempotent replay above, so
  -- retrying the same request still returns it.
  if exists (
    select 1 from public.wish_roulette_results
    where spun_by = auth.uid() and created_at > now() - interval '12 hours'
  ) then
    raise exception 'ROULETTE_COOLDOWN';
  end if;

  select role into v_gender from public.profiles where id = auth.uid();
  if v_gender not in ('male', 'female') then
    raise exception 'INVALID_GENDER';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 3 * v_rate;  -- 0047: 3 BOND per spin (was 2)

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
      ('male', 'm_grand_prize', 1, 15, 'money'),
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
      ('female', 'f_shopping', 1, 15, 'money')
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
