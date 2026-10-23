-- CoupleUp migration 0042: restore the action_requests quest-approval flow
-- after the Desktop copy's migrations 0035-0036 (quest_progress.status +
-- respond_quest_item) were applied to the same database.
--
-- WHAT WENT WRONG
--   The live database ran the Desktop copy's migration 0035 (and 0036), which
--   (a) added quest_progress.status, (b) replaced complete_quest_item() with a
--   version that writes a 'pending' quest_progress row and creates NO
--   action_requests row, (c) added respond_quest_item(), and (d) replaced
--   claim_quest_bonus(). The main code uses none of that: it expects
--   complete_quest_item() to create a pending action_requests row and
--   respond_action_request() to write quest_progress only on approval
--   (migrations 0037/0038/0041). Net effect today: a quest tapped from the
--   main app creates a pending quest_progress row that nobody can approve,
--   shows as done, and never pays out. Migration 0041 of the main copy was
--   also never applied (respond_action_request has no quest_progress write).
--
-- WHAT THIS DOES (self-contained; supersedes 0041, which becomes a no-op)
--   1. Re-asserts 0041's schema: action_requests.period/period_key/item_key
--      and the partial unique index on the live (pending/approved) request.
--   2. Restores complete_quest_item() -> pending action_requests row only
--      (plus a guard: an item that already has a quest_progress row returns
--      false, so legacy completed rows can never be paid twice).
--   3. Restores respond_action_request() -> on approval writes `actions`
--      (with coupleup.suppress_action_notify) AND quest_progress.
--   4. Re-asserts notify_on_action_insert() exactly as in 0038 (suppress flag).
--   5. Restores claim_quest_bonus() exactly as in 0033 (no status column).
--   6. Moves the Desktop flow's leftovers out of quest_progress:
--        - every 'pending' / 'rejected' row is first copied to
--          quest_progress_desktop_backup (no client access);
--        - every 'pending' row with a known completer is re-created as a
--          pending action_requests row, so the partner can approve it through
--          the main flow (they get the normal "Нужно подтверждение"
--          notification);
--        - pending/rejected rows are then removed from quest_progress, so
--          they stop counting as done and no longer block a fresh "Отметить".
--          Rows with status 'completed' are untouched (already paid).
--   7. Drops respond_quest_item() (the main code never calls it).
--
-- DELIBERATELY NOT DONE
--   quest_progress.status and its check constraint are kept. After step 6
--   every row is 'completed' and new rows get that default, so the column is
--   harmless; dropping it can be a separate, later migration.
--
-- Safe to re-run: guarded DDL, CREATE OR REPLACE, backup/insert steps are
-- idempotent.

-- ============================================================================
-- 1. Schema (same as 0041)
-- ============================================================================

alter table public.action_requests add column if not exists period text
  check (period in ('daily', 'weekly', 'monthly', 'yearly'));
alter table public.action_requests add column if not exists period_key text;
alter table public.action_requests add column if not exists item_key text;

create unique index if not exists action_requests_quest_item_active_key
  on public.action_requests (couple_id, period, period_key, item_key)
  where item_key is not null and status in ('pending', 'approved');

-- ============================================================================
-- 2. complete_quest_item -- pending action_requests row only, no quest_progress
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
set search_path = public, pg_temp
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  -- Already done (approved earlier, by either flow): never create a second
  -- request, so an item can't be paid twice.
  if exists (
    select 1 from public.quest_progress
    where couple_id = p_couple_id
      and period = p_period
      and period_key = p_period_key
      and item_key = p_item_key
  ) then
    return false;
  end if;

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, item_key)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, p_period, p_period_key, p_item_key);

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 3. respond_action_request -- approval writes actions + quest_progress
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
    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');

    if ar.item_key is not null then
      insert into public.quest_progress (couple_id, period, period_key, item_key, title, points, completed_by)
      values (ar.couple_id, ar.period, ar.period_key, ar.item_key, ar.title, ar.points, ar.actor_user_id)
      on conflict (couple_id, period, period_key, item_key) do nothing;
    end if;
  end if;

  return ar;
end;
$$;

-- ============================================================================
-- 4. notify_on_action_insert -- identical to 0038 (suppress flag). No-op on a
--    database that already has it; protects against it being overwritten.
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
-- 5. claim_quest_bonus -- identical to 0033 (no dependency on status)
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
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_period not in ('daily', 'weekly') then
    raise exception 'MILESTONES_NOT_AVAILABLE';
  end if;

  select count(*) into actual_count
  from public.quest_progress
  where couple_id = p_couple_id
    and period = p_period
    and period_key = p_period_key
    and completed_by = auth.uid();

  if actual_count < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
  values (p_couple_id, auth.uid(), p_period, p_period_key, p_milestone, p_bonus_points);

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_bonus_points, 'action');

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 6. Move the Desktop flow's leftovers out of quest_progress.
-- ============================================================================

-- 6a. Backup (server-side only: RLS on, no policies, no client grants).
create table if not exists public.quest_progress_desktop_backup as
  select * from public.quest_progress where false;

alter table public.quest_progress_desktop_backup enable row level security;
revoke all on public.quest_progress_desktop_backup from anon, authenticated;

insert into public.quest_progress_desktop_backup
select qp.*
from public.quest_progress qp
where qp.status in ('pending', 'rejected')
  and not exists (select 1 from public.quest_progress_desktop_backup b where b.id = qp.id);

-- 6b. Still-pending Desktop items become normal pending requests, so the
--     partner can approve them in the main flow. Skipped when the completer
--     is unknown (account deleted) or a live request for the item exists.
insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, item_key, created_at)
select qp.couple_id, qp.completed_by, qp.completed_by, qp.title, qp.points,
       qp.period, qp.period_key, qp.item_key, coalesce(qp.completed_at, now())
from public.quest_progress qp
where qp.status = 'pending'
  and qp.completed_by is not null
  and not exists (
    select 1 from public.action_requests ar
    where ar.couple_id = qp.couple_id
      and ar.period = qp.period
      and ar.period_key = qp.period_key
      and ar.item_key = qp.item_key
      and ar.status in ('pending', 'approved')
  );

-- 6c. Pending/rejected rows no longer count as done and no longer block a
--     fresh "Отметить" (copies are in quest_progress_desktop_backup).
delete from public.quest_progress where status in ('pending', 'rejected');

-- ============================================================================
-- 7. The main code never calls respond_quest_item.
-- ============================================================================

drop function if exists public.respond_quest_item(uuid, boolean);

notify pgrst, 'reload schema';
