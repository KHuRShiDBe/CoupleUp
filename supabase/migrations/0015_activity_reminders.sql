-- CoupleUp migration 0015: Activity Center + Smart Reminders + Partner Nudge.
--
-- Does NOT create a parallel "activity_events" table. The existing
-- `notifications` table (migration 0003) already IS a per-user activity log
-- (couple-scoped, read/unread, realtime-enabled) -- Activity Center is a
-- richer client on top of it, not a new backend. This migration only widens
-- it with the event types the app didn't notify on yet, and adds triggers
-- for events that previously had none at all:
--   - compliment              (actions.type = 'compliment', added in 0010,
--                              but notify_on_action_insert() never handled it)
--   - promise_completed       (promises.status -> 'completed' -- had no
--                              notification at all before this migration)
--   - challenge_completed     (daily_challenges insert -- ditto)
--   - goal_completed          (goals.current_points reaching target_points --
--                              distinct from the existing 'goal' type, which
--                              notifies on a *contribution*, not completion)
--   - purchase_request / purchase_response (purchase_requests, added in 0012
--                              with zero notification triggers -- the same
--                              gap reward_requests/penalties already closed
--                              back in 0003)
--   - nudge                   (new: "Напомнить партнёру", see section 3)
--
-- New, genuinely new tables (personal, not couple-shared -- see RLS below):
--   - reminders            (a user's own reminder on a promise/habit/
--                            important date/goal/task/shopping item)
--   - reminder_deliveries  (per-occurrence delivery record -- needed because
--                            a weekly-repeating reminder fires more than
--                            once; tracks what was actually shown so the
--                            local scheduler and any future push-based
--                            delivery agree on what's pending/done)
--
-- Safe to re-run: every statement uses IF EXISTS / IF NOT EXISTS / OR REPLACE,
-- and (learned from migration 0010's actions_type_check bug) every widened
-- check constraint is dropped by its exact, known auto-generated name before
-- being re-added -- never by a text search over pg_get_constraintdef, which
-- silently fails to match once Postgres rewrites `IN (...)` to `= ANY(...)`.

-- ============================================================================
-- 1. Widen notifications.type to cover every new event.
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal',
    'compliment', 'promise_completed', 'challenge_completed', 'goal_completed',
    'purchase_request', 'purchase_response', 'nudge'
  ));

-- ============================================================================
-- 2. New/extended triggers that populate `notifications` for the events
--    Activity Center needs to show that had no row-producing trigger yet.
-- ============================================================================

-- 2a. Compliments: notify_on_action_insert() (migration 0010) already handles
-- 'action' and 'task'/'goal' (contribution) but silently ignored 'compliment'.
create or replace function public.notify_on_action_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
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
-- Trigger itself already exists (trg_notify_action_insert, migration 0003) --
-- replacing the function body is enough, no need to re-create it.

-- 2b. Promise completed -- notify the OTHER party (whichever side didn't just
-- mark it complete). auth.uid() is read from the request's session, not
-- affected by this function's own SECURITY DEFINER (same pattern already
-- used by apply_action() in migration 0010).
create or replace function public.notify_on_promise_completed()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  if NEW.status = 'completed' and OLD.status is distinct from 'completed' then
    partner := public.get_partner_id(NEW.couple_id, auth.uid());
    perform public.create_notification(NEW.couple_id, partner, 'promise_completed', 'promise', NEW.id,
      'Обещание выполнено', 'Партнёр выполнил обещание');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_promise_completed on public.promises;
create trigger trg_notify_promise_completed
  after update on public.promises
  for each row execute function public.notify_on_promise_completed();

-- 2c. Daily challenge completed -- a row is only ever inserted once the
-- couple's shared daily challenge is done (see migration 0013), so INSERT
-- itself is the completion event. Notify whichever partner did NOT complete it.
create or replace function public.notify_on_daily_challenge_completed()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  partner := public.get_partner_id(NEW.couple_id, NEW.completed_by);
  perform public.create_notification(NEW.couple_id, partner, 'challenge_completed', 'daily_challenge', NEW.id,
    'Челлендж дня выполнен', 'Партнёр выполнил челлендж дня');
  return NEW;
end;
$$;

drop trigger if exists trg_notify_daily_challenge_completed on public.daily_challenges;
create trigger trg_notify_daily_challenge_completed
  after insert on public.daily_challenges
  for each row execute function public.notify_on_daily_challenge_completed();

-- 2d. Goal completed -- fires once, the moment current_points crosses
-- target_points (not on every contribution, which already notifies via the
-- 'goal' actions-ledger type above). Notifies the OTHER party relative to
-- whoever's add_to_goal() call caused this update.
create or replace function public.notify_on_goal_completed()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  if NEW.current_points >= NEW.target_points and OLD.current_points < OLD.target_points then
    partner := public.get_partner_id(NEW.couple_id, auth.uid());
    perform public.create_notification(NEW.couple_id, partner, 'goal_completed', 'goal', NEW.id,
      'Общая цель достигнута', 'Ваша общая цель полностью накоплена');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_goal_completed on public.goals;
create trigger trg_notify_goal_completed
  after update on public.goals
  for each row execute function public.notify_on_goal_completed();

