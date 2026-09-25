-- CoupleUp migration 0003: push notification backend.
--
-- Additive on top of 0001_init.sql + 0002_pairing_ledger_security.sql -- run
-- this in the Supabase SQL Editor AFTER both have already been applied. Safe
-- to re-run: every statement uses IF EXISTS / IF NOT EXISTS / OR REPLACE, and
-- no table is ever dropped.
--
-- Adds:
--   - `device_tokens`: one row per signed-in device holding its Expo push token.
--   - `notifications`: a server-side event log, one row per couple event the
--     *other* partner should be told about. Rows are only ever created by the
--     security-definer trigger functions below -- there is no INSERT policy
--     for authenticated clients, so a client can never forge a notification.
--   - `profiles.notification_preferences` / `push_enabled` / `quiet_hours_*`.
--   - Triggers on actions/tasks/reward_requests/penalties that populate
--     `notifications` for 8 event types: action, task, task_done,
--     reward_request, reward_response, penalty, penalty_response, goal.
--
-- Payload security: every notification's title/body is a fixed, generic
-- string per event type (never the actual action/task/reward title) -- the
-- app looks up entity details locally from its already-synced state.

-- ============================================================================
-- 1. device_tokens
-- ============================================================================

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  device_id text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own" on public.device_tokens
  for select using (user_id = auth.uid());
drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own" on public.device_tokens
  for insert with check (user_id = auth.uid());
drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own" on public.device_tokens
  for update using (user_id = auth.uid());
drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own" on public.device_tokens
  for delete using (user_id = auth.uid());

-- ============================================================================
-- 2. notifications (server-side event log, feeds both in-app list and push)
-- ============================================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal'
  )),
  entity_type text,
  entity_id uuid,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
  for select using (recipient_id = auth.uid());

-- No insert policy: rows are only ever created by the security-definer
-- trigger functions in section 4, so a client can never write a notification
-- (about themselves or anyone else).

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (recipient_id = auth.uid());

create or replace function public.mark_all_notifications_read()
returns void
language sql
security definer
as $$
  update public.notifications set read = true where recipient_id = auth.uid() and read = false;
$$;

-- ============================================================================
-- 3. Per-user push settings on profiles
-- ============================================================================

alter table public.profiles add column if not exists notification_preferences jsonb not null default
  '{"actions":true,"rewardRequests":true,"penalties":true,"tasks":true,"goals":true,"achievements":true}'::jsonb;
alter table public.profiles add column if not exists push_enabled boolean not null default true;
alter table public.profiles add column if not exists quiet_hours_start smallint check (quiet_hours_start between 0 and 23);
alter table public.profiles add column if not exists quiet_hours_end smallint check (quiet_hours_end between 0 and 23);

-- ============================================================================
-- 4. Triggers: turn couple events into a `notifications` row for the partner.
--    Each function is security definer so it can insert regardless of the
--    caller's own RLS, and each looks up the *other* couple member rather
--    than trusting any client-supplied recipient.
-- ============================================================================

create or replace function public.get_partner_id(p_couple_id uuid, p_user_id uuid)
returns uuid
language sql
security definer
stable
as $$
  select user_id from public.couple_members
  where couple_id = p_couple_id and user_id <> p_user_id
  limit 1;
$$;

create or replace function public.create_notification(
  p_couple_id uuid,
  p_recipient_id uuid,
  p_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_title text,
  p_body text
)
returns void
language plpgsql
security definer
as $$
begin
  if p_recipient_id is null then
    return;
  end if;
  insert into public.notifications (couple_id, recipient_id, type, entity_type, entity_id, title, body)
  values (p_couple_id, p_recipient_id, p_type, p_entity_type, p_entity_id, p_title, p_body);
end;
$$;

-- actions: type='action' (a plain good deed) and type='task' (task just
-- completed) are always self-credited (author_id = recipient_id = the actor),
-- so the notification target is the *other* partner, not actions.recipient_id.
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
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_action_insert on public.actions;
create trigger trg_notify_action_insert
  after insert on public.actions
  for each row execute function public.notify_on_action_insert();

-- tasks: a newly created task assigned to the partner (or both) notifies them.
create or replace function public.notify_on_task_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  if NEW.assignee in ('partner', 'both') then
    partner := public.get_partner_id(NEW.couple_id, NEW.created_by);
    perform public.create_notification(NEW.couple_id, partner, 'task', 'task', NEW.id,
      'Новое задание', 'Партнёр создал для вас задание');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_task_insert on public.tasks;
create trigger trg_notify_task_insert
  after insert on public.tasks
  for each row execute function public.notify_on_task_insert();

-- reward_requests: new request notifies the partner who can accept/decline it;
-- a resolved request notifies the original requester back.
create or replace function public.notify_on_reward_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  partner uuid;
begin
  partner := public.get_partner_id(NEW.couple_id, NEW.requested_by);
  perform public.create_notification(NEW.couple_id, partner, 'reward_request', 'reward_request', NEW.id,
    'Новый запрос награды', 'Партнёр запросил награду');
  return NEW;
end;
$$;

drop trigger if exists trg_notify_reward_request_insert on public.reward_requests;
create trigger trg_notify_reward_request_insert
  after insert on public.reward_requests
  for each row execute function public.notify_on_reward_request_insert();

create or replace function public.notify_on_reward_request_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status = 'pending' and NEW.status <> 'pending' then
    perform public.create_notification(NEW.couple_id, NEW.requested_by, 'reward_response', 'reward_request', NEW.id,
      case when NEW.status = 'accepted' then 'Запрос награды принят' else 'Запрос награды отклонён' end,
      case when NEW.status = 'accepted' then 'Партнёр принял ваш запрос награды' else 'Партнёр отклонил ваш запрос награды' end);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_reward_request_update on public.reward_requests;
create trigger trg_notify_reward_request_update
  after update on public.reward_requests
  for each row execute function public.notify_on_reward_request_update();

-- penalties: a new penalty notifies its target (they must confirm it); a
-- resolved penalty notifies the creator back.
create or replace function public.notify_on_penalty_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.create_notification(NEW.couple_id, NEW.target_user_id, 'penalty', 'penalty', NEW.id,
    'Штраф на подтверждении', 'Партнёр создал штраф — нужно подтверждение');
  return NEW;
end;
$$;

drop trigger if exists trg_notify_penalty_insert on public.penalties;
create trigger trg_notify_penalty_insert
  after insert on public.penalties
  for each row execute function public.notify_on_penalty_insert();

create or replace function public.notify_on_penalty_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status = 'pending' and NEW.status <> 'pending' then
    perform public.create_notification(NEW.couple_id, NEW.created_by, 'penalty_response', 'penalty', NEW.id,
      case when NEW.status = 'confirmed' then 'Штраф подтверждён' else 'Штраф отклонён' end,
      case when NEW.status = 'confirmed' then 'Партнёр подтвердил штраф' else 'Партнёр отклонил штраф' end);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_penalty_update on public.penalties;
create trigger trg_notify_penalty_update
  after update on public.penalties
  for each row execute function public.notify_on_penalty_update();

-- ============================================================================
-- 5. Realtime
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;
