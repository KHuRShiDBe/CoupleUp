-- CoupleUp migration 0002: profiles rename, unified points ledger, invite
-- code expiry, and RLS hardening (self-confirmation block, partner-only
-- penalty targeting, server-side point bounds).
--
-- Additive on top of 0001_init.sql -- run this in the Supabase SQL Editor
-- AFTER 0001 has already been applied. Safe to re-run: every statement uses
-- IF EXISTS / IF NOT EXISTS / OR REPLACE, and no table is ever dropped.

-- ============================================================================
-- 1. Rename users -> profiles (Postgres updates every FK/policy reference
--    automatically; no data is touched).
-- ============================================================================

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users')
     and not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'profiles') then
    alter table public.users rename to profiles;
  end if;
end $$;

alter table public.profiles add column if not exists language text check (language in ('ru', 'uz', 'en')) default 'ru';

-- ============================================================================
-- 2. Invite code expiry (24h). Existing rows get a value so the column can
--    become NOT NULL; new rows get it from create_couple() below.
-- ============================================================================

alter table public.couples add column if not exists code_expires_at timestamptz;
update public.couples set code_expires_at = created_at + interval '24 hours' where code_expires_at is null;
alter table public.couples alter column code_expires_at set not null;
alter table public.couples alter column code_expires_at set default (now() + interval '24 hours');

-- ============================================================================
-- 3. Unified points ledger. `actions` becomes the single append-only source
--    of truth for every point-affecting event (good deed, task, reward
--    redemption, confirmed penalty). A trigger keeps couples.points /
--    earned_points / spent_points in sync -- the client never writes those
--    columns directly, and every row is bounded by a CHECK constraint so a
--    client can never hand itself an outlandish balance.
-- ============================================================================

alter table public.actions add column if not exists type text not null default 'action'
  check (type in ('action', 'task', 'reward', 'penalty', 'goal'));
alter table public.actions add column if not exists recipient_id uuid references public.profiles(id) on delete cascade;
update public.actions set recipient_id = author_id where recipient_id is null;
alter table public.actions alter column recipient_id set not null;

alter table public.actions drop constraint if exists actions_points_range;
alter table public.actions add constraint actions_points_range check (points between -10000 and 500);

alter table public.tasks drop constraint if exists tasks_points_range;
alter table public.tasks add constraint tasks_points_range check (points > 0 and points <= 200);

alter table public.penalties drop constraint if exists penalties_points_range;
alter table public.penalties add constraint penalties_points_range check (points > 0 and points <= 500);

alter table public.reward_requests drop constraint if exists reward_requests_cost_range;
alter table public.reward_requests add constraint reward_requests_cost_range check (cost > 0 and cost <= 10000);

alter table public.rewards drop constraint if exists rewards_cost_range;
alter table public.rewards add constraint rewards_cost_range check (cost > 0 and cost <= 10000);

create or replace function public.apply_couple_points_delta()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.couples
  set points = points + NEW.points,
      earned_points = earned_points + greatest(NEW.points, 0),
      spent_points = spent_points + greatest(-NEW.points, 0)
  where id = NEW.couple_id;
  perform public.touch_couple_activity(NEW.couple_id);
  return NEW;
end;
$$;

drop trigger if exists trg_apply_points on public.actions;
create trigger trg_apply_points
  after insert on public.actions
  for each row execute function public.apply_couple_points_delta();

-- ============================================================================
-- 4. RPCs: create/join now handle code expiry + "this is your own code";
--    apply_action/complete_task simplified to a single ledger insert (the
--    trigger above applies the delta); respond_reward_request/respond_penalty
--    now also write a ledger row instead of touching couples directly, and
--    refuse to let the creator/requester resolve their own request.
-- ============================================================================

create or replace function public.create_couple()
returns public.couples
language plpgsql
security definer
as $$
declare
  new_couple public.couples;
  new_code text;
begin
  if exists (select 1 from public.couple_members where user_id = auth.uid()) then
    raise exception 'ALREADY_IN_COUPLE';
  end if;

  loop
    new_code := public.generate_couple_code();
    exit when not exists (select 1 from public.couples where code = new_code);
  end loop;

  insert into public.couples (code, created_by, code_expires_at)
  values (new_code, auth.uid(), now() + interval '24 hours')
  returning * into new_couple;

  insert into public.couple_members (couple_id, user_id)
  values (new_couple.id, auth.uid());

  return new_couple;
end;
$$;

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

  insert into public.couple_members (couple_id, user_id) values (target_couple.id, auth.uid());
  return target_couple;
end;
$$;

create or replace function public.apply_action(p_couple_id uuid, p_title text, p_points int)
returns public.actions
language plpgsql
security definer
as $$
declare
  new_action public.actions;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, 'action')
  returning * into new_action;

  return new_action;
