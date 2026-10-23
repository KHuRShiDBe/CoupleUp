-- CoupleUp migration 0038: route daily/weekly/monthly/yearly quest
-- completion through the same approval flow as AddActionScreen's "quick"
-- tab (migration 0037), and fix two bugs 0037 shipped with.
--
-- Additive on top of 0037_action_requests.sql -- run this in the Supabase
-- SQL Editor after 0037. Safe to re-run: CREATE OR REPLACE FUNCTION, guarded
-- constraint drop/re-add. No table is dropped or renamed.
--
-- ============================================================================
-- Why: complete_quest_item() (migration 0021, "Задания на каждый день" /
-- RewardsScreen's "Отметить" button on each of the 15 daily/weekly/monthly/
-- yearly items) was NEVER migrated to the approval flow 0037 added --
-- it's a separate RPC from apply_action, so fixing AddActionScreen's
-- "quick" tab alone didn't touch it. It still inserted straight into
-- `actions`, crediting the balance INSTANTLY and firing the old, generic
-- notify_on_action_insert trigger ("Новое доброе дело" / "Партнёр совершил
-- доброе дело" -- never the actual quest title) -- this is the exact bug
-- reported: no ✓/✕ for the partner, a generic notification instead of the
-- real quest name, and an immediate balance change.
--
-- Fix: complete_quest_item() still inserts into quest_progress exactly as
-- before (unchanged, immediate) -- so the "X/15 done" badge on Home and the
-- 5/7/10 milestone bonuses keep working exactly as they do today. Only the
-- points-crediting half changes: instead of inserting into `actions`
-- directly, it now creates a pending `action_requests` row, same as the
-- "quick" tab -- the partner gets the exact title+points notification with
-- ✓/✕ (NotificationsScreen already renders any action_request/action_response
-- notification this way, no frontend change needed), and the balance only
-- moves once they approve (respond_action_request, migration 0037).
--
-- Also fixes two bugs found auditing 0037 while making this change:
--   1. action_requests.points was capped at 500 -- too narrow. Yearly quest
--      items (src/constants/questEconomy.ts: QUEST_BASE_POINTS.yearly.hard =
--      600) would have failed this CHECK constraint the instant someone
--      completed one, long before this migration ever shipped a working
--      quest-approval flow for them. Widened to match actions_points_range
--      (migration 0026), which every other points-bearing insert already
--      respects.
--   2. respond_action_request()'s own `insert into actions` (on approval)
--      also unconditionally fired the OLD notify_on_action_insert trigger,
--      which computes "the OTHER couple member" from the inserted row's
--      author_id -- for an approval, that's the REVIEWER (the person who
--      just clicked ✓), not the actor. So approving a request ALSO sent the
--      approver a second, generic, misdirected "Партнёр совершил доброе
--      дело" notification about their OWN approval action, alongside the
--      correct action_response notification sent to the actor. Fixed with a
--      transaction-local flag respond_action_request sets before its insert,
--      which notify_on_action_insert now checks and skips on.

-- ============================================================================
-- 1. Widen action_requests.points to match actions_points_range. The 500-cap
--    check was written inline in 0037's CREATE TABLE (no explicit name), so
--    its real name is whatever Postgres auto-generated -- found dynamically
--    here (same technique migration 0033 used for an auto-named unique
--    constraint) rather than assumed, so a wrong guess can't leave the old,
--    narrower constraint silently still in effect alongside a new one.
-- ============================================================================

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.action_requests'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%points%';
  if v_conname is not null then
    execute format('alter table public.action_requests drop constraint %I', v_conname);
  end if;
end $$;

alter table public.action_requests add constraint action_requests_points_check
  check (points > 0 and points <= 1000000);

-- ============================================================================
-- 2. notify_on_action_insert -- skip when respond_action_request() is the
--    one inserting (it already notified the actor precisely via
--    notify_on_action_request_update; this generic trigger firing too would
--    misdirect a second, generic notification at the REVIEWER instead).
-- ============================================================================

create or replace function public.notify_on_action_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  if current_setting('coupleup.suppress_action_notify', true) = 'on' then
    return NEW;
  end if;

  partner := public.get_partner_id(NEW.couple_id, NEW.author_id);
  if NEW.type = 'action' then
    perform public.create_notification(NEW.couple_id, partner, 'action', 'action', NEW.id,
      'Новое доброе дело', 'Партнёр совершил доброе дело');
  elsif NEW.type = 'task' then
    perform public.create_notification(NEW.couple_id, partner, 'task_done', 'task', NEW.id,
      'Задание выполнено', 'Партнёр выполнил задание');
  elsif NEW.type = 'goal' then
    perform public.create_notification(NEW.couple_id, partner, 'goal', 'goal', NEW.id,
      'Пополнение общей цели', 'Партнёр внёс баллы в общую цель');
  elsif NEW.type = 'compliment' then
    perform public.create_notification(NEW.couple_id, partner, 'compliment', 'action', NEW.id,
      'Новый комплимент', 'Партнёр сделал вам комплимент');
  end if;
  return NEW;
end;
$$;

-- ============================================================================
-- 3. respond_action_request -- set the suppression flag (transaction-local,
--    via set_config(..., true)) before its own `actions` insert.
-- ============================================================================

create or replace function public.respond_action_request(p_action_request_id uuid, p_accept boolean)
returns public.action_requests
language plpgsql
security definer
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
    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');
  end if;

  return ar;
end;
$$;

-- ============================================================================
-- 4. complete_quest_item -- quest_progress insert unchanged (immediate,
--    drives the "X/15" badge + milestone bonuses exactly as before); the
--    points half now creates a pending action_requests row instead of
--    inserting into `actions` directly. Same signature, same return value
--    (true = recorded, false = already completed -- unique_violation on
--    quest_progress, caught before the action_requests insert is ever
--    reached, so a duplicate tap still can never create a second request).
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

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points);

  return true;
exception when unique_violation then
  return false;
end;
$$;

notify pgrst, 'reload schema';
