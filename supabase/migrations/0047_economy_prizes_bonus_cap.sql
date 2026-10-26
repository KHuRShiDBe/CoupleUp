-- CoupleUp migration 0047: prizes, roulette, bonuses and daily earning cap.
--
-- Requires 0003, 0008 (bond_rates), 0027/0029 (wish_inventory), 0031
-- (spin_wish_roulette), 0033 (quest_bonus_claims), 0037/0042/0043
-- (action_requests, notify suppression), 0046 (claim_quest_bonus).
-- Additive / create-or-replace only: no table, column or row is dropped or
-- changed, existing balances are untouched (the cap only limits FUTURE
-- credits). Safe to re-run. Run inside BEGIN; ... COMMIT;.
--
-- 1. Prize use: request_use_inventory_item / respond_inventory_use exist
--    only in 0027. Re-created here verbatim so "Использовать" / "ОК" work
--    even where 0027 was never applied (status flow and double-use checks
--    unchanged). Realtime on wish_inventory ensured.
-- 2. Daily cap: a user can receive at most 5 BOND (5 x current
--    points_per_bond) per calendar day in Asia/Tashkent (from 00:00) from
--    every earning type: 'action' (tasks, quick actions, quest/daily
--    bonuses, games, challenges, promises, agreements), 'task',
--    'compliment' and 'reward_chest'. Enforced centrally by a BEFORE INSERT
--    trigger on public.actions (clamps the credit, 0 when used up), under a
--    per-recipient advisory lock so parallel requests cannot overshoot.
--    Roulette results ('reward') and negative rows are not affected.
--    Clients can no longer insert into public.actions directly (the 0001
--    insert policy allowed arbitrary self-credit); every writer is a
--    security-definer RPC. apply_action: a compliment must go to the
--    partner, not to yourself.
-- 3. respond_action_request (from 0043): payout clamped by the cap trigger;
--    also fixes ON CONFLICT on quest_bonus_claims' PARTIAL unique index (0033),
--    which made approving an old bonus request fail.
-- 4. claim_quest_bonus (from 0046): daily milestones 5/7/10 (+20/+30/+50),
--    weekly stays 5/7/15; paid immediately, once per period, clamped by the
--    cap, and no notification to the partner.
-- 5. spin_wish_roulette (from 0031): 3 BOND per spin (was 2) and one paid
--    spin per user every 48 hours. Money prizes m_grand_prize / f_shopping
--    50 -> 15 BOND (= 3 days of max earnings); other prizes and odds
--    unchanged.

-- ============================================================================
-- 1. Prize use RPCs (identical to 0027)
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

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wish_inventory') then
    alter publication supabase_realtime add table public.wish_inventory;
  end if;
end $$;

-- ============================================================================
-- 2. Daily earning cap helper (internal, not callable by clients)
-- ============================================================================

create or replace function public.daily_earn_remaining_points(p_user uuid)
returns int
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select greatest(
    0,
    5 * coalesce((select b.points_per_bond from public.bond_rates b order by b.effective_from desc limit 1), 100)
    - coalesce((
        select sum(a.points) from public.actions a
        where a.recipient_id = p_user
          and a.type in ('action', 'task', 'compliment', 'reward_chest')
          and a.points > 0
          and a.created_at >= (date_trunc('day', now() at time zone 'Asia/Tashkent') at time zone 'Asia/Tashkent')
      ), 0)
  )::int;
$$;

revoke all on function public.daily_earn_remaining_points(uuid) from public, anon, authenticated;

-- Central guard: every positive earning credit is clamped to what is left of
-- the recipient's daily 5 BOND. With nothing left the row is still written
-- with 0 points, so the task/action stays recorded in history and every
-- caller (RETURNING, couple-points sync, notifications) behaves as before.
create or replace function public.enforce_daily_earn_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_left int;
begin
  if NEW.points is null or NEW.points <= 0
     or NEW.type not in ('action', 'task', 'compliment', 'reward_chest') then
    return NEW;
  end if;
  perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || NEW.recipient_id::text));
  v_left := public.daily_earn_remaining_points(NEW.recipient_id);
  NEW.points := least(NEW.points, greatest(v_left, 0));
  return NEW;
end;
$$;

drop trigger if exists actions_enforce_daily_earn_cap on public.actions;
create trigger actions_enforce_daily_earn_cap
  before insert on public.actions
  for each row
  execute function public.enforce_daily_earn_cap();

