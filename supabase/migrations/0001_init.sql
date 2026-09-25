-- CoupleUp initial schema, RLS policies and RPC functions.
-- Run once in the Supabase SQL Editor (or `supabase db push`) after creating the project.
-- Safe to re-run: every object uses "if not exists" / "or replace" where possible,
-- but on a totally fresh project a single run is enough.

create extension if not exists "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profile row for every authenticated user. auth.users is managed internally by
-- Supabase Auth; this table holds the app-specific profile fields.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Ты',
  role text check (role in ('male', 'female')),
  selected_avatar int,
  theme text check (theme in ('male', 'female')),
  created_at timestamptz not null default now()
);

create table if not exists public.couples (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid not null references public.users(id) on delete cascade,
  points int not null default 0,
  earned_points int not null default 0,
  spent_points int not null default 0,
  couple_streak int not null default 0,
  best_couple_streak int not null default 0,
  last_activity_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.couple_members (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

create table if not exists public.actions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  points int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  description text,
  cost int not null,
  category text,
  created_at timestamptz not null default now()
);

create table if not exists public.reward_requests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  reward_id uuid references public.rewards(id) on delete set null,
  requested_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  cost int not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  points int not null,
  assignee text not null default 'both' check (assignee in ('me', 'partner', 'both')),
  status text not null default 'active' check (status in ('active', 'completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  icon text,
  target_points int not null,
  current_points int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.penalties (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  points int not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.users enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.actions enable row level security;
alter table public.rewards enable row level security;
alter table public.reward_requests enable row level security;
alter table public.tasks enable row level security;
alter table public.goals enable row level security;
alter table public.penalties enable row level security;

-- Helper: is the current user a member of the given couple?
-- security definer so it can read couple_members without recursing through RLS.
create or replace function public.is_couple_member(target_couple uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.couple_members
    where couple_id = target_couple and user_id = auth.uid()
  );
$$;

drop policy if exists "users_select_self_or_partner" on public.users;
create policy "users_select_self_or_partner" on public.users
  for select using (
    id = auth.uid()
    or exists (
      select 1 from public.couple_members cm1
      join public.couple_members cm2 on cm1.couple_id = cm2.couple_id
      where cm1.user_id = auth.uid() and cm2.user_id = public.users.id
    )
  );

drop policy if exists "users_insert_self" on public.users;
create policy "users_insert_self" on public.users
  for insert with check (id = auth.uid());

drop policy if exists "users_update_self" on public.users;
create policy "users_update_self" on public.users
  for update using (id = auth.uid());

drop policy if exists "couples_select_member" on public.couples;
create policy "couples_select_member" on public.couples
  for select using (public.is_couple_member(id));

drop policy if exists "couples_update_member" on public.couples;
create policy "couples_update_member" on public.couples
  for update using (public.is_couple_member(id));

drop policy if exists "couples_insert_self" on public.couples;
create policy "couples_insert_self" on public.couples
  for insert with check (created_by = auth.uid());

drop policy if exists "couple_members_select_own" on public.couple_members;
create policy "couple_members_select_own" on public.couple_members
  for select using (user_id = auth.uid() or public.is_couple_member(couple_id));

drop policy if exists "couple_members_insert_self" on public.couple_members;
create policy "couple_members_insert_self" on public.couple_members
  for insert with check (user_id = auth.uid());

drop policy if exists "actions_select_member" on public.actions;
create policy "actions_select_member" on public.actions
  for select using (public.is_couple_member(couple_id));
drop policy if exists "actions_insert_member" on public.actions;
create policy "actions_insert_member" on public.actions
  for insert with check (public.is_couple_member(couple_id) and author_id = auth.uid());

drop policy if exists "rewards_select_member" on public.rewards;
create policy "rewards_select_member" on public.rewards
  for select using (public.is_couple_member(couple_id));
drop policy if exists "rewards_insert_member" on public.rewards;
create policy "rewards_insert_member" on public.rewards
  for insert with check (public.is_couple_member(couple_id));

drop policy if exists "reward_requests_select_member" on public.reward_requests;
create policy "reward_requests_select_member" on public.reward_requests
  for select using (public.is_couple_member(couple_id));
drop policy if exists "reward_requests_insert_member" on public.reward_requests;
create policy "reward_requests_insert_member" on public.reward_requests
  for insert with check (public.is_couple_member(couple_id) and requested_by = auth.uid());
drop policy if exists "reward_requests_update_member" on public.reward_requests;
create policy "reward_requests_update_member" on public.reward_requests
  for update using (public.is_couple_member(couple_id));

drop policy if exists "tasks_select_member" on public.tasks;
create policy "tasks_select_member" on public.tasks
  for select using (public.is_couple_member(couple_id));
drop policy if exists "tasks_insert_member" on public.tasks;
create policy "tasks_insert_member" on public.tasks
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
drop policy if exists "tasks_update_member" on public.tasks;
create policy "tasks_update_member" on public.tasks
  for update using (public.is_couple_member(couple_id));

drop policy if exists "goals_select_member" on public.goals;
create policy "goals_select_member" on public.goals
  for select using (public.is_couple_member(couple_id));
drop policy if exists "goals_insert_member" on public.goals;
create policy "goals_insert_member" on public.goals
  for insert with check (public.is_couple_member(couple_id));
drop policy if exists "goals_update_member" on public.goals;
create policy "goals_update_member" on public.goals
  for update using (public.is_couple_member(couple_id));

drop policy if exists "penalties_select_member" on public.penalties;
create policy "penalties_select_member" on public.penalties
  for select using (public.is_couple_member(couple_id));
drop policy if exists "penalties_insert_member" on public.penalties;
create policy "penalties_insert_member" on public.penalties
  for insert with check (public.is_couple_member(couple_id) and created_by = auth.uid());
drop policy if exists "penalties_update_member" on public.penalties;
create policy "penalties_update_member" on public.penalties
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- RPC FUNCTIONS
-- All multi-table / atomic operations go through security-definer RPCs instead
-- of letting the client run raw multi-step updates (avoids race conditions and
-- keeps the point math server-side).
-- ============================================================================

create or replace function public.generate_couple_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars (0/O, 1/I)
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.touch_couple_activity(p_couple_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  c public.couples;
  today date := current_date;
  next_streak int;
begin
  select * into c from public.couples where id = p_couple_id for update;
  if c.last_activity_date = today then
    return;
  elsif c.last_activity_date = today - interval '1 day' then
    next_streak := c.couple_streak + 1;
  else
    next_streak := 1;
  end if;

  update public.couples
  set couple_streak = next_streak,
      best_couple_streak = greatest(c.best_couple_streak, next_streak),
      last_activity_date = today
  where id = p_couple_id;
end;
$$;

-- Creates a new couple, generates a unique short code, and adds the caller as its first member.
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

  insert into public.couples (code, created_by)
  values (new_code, auth.uid())
  returning * into new_couple;

  insert into public.couple_members (couple_id, user_id)
  values (new_couple.id, auth.uid());

  return new_couple;
end;
$$;

-- Joins an existing couple by its short code. Idempotent for the same user,
-- rejects a second member once a couple already has two people.
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
    return target_couple;
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

-- Logs an action and atomically applies its points to the couple's balance.
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

  insert into public.actions (couple_id, author_id, title, points)
  values (p_couple_id, auth.uid(), p_title, p_points)
  returning * into new_action;

  update public.couples
  set points = points + p_points,
      earned_points = earned_points + greatest(p_points, 0),
      spent_points = spent_points + greatest(-p_points, 0)
  where id = p_couple_id;

  perform public.touch_couple_activity(p_couple_id);

  return new_action;
end;
$$;

-- Marks a task completed, logs it as an action, and applies its points.
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

  insert into public.actions (couple_id, author_id, title, points)
  values (t.couple_id, auth.uid(), t.title, t.points);

  update public.couples
  set points = points + t.points,
      earned_points = earned_points + t.points
  where id = t.couple_id;

  perform public.touch_couple_activity(t.couple_id);

  return t;
end;
$$;

-- Accepts or rejects a pending reward request; only accepting deducts points.
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
  if r.status <> 'pending' then
    return r;
  end if;

  update public.reward_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      resolved_at = now()
  where id = p_request_id
  returning * into r;

  if p_accept then
    update public.couples
    set points = points - r.cost,
        spent_points = spent_points + r.cost
    where id = r.couple_id;
  end if;

  return r;
end;
$$;

-- Confirms or rejects a pending penalty; only confirming deducts points (mirrors
-- the "partner must confirm" rule from the local mock flow).
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
  if p.status <> 'pending' then
    return p;
  end if;

  update public.penalties
  set status = case when p_accept then 'confirmed' else 'rejected' end,
      resolved_at = now()
  where id = p_penalty_id
  returning * into p;

  if p_accept then
    update public.couples
    set points = points - p.points,
        spent_points = spent_points + p.points
    where id = p.couple_id;

    perform public.touch_couple_activity(p.couple_id);
  end if;

  return p;
end;
$$;

-- Moves points from the couple's balance into a shared goal (capped at the
-- remaining room and at the couple's current balance).
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

  update public.couples set points = points - applied, spent_points = spent_points + applied where id = c.id;
  update public.goals set current_points = current_points + applied where id = p_goal_id returning * into g;

  return g;
end;
$$;

-- ============================================================================
-- REALTIME
-- ============================================================================

alter publication supabase_realtime add table
  public.couples,
  public.actions,
  public.tasks,
  public.reward_requests,
  public.goals,
  public.penalties;
