-- CoupleUp migration 0046: prize-use notification + instant quest bonus.
--
-- 1. Using a roulette prize (wish_inventory 'available' -> 'pending_use',
--    via the existing request_use_inventory_item) now notifies the partner.
--    Done with an AFTER UPDATE trigger, so request_use_inventory_item /
--    respond_inventory_use (0027) are not touched. Status flow, ownership
--    checks and double-use protection stay exactly as in 0027:
--    available -> pending_use -> (partner OK) used.
--
-- 2. claim_quest_bonus() pays out immediately again. Quest items only reach
--    quest_progress after the partner approved them (respond_action_request,
--    0043), so a milestone counted from quest_progress is already
--    partner-confirmed -- the extra bonus approval added by 0043 was a
--    double confirmation. Same eligibility checks and the same fixed bonus
--    amounts (5 -> 20, 7 -> 30, 15 -> 50) as 0043. quest_bonus_claims'
--    unique (user_id, period, period_key, milestone) still makes every
--    milestone payable once only; a bonus request still pending from before
--    this migration can be approved by the partner as before and will not
--    pay twice (respond_action_request returns early on the existing claim).
--
-- Requires: 0003 (notifications, create_notification, get_partner_id),
-- 0027/0029 (wish_inventory), 0033 (quest_progress, quest_bonus_claims),
-- 0037 (notifications_type_check). The type list below is 0037's list plus
-- the two wish types from 0045 and 'prize_use_request', so it is correct
-- whether or not 0045 has been applied yet.
--
-- Additive only: no table, column or row is dropped. Safe to re-run.

-- ============================================================================
-- 1. notifications: new type
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
    'prize_use_request'
  ));

-- ============================================================================
-- 2. wish_inventory: notify the partner when a prize is used
-- ============================================================================

create or replace function public.notify_on_prize_use_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select name into actor_name from public.profiles where id = NEW.owner_id;
  perform public.create_notification(
    NEW.couple_id,
    public.get_partner_id(NEW.couple_id, NEW.owner_id),
    'prize_use_request', 'wish_inventory', NEW.id,
    'Партнёр использовал приз',
    format('%s использует приз из рулетки — откройте приложение и нажмите «ОК»', coalesce(actor_name, 'Партнёр')));
  return NEW;
end;
$$;

drop trigger if exists wish_inventory_notify_prize_use on public.wish_inventory;
create trigger wish_inventory_notify_prize_use
  after update of status on public.wish_inventory
  for each row
  when (OLD.status = 'available' and NEW.status = 'pending_use')
  execute function public.notify_on_prize_use_request();

-- ============================================================================
-- 3. claim_quest_bonus: immediate, once per milestone
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
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_period not in ('daily', 'weekly') then
    raise exception 'MILESTONES_NOT_AVAILABLE';
  end if;

  -- Server-fixed amounts (p_bonus_points is ignored, as in 0043).
  v_points := case p_milestone
    when 5 then 20
    when 7 then 30
    when 15 then 50
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

  -- Claim first: the unique index makes a second claim a no-op, so the
  -- points below can never be credited twice for the same milestone.
  insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
  values (p_couple_id, auth.uid(), p_period, p_period_key, p_milestone, v_points)
  on conflict (user_id, period, period_key, milestone) where user_id is not null do nothing;

  if not found then
    return false;
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, v_points, 'action');

  return true;
end;
$$;

grant execute on function public.claim_quest_bonus(uuid, text, text, int, int, text) to authenticated;
