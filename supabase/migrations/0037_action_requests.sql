-- CoupleUp migration 0037: action approval flow ("Я сделал(а)" quick actions
-- now require the partner's confirmation before points land).
--
-- Additive on top of every prior migration (most directly 0001_init.sql,
-- 0002_pairing_ledger_security.sql and 0003_notifications.sql) -- run this in
-- the Supabase SQL Editor after all of those. Safe to re-run: every statement
-- uses IF EXISTS / IF NOT EXISTS / OR REPLACE, and no table is ever dropped
-- or renamed -- `action_requests` is a genuinely new table, not a rename of
-- `actions` (the existing points ledger) or any other existing table.
--
-- Problem: AddActionScreen's "quick" tab (sync.addAction -> apply_action RPC)
-- inserted straight into `actions`, and the `trg_apply_points` trigger
-- (0002) credits the couple's balance the instant that row lands -- no
-- confirmation step at all, for either direction ("Я сделал(а) для него/неё"
-- or "Он/она сделал(а) для меня"). This migration adds a new pending-request
-- table in front of that ledger write: the person who performed the action
-- stays the ACTOR regardless of direction, the other couple member (the
-- REVIEWER, auto-derived server-side, never client-supplied) must approve or
-- reject it, and `actions` is only ever inserted into (crediting the
-- balance, via the existing trigger -- no new ledger logic needed) once
-- approved. Mirrors the exact `penalties`/respond_penalty precedent (same
-- pending/resolved shape, same self-approval block, same idempotent-resolve
-- guard), with `for update` locking from day one (migration 0016 added that
-- to an older RPC after finding the race without it).
--
-- Does NOT touch `actions`, `couples`, or the points trigger at all -- the
-- ledger and the balance math are both already correct and untouched; this
-- only adds a gate in front of the INSERT into `actions` that the "quick"
-- tab used to do directly.

-- ============================================================================
-- 1. action_requests
-- ============================================================================

create table if not exists public.action_requests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  -- Who performed/logged the action (always auth.uid() at insert time, via
  -- the RLS insert check below) -- regardless of which direction was picked
  -- on AddActionScreen, this is always whoever tapped the chip.
  actor_user_id uuid not null references public.profiles(id) on delete cascade,
  -- Who must approve/reject -- always the OTHER member of the same couple.
  -- Never trusted from the client: auto-filled by trg_set_action_request_reviewer
  -- below from couple_members, the same server-side lookup every other
  -- "notify the partner" trigger in this app already uses (get_partner_id,
  -- migration 0003).
  reviewer_user_id uuid references public.profiles(id) on delete cascade,
  -- Who the points go to once approved -- independent of actor/reviewer:
  -- "Я сделал(а) для него/неё" credits the actor themselves, "Он/она
  -- сделал(а) для меня" credits the actor's partner. Either way the reviewer
  -- is still "whoever did NOT log it", per reviewer_user_id above.
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  points int not null check (points > 0 and points <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

-- Auto-fill reviewer_user_id server-side so a client can never assign its
-- own reviewer (which would let it pick someone who'd auto-approve, or
-- nobody at all). Runs before the row is stored, so the NOT NULL enforced by
-- respond_action_request's own lookup always finds a value once a couple
-- actually has two members.
create or replace function public.set_action_request_reviewer()
returns trigger
language plpgsql
security definer
as $$
begin
  if NEW.reviewer_user_id is null then
    NEW.reviewer_user_id := public.get_partner_id(NEW.couple_id, NEW.actor_user_id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_action_request_reviewer on public.action_requests;
create trigger trg_set_action_request_reviewer
  before insert on public.action_requests
  for each row execute function public.set_action_request_reviewer();

-- Indexes: every read path either filters by couple_id (the couple's shared
-- request feed, mirrors how actions/tasks/penalties are listed) or by
-- reviewer_user_id + status (the current user's own pending-approval queue).
create index if not exists idx_action_requests_couple_id on public.action_requests (couple_id);
create index if not exists idx_action_requests_reviewer_status on public.action_requests (reviewer_user_id, status);
create index if not exists idx_action_requests_actor_user_id on public.action_requests (actor_user_id);

alter table public.action_requests enable row level security;

-- Only the two couple members can see their own couple's requests -- nobody
-- outside the couple (RLS has no insert/select policy granting anything to
-- anyone else, so a non-member gets zero rows, not an error).
drop policy if exists "action_requests_select_member" on public.action_requests;
create policy "action_requests_select_member" on public.action_requests
  for select using (public.is_couple_member(couple_id));

-- Only the actor can create a request, and only as themselves.
drop policy if exists "action_requests_insert_member" on public.action_requests;
create policy "action_requests_insert_member" on public.action_requests
  for insert with check (public.is_couple_member(couple_id) and actor_user_id = auth.uid());

-- No update policy at all -- stricter than penalties/reward_requests (which
-- still allow the non-author partner a direct-table update): approving or
-- rejecting (and, on approval, crediting points) only ever happens through
-- respond_action_request() below, which independently re-checks that the
-- caller is the reviewer, not the actor.

-- ============================================================================
-- 2. respond_action_request -- the only way to move a request out of
--    'pending'. Mirrors respond_penalty exactly: lock the row, require couple
--    membership, forbid the actor from resolving their own request, no-op
--    if already resolved (so a double-tap or a retried call can never
--    double-credit), and only write to `actions` (crediting the balance via
--    the existing trigger) on approval.
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
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');
  end if;

  return ar;
end;
$$;

-- ============================================================================
-- 3. Notifications: widen notifications.type (dropped/re-added by its exact,
--    known auto-generated name, per the convention 0015 established -- never
--    a text search over pg_get_constraintdef) and add the insert/update
--    trigger pair that mirrors notify_on_penalty_insert/update, except the
--    body text carries the real action title/points (a deliberate departure
--    from 0003's "always generic" convention -- the whole point of this
--    feature is that the approving partner sees exactly what they're being
--    asked to confirm without having to open the app's synced state first).
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal',
    'compliment', 'promise_completed', 'challenge_completed', 'goal_completed',
    'purchase_request', 'purchase_response', 'nudge',
    'action_request', 'action_response'
  ));

create or replace function public.notify_on_action_request_insert()
returns trigger
language plpgsql
security definer
as $$
declare
  actor_name text;
begin
  select name into actor_name from public.profiles where id = NEW.actor_user_id;
  perform public.create_notification(NEW.couple_id, NEW.reviewer_user_id, 'action_request', 'action_request', NEW.id,
    'Нужно подтверждение',
    format('%s отметил(а): "%s" — +%s баллов', coalesce(actor_name, 'Партнёр'), NEW.title, NEW.points));
  return NEW;
end;
$$;

drop trigger if exists trg_notify_action_request_insert on public.action_requests;
create trigger trg_notify_action_request_insert
  after insert on public.action_requests
  for each row execute function public.notify_on_action_request_insert();

create or replace function public.notify_on_action_request_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if OLD.status = 'pending' and NEW.status <> 'pending' then
    perform public.create_notification(NEW.couple_id, NEW.actor_user_id, 'action_response', 'action_request', NEW.id,
      case when NEW.status = 'approved' then 'Действие подтверждено' else 'Действие отклонено' end,
      case when NEW.status = 'approved'
        then format('"%s" — +%s баллов начислено', NEW.title, NEW.points)
        else format('"%s" — отклонено, баллы не начислены', NEW.title) end);
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_notify_action_request_update on public.action_requests;
create trigger trg_notify_action_request_update
  after update on public.action_requests
  for each row execute function public.notify_on_action_request_update();

-- ============================================================================
-- 4. Realtime -- the Notifications screen itself reads the separate
--    `notifications` table (already realtime-enabled, migration 0003) for
--    the bell/banner; this table is what keeps `sync.actionRequests` (the
--    live status/buttons cross-reference NotificationsScreen renders)
--    up to date on both phones without a manual refresh.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'action_requests'
  ) then
    alter publication supabase_realtime add table public.action_requests;
  end if;
end $$;

-- ============================================================================
-- 5. Force PostgREST to pick up the new table/columns immediately. Without
--    this, a brand-new table can be invisible to the REST API ("Could not
--    find the table 'public.action_requests' in the schema cache") until
--    PostgREST's own schema cache happens to refresh on its own -- every
--    migration since 0028 ends with this for exactly that reason.
-- ============================================================================

notify pgrst, 'reload schema';