-- Close direct client writes to the ledger (all writers are RPCs).
drop policy if exists "actions_insert_member" on public.actions;
revoke insert, update, delete on public.actions from anon, authenticated;

-- ============================================================================
-- 3. respond_action_request (0043 + cap + partial-index ON CONFLICT)
-- ============================================================================

create or replace function public.respond_action_request(p_action_request_id uuid, p_accept boolean)
returns public.action_requests
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ar public.action_requests;
begin
  select * into ar from public.action_requests where id = p_action_request_id for update;
  if ar.id is null then
    raise exception 'ACTION_REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(ar.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if ar.actor_user_id = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if ar.status <> 'pending' then
    return ar;
  end if;

  update public.action_requests
  set status = case when p_accept then 'approved' else 'rejected' end,
      approved_by = case when p_accept then auth.uid() else null end,
      approved_at = case when p_accept then now() else null end,
      rejected_at = case when p_accept then null else now() end
  where id = p_action_request_id
  returning * into ar;

  if p_accept then
    -- Both idempotency inserts happen BEFORE actions, and each is checked
    -- via FOUND: if the row already existed (ON CONFLICT DO NOTHING -> no
    -- row affected), we return immediately without crediting actions --
    -- points can never be paid twice, even if quest_progress/quest_bonus_
    -- claims already had the row going into this call (e.g. a stale/retried
    -- request, or a row left over from before migration 0043).
    if ar.bonus_milestone is not null then
      insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
      values (ar.couple_id, ar.actor_user_id, ar.period, ar.period_key, ar.bonus_milestone, ar.points)
      on conflict (user_id, period, period_key, milestone) where user_id is not null do nothing;

      if not found then
        return ar;
      end if;
    end if;

    if ar.item_key is not null then
      insert into public.quest_progress (couple_id, period, period_key, item_key, title, points, completed_by)
      values (ar.couple_id, ar.period, ar.period_key, ar.item_key, ar.title, ar.points, ar.actor_user_id)
      on conflict (couple_id, period, period_key, item_key) do nothing;

      if not found then
        return ar;
      end if;
    end if;

    -- 0047: the daily-cap trigger clamps this credit (0 when the 5 BOND are
    -- used up); the request stays approved and the item counted either way.
    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');
  end if;

  return ar;
end;
$$;


-- ============================================================================
-- 4. claim_quest_bonus (0046 + daily milestones 5/7/10 + cap + no notify)
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

  -- Server-fixed amounts (p_bonus_points is ignored). Daily list has 10
  -- items now, weekly 15.
  v_points := case
    when p_milestone = 5 then 20
    when p_milestone = 7 then 30
    when p_milestone = 10 and p_period = 'daily' then 50
    when p_milestone = 15 and p_period = 'weekly' then 50
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
-- 5. spin_wish_roulette (0031 + 3 BOND + 48 h cooldown)
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

  -- 0047: one paid spin per user every 48 hours. Placed after the
  -- idempotent replay above, so retrying the same request still returns it.
  if exists (
    select 1 from public.wish_roulette_results
    where spun_by = auth.uid() and created_at > now() - interval '48 hours'
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

-- ============================================================================
-- 6. apply_action (0043 + compliment must target the partner)
-- ============================================================================

create or replace function public.apply_action(
  p_couple_id uuid,
  p_title text,
  p_points int,
  p_recipient_id uuid default null,
  p_type text default 'compliment'
)
returns public.actions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_action public.actions;
  target_recipient uuid := coalesce(p_recipient_id, auth.uid());
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = target_recipient
  ) then
    raise exception 'RECIPIENT_NOT_IN_COUPLE';
  end if;

  if p_type not in ('compliment', 'reward_chest') then
    raise exception 'INVALID_TYPE';
  end if;

  -- 0047: a compliment credits the PARTNER, never yourself.
  if p_type = 'compliment' and target_recipient = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if p_points is null or p_points <= 0 then
    raise exception 'INVALID_POINTS';
  end if;
  -- Clear error instead of a 0-point compliment when the cap is used up.
  perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || target_recipient::text));
  if public.daily_earn_remaining_points(target_recipient) <= 0 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, p_type)
  returning * into new_action;

  return new_action;
end;
$$;