end;
$$;

create or replace function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id;
  if t.id is null then
    raise exception 'TASK_NOT_FOUND';
  end if;
  if not public.is_couple_member(t.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if t.status = 'completed' then
    return t;
  end if;

  update public.tasks
  set status = 'completed', completed_at = now()
  where id = p_task_id
  returning * into t;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (t.couple_id, auth.uid(), auth.uid(), t.title, t.points, 'task');

  return t;
end;
$$;

-- Only the partner who did NOT request the reward may accept/decline it.
create or replace function public.respond_reward_request(p_request_id uuid, p_accept boolean)
returns public.reward_requests
language plpgsql
security definer
as $$
declare
  r public.reward_requests;
begin
  select * into r from public.reward_requests where id = p_request_id;
  if r.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(r.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if r.requested_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if r.status <> 'pending' then
    return r;
  end if;

  update public.reward_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      resolved_at = now()
  where id = p_request_id
  returning * into r;

  if p_accept then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (r.couple_id, r.requested_by, r.requested_by, r.title, -r.cost, 'reward');
  end if;

  return r;
end;
$$;

-- Only the partner who was NOT the one who created the penalty may confirm it
-- (mirrors "the target must confirm their own penalty", never the creator).
create or replace function public.respond_penalty(p_penalty_id uuid, p_accept boolean)
returns public.penalties
language plpgsql
security definer
as $$
declare
  p public.penalties;
begin
  select * into p from public.penalties where id = p_penalty_id;
  if p.id is null then
    raise exception 'PENALTY_NOT_FOUND';
  end if;
  if not public.is_couple_member(p.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p.created_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if p.status <> 'pending' then
    return p;
  end if;

  update public.penalties
  set status = case when p_accept then 'confirmed' else 'rejected' end,
      resolved_at = now()
  where id = p_penalty_id
  returning * into p;

  if p_accept then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p.couple_id, p.target_user_id, p.target_user_id, p.title, -p.points, 'penalty');
  end if;

  return p;
end;
$$;

create or replace function public.add_to_goal(p_goal_id uuid, p_amount int)
returns public.goals
language plpgsql
security definer
as $$
declare
  g public.goals;
  c public.couples;
  applied int;
  room int;
begin
  select * into g from public.goals where id = p_goal_id;
  if g.id is null then
    raise exception 'GOAL_NOT_FOUND';
  end if;
  if not public.is_couple_member(g.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into c from public.couples where id = g.couple_id for update;
  room := g.target_points - g.current_points;
  applied := least(p_amount, room, c.points);
  if applied <= 0 then
    return g;
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (g.couple_id, auth.uid(), auth.uid(), g.title, -applied, 'goal');

  update public.goals set current_points = current_points + applied where id = p_goal_id returning * into g;

  return g;
end;
$$;

-- ============================================================================
-- 5. RLS: re-grant policies under the new table name, and tighten who may
--    resolve a request and who a penalty may target.
-- ============================================================================

drop policy if exists "users_select_self_or_partner" on public.profiles;
drop policy if exists "profiles_select_self_or_partner" on public.profiles;
create policy "profiles_select_self_or_partner" on public.profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.couple_members cm1
      join public.couple_members cm2 on cm1.couple_id = cm2.couple_id
      where cm1.user_id = auth.uid() and cm2.user_id = public.profiles.id
    )
  );

drop policy if exists "users_insert_self" on public.profiles;
drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "users_update_self" on public.profiles;
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
  for update using (id = auth.uid());

-- The requester/creator can no longer resolve their own reward request or
-- penalty directly against the table (defense in depth -- the RPCs above
-- already enforce this with a clearer error, but direct-table access is
-- blocked too).
drop policy if exists "reward_requests_update_member" on public.reward_requests;
drop policy if exists "reward_requests_update_partner" on public.reward_requests;
create policy "reward_requests_update_partner" on public.reward_requests
  for update using (public.is_couple_member(couple_id) and requested_by <> auth.uid());

drop policy if exists "penalties_update_member" on public.penalties;
drop policy if exists "penalties_update_partner" on public.penalties;
create policy "penalties_update_partner" on public.penalties
  for update using (public.is_couple_member(couple_id) and created_by <> auth.uid());

-- A penalty can only ever target the other member of the same couple --
-- never the creator themselves, never an outsider.
drop policy if exists "penalties_insert_member" on public.penalties;
create policy "penalties_insert_member" on public.penalties
  for insert with check (
    public.is_couple_member(couple_id)
    and created_by = auth.uid()
    and target_user_id <> auth.uid()
    and exists (
      select 1 from public.couple_members
      where couple_id = penalties.couple_id and user_id = penalties.target_user_id
    )
  );

-- ============================================================================
-- 6. Realtime for the renamed table
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null;
end $$;
