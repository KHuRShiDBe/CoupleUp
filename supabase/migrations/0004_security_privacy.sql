-- CoupleUp migration 0004: security hardening, leave-couple, block/report,
-- and account-deletion-safe data ownership.
--
-- Additive on top of 0001-0003 -- run this in the Supabase SQL Editor AFTER
-- all three have already been applied. Safe to re-run: every statement uses
-- IF EXISTS / IF NOT EXISTS / OR REPLACE, and no table is ever dropped.

-- ============================================================================
-- 1. SECURITY FIX: close a direct-table-write hole.
--
-- `couples_update_member` / `tasks_update_member` / `goals_update_member` /
-- `reward_requests_update_partner` / `penalties_update_partner` (0001/0002)
-- each declare `for update using (...)` with NO `with check (...)`. Postgres
-- then reuses the USING expression as the CHECK too -- and that expression
-- only tests couple membership, never which columns changed or what they
-- changed to. In practice this let any authenticated couple member issue a
-- raw `.from('couples').update({ points: 999999 })` (or forge a task's
-- points, replay `respond_reward_request`/`respond_penalty` by flipping
-- `status` back to 'pending' via a direct update and re-triggering the RPC,
-- etc.) completely bypassing the ledger/RPC logic and its CHECK constraints.
--
-- Every legitimate mutation to these five tables already goes through a
-- security-definer RPC or trigger (create_couple, join_couple_by_code,
-- touch_couple_activity, apply_couple_points_delta, complete_task,
-- respond_reward_request, respond_penalty, add_to_goal) -- none of those
-- go through PostgREST, so they are unaffected by RLS regardless. No
-- application code calls `.update()` on any of these five tables directly
-- (verified against src/services/supabase/*.ts). Dropping the policies below
-- removes the client's direct-write path entirely with zero functional loss.
-- ============================================================================

drop policy if exists "couples_update_member" on public.couples;
drop policy if exists "tasks_update_member" on public.tasks;
drop policy if exists "goals_update_member" on public.goals;
drop policy if exists "reward_requests_update_partner" on public.reward_requests;
drop policy if exists "penalties_update_partner" on public.penalties;

-- ============================================================================
-- 2. DATA-INTEGRITY FIX: `couples.created_by ... on delete cascade` meant
--    deleting the couple's *creator's* profile cascade-deleted the entire
--    `couples` row -- silently wiping the still-active partner's shared
--    points, history, tasks and goals the moment the other person deleted
--    their account. The couple itself must outlive either single member.
-- ============================================================================

alter table public.couples alter column created_by drop not null;
alter table public.couples drop constraint if exists couples_created_by_fkey;
alter table public.couples
  add constraint couples_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- ============================================================================
-- 3. Same principle for the shared ledger/task/reward/penalty tables: a
--    couple's history belongs to BOTH members, not just whoever authored a
--    given row, so deleting one partner's account must anonymize (keep the
--    row, null out the author reference) rather than cascade-delete it out
--    from under the remaining partner.
-- ============================================================================

alter table public.actions alter column author_id drop not null;
alter table public.actions drop constraint if exists actions_author_id_fkey;
alter table public.actions
  add constraint actions_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.actions alter column recipient_id drop not null;
alter table public.actions drop constraint if exists actions_recipient_id_fkey;
alter table public.actions
  add constraint actions_recipient_id_fkey foreign key (recipient_id) references public.profiles(id) on delete set null;

alter table public.tasks alter column created_by drop not null;
alter table public.tasks drop constraint if exists tasks_created_by_fkey;
alter table public.tasks
  add constraint tasks_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.reward_requests alter column requested_by drop not null;
alter table public.reward_requests drop constraint if exists reward_requests_requested_by_fkey;
alter table public.reward_requests
  add constraint reward_requests_requested_by_fkey foreign key (requested_by) references public.profiles(id) on delete set null;

alter table public.penalties alter column created_by drop not null;
alter table public.penalties drop constraint if exists penalties_created_by_fkey;
alter table public.penalties
  add constraint penalties_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.penalties alter column target_user_id drop not null;
alter table public.penalties drop constraint if exists penalties_target_user_id_fkey;
alter table public.penalties
  add constraint penalties_target_user_id_fkey foreign key (target_user_id) references public.profiles(id) on delete set null;

-- ============================================================================
-- 4. leave_couple(): removes the caller from their couple without touching
--    their account/profile. Auto-resolves anything left pending so it isn't
--    stuck waiting on someone who just left. The couple row, its points and
--    its history are left untouched for the remaining partner.
-- ============================================================================

create or replace function public.leave_couple()
returns void
language plpgsql
security definer
as $$
declare
  my_couple uuid;
begin
  select couple_id into my_couple from public.couple_members where user_id = auth.uid();
  if my_couple is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  update public.reward_requests
  set status = 'rejected', resolved_at = now()
  where couple_id = my_couple and status = 'pending';

  update public.penalties
  set status = 'rejected', resolved_at = now()
  where couple_id = my_couple and status = 'pending';

  delete from public.couple_members where couple_id = my_couple and user_id = auth.uid();
end;
$$;

-- ============================================================================
-- 5. blocked_users: backend-ready blocking. A block is one-directional and
--    owned entirely by the blocker -- only they can see, create or remove it.
-- ============================================================================

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own" on public.blocked_users
  for select using (blocker_id = auth.uid());
drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own" on public.blocked_users
  for insert with check (blocker_id = auth.uid());
drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own" on public.blocked_users
  for delete using (blocker_id = auth.uid());

-- join_couple_by_code now also refuses pairing when either side has blocked
-- the other (covers both "I blocked them" and "they blocked me").
create or replace function public.join_couple_by_code(join_code text)
returns public.couples
language plpgsql
security definer
as $$
declare
  target_couple public.couples;
  member_count int;
begin
  select * into target_couple from public.couples where code = upper(join_code);
  if target_couple.id is null then
    raise exception 'INVALID_CODE';
  end if;

  if exists (
    select 1 from public.couple_members
    where couple_id = target_couple.id and user_id = auth.uid()
  ) then
    return target_couple; -- idempotent: already a member of this couple
  end if;

  if target_couple.created_by = auth.uid() then
    raise exception 'OWN_CODE';
  end if;

  if target_couple.code_expires_at < now() then
    raise exception 'EXPIRED_CODE';
  end if;

  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'ALREADY_IN_COUPLE';
  end if;

  select count(*) into member_count from public.couple_members where couple_id = target_couple.id;
  if member_count >= 2 then
    raise exception 'COUPLE_FULL';
  end if;

  if target_couple.created_by is not null and (
    exists (
      select 1 from public.blocked_users
      where blocker_id = target_couple.created_by and blocked_user_id = auth.uid()
    )
    or exists (
      select 1 from public.blocked_users
      where blocker_id = auth.uid() and blocked_user_id = target_couple.created_by
    )
  ) then
    raise exception 'USER_BLOCKED';
  end if;

  insert into public.couple_members (couple_id, user_id) values (target_couple.id, auth.uid());
  return target_couple;
end;
$$;

-- ============================================================================
-- 6. reports: a write-only moderation queue. Any signed-in user can file a
--    report about another user; nobody (not even the reporter) can read
--    reports back through the client -- reviewing them is a service_role /
--    dashboard-only action, so a report is never exposed publicly in-app.
-- ============================================================================

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  reported_user_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('abuse', 'spam', 'unwanted_contact', 'other')),
  details text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

drop policy if exists "reports_insert_own" on public.reports;
create policy "reports_insert_own" on public.reports
  for insert with check (reporter_id = auth.uid());

-- No select/update/delete policy for authenticated clients on purpose.