-- 2e. Purchase requests (migration 0012) had zero notification triggers --
-- same gap reward_requests/penalties already had closed back in 0003.
-- Unlike reward_requests (which notifies "the partner", looked up via
-- get_partner_id), purchase_requests already stores an explicit
-- recipient_id, so it's used directly.
create or replace function public.notify_on_purchase_request_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.create_notification(NEW.couple_id, NEW.recipient_id, 'purchase_request', 'purchase_request', NEW.id,
    'Новый запрос на покупку', 'Партнёр запросил покупку');
  return NEW;
end;
$$;

drop trigger if exists trg_notify_purchase_request_insert on public.purchase_requests;
create trigger trg_notify_purchase_request_insert
  after insert on public.purchase_requests
  for each row execute function public.notify_on_purchase_request_insert();

create or replace function public.notify_on_purchase_request_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status = 'pending' and NEW.status <> 'pending' then
    perform public.create_notification(NEW.couple_id, NEW.requested_by, 'purchase_response', 'purchase_request', NEW.id,
      case when NEW.status = 'approved' then 'Запрос на покупку одобрен' else 'Запрос на покупку отклонён' end,
      case when NEW.status = 'approved' then 'Партнёр одобрил запрос на покупку' else 'Партнёр отклонил запрос на покупку' end);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_purchase_request_update on public.purchase_requests;
create trigger trg_notify_purchase_request_update
  after update on public.purchase_requests
  for each row execute function public.notify_on_purchase_request_update();

-- ============================================================================
-- 3. Partner nudge -- "Напомнить партнёру". A thin RPC over the same
-- `notifications` table (type='nudge') rather than a new table: rate-limited
-- server-side so it can never be spammed regardless of what the client does
-- -- at most one nudge per (couple, entity) pair per 6 hours. entity_id may
-- be null (e.g. a still-local-only Task that has no server-side row), in
-- which case the rate limit groups by entity_type instead.
-- ============================================================================

create or replace function public.send_partner_nudge(
  p_couple_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_title text
)
returns void
language plpgsql
security definer
as $$
declare
  partner uuid;
  recent_count int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  partner := public.get_partner_id(p_couple_id, auth.uid());
  if partner is null then
    raise exception 'NO_PARTNER';
  end if;

  select count(*) into recent_count
  from public.notifications
  where couple_id = p_couple_id
    and type = 'nudge'
    and entity_type = p_entity_type
    and entity_id is not distinct from p_entity_id
    and created_at > now() - interval '6 hours';

  if recent_count > 0 then
    raise exception 'NUDGE_RATE_LIMITED';
  end if;

  perform public.create_notification(p_couple_id, partner, 'nudge', p_entity_type, p_entity_id,
    'Партнёр напоминает', coalesce(p_title, 'Партнёр просит не забыть об этом'));
end;
$$;

-- ============================================================================
-- 4. reminders -- PERSONAL (not couple-shared): only the owner can see or
-- manage their own reminders, same as surprise_ideas in migration 0011.
-- couple_id is kept only so a departing/leaving couple can be used to scope
-- cleanup consistently with every other table; it is never used to grant the
-- partner access.
-- ============================================================================

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('promise', 'habit', 'important_date', 'goal', 'task', 'shopping_item')),
  target_id uuid,
  title text not null,
  rule text not null check (rule in ('today', 'tomorrow', 'in_3_days', 'specific_date', 'weekly')),
  remind_at timestamptz not null,
  repeat_weekly boolean not null default false,
  is_active boolean not null default true,
  last_fired_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.reminders enable row level security;

drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own" on public.reminders
  for select using (user_id = auth.uid());

drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own" on public.reminders
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own" on public.reminders
  for update using (user_id = auth.uid());

drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own" on public.reminders
  for delete using (user_id = auth.uid());

-- ============================================================================
-- 5. reminder_deliveries -- one row per scheduled occurrence of a reminder
-- (a weekly-repeating reminder gets a new row each week). Owned indirectly
-- through reminders.user_id, since there is no user_id column of its own.
-- ============================================================================

create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.reminder_deliveries enable row level security;

drop policy if exists "reminder_deliveries_select_own" on public.reminder_deliveries;
create policy "reminder_deliveries_select_own" on public.reminder_deliveries
  for select using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()));

drop policy if exists "reminder_deliveries_insert_own" on public.reminder_deliveries;
create policy "reminder_deliveries_insert_own" on public.reminder_deliveries
  for insert with check (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()));

drop policy if exists "reminder_deliveries_update_own" on public.reminder_deliveries;
create policy "reminder_deliveries_update_own" on public.reminder_deliveries
  for update using (exists (select 1 from public.reminders r where r.id = reminder_id and r.user_id = auth.uid()));

-- ============================================================================
-- 6. Base table privileges (see migration 0005: RLS alone is not enough).
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.reminders to authenticated;
grant select, insert, update on public.reminder_deliveries to authenticated;

-- ============================================================================
-- 7. Realtime -- reminders only (so the same user's own two devices, e.g.
-- phone + tablet, stay in sync). reminder_deliveries is a write-mostly log
-- the scheduler reads on demand and doesn't need live push.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reminders') then
    alter publication supabase_realtime add table public.reminders;
  end if;
end $$;
