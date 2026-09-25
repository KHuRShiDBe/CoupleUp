-- CoupleUp migration 0019: Daily Required Actions + Daily Bonus + Daily
-- Reward Wheel + Daily Calendar backend.
--
-- Two new tables, both RPC-write-only (no client insert/update policy --
-- same reasoning as truth_or_dare_progress/game_reward_claims in 0018): the
-- three RPCs below are the only way points ever get awarded here, so a
-- client can never forge a completion or spin the wheel twice.
--
--   - daily_action_completions: one row per (couple, action, calendar day)
--     that was actually completed. The SET of which 3-5 actions apply on a
--     given day is never stored -- it's deterministic client-side content
--     (see src/constants/dailyActions.ts, seeded by couple_id + date), the
--     same "static content, real completion state" split as every other
--     game/challenge already in this app.
--   - daily_progress: one row per (couple, calendar day) tracking whether
--     that day's completion bonus and wheel spin have already been claimed.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- 1. daily_action_completions
-- ============================================================================

create table if not exists public.daily_action_completions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  action_id text not null,
  action_date date not null,
  completed_by uuid references public.profiles(id) on delete set null,
  points int not null,
  created_at timestamptz not null default now(),
  unique (couple_id, action_id, action_date)
);

alter table public.daily_action_completions enable row level security;

drop policy if exists "daily_action_completions_select_member" on public.daily_action_completions;
create policy "daily_action_completions_select_member" on public.daily_action_completions
  for select using (public.is_couple_member(couple_id));

-- No insert policy for clients -- only complete_daily_action() below writes
-- here (security definer), so "same action twice today" can't be bypassed
-- by calling the table directly instead of the RPC.

grant usage on schema public to authenticated;
grant select on public.daily_action_completions to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_action_completions') then
    alter publication supabase_realtime add table public.daily_action_completions;
  end if;
end $$;

-- ============================================================================
-- 2. daily_progress
-- ============================================================================

create table if not exists public.daily_progress (
  couple_id uuid not null references public.couples(id) on delete cascade,
  progress_date date not null,
  bonus_claimed boolean not null default false,
  wheel_spun boolean not null default false,
  wheel_reward_points int,
  updated_at timestamptz not null default now(),
  primary key (couple_id, progress_date)
);

alter table public.daily_progress enable row level security;

drop policy if exists "daily_progress_select_member" on public.daily_progress;
create policy "daily_progress_select_member" on public.daily_progress
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy for clients -- only claim_daily_bonus() and
-- spin_daily_reward_wheel() below (both security definer) may write.

grant select on public.daily_progress to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_progress') then
    alter publication supabase_realtime add table public.daily_progress;
  end if;
end $$;

-- ============================================================================
-- 3. complete_daily_action -- guarded by daily_action_completions' own
--    unique(couple_id, action_id, action_date): a second call for the same
--    action/day is a no-op (returns false), never a second payout.
-- ============================================================================

create or replace function public.complete_daily_action(
  p_couple_id uuid,
  p_action_id text,
  p_action_date date,
  p_points int,
  p_title text
)
returns boolean
language plpgsql
security definer
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.daily_action_completions (couple_id, action_id, action_date, completed_by, points)
  values (p_couple_id, p_action_id, p_action_date, auth.uid(), p_points);

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, 'action');

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 4. claim_daily_bonus -- re-checks the ACTUAL completed count server-side
--    (never trusts "all done" from the client alone) against the required
--    count the client computed from the same deterministic daily set, then
--    pays out at most once per (couple, day) via daily_progress.bonus_claimed.
-- ============================================================================

create or replace function public.claim_daily_bonus(
  p_couple_id uuid,
  p_action_date date,
  p_required_count int,
  p_bonus_points int,
  p_title text
)
returns boolean
language plpgsql
security definer
as $$
declare
  actual_count int;
  row_ public.daily_progress;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select count(*) into actual_count
  from public.daily_action_completions
  where couple_id = p_couple_id and action_date = p_action_date;

  if actual_count < p_required_count then
    raise exception 'DAILY_ACTIONS_INCOMPLETE';
  end if;

  insert into public.daily_progress (couple_id, progress_date, bonus_claimed)
  values (p_couple_id, p_action_date, false)
  on conflict (couple_id, progress_date) do nothing;

  select * into row_ from public.daily_progress where couple_id = p_couple_id and progress_date = p_action_date for update;

  if row_.bonus_claimed then
    return false;
  end if;

  update public.daily_progress set bonus_claimed = true, updated_at = now()
  where couple_id = p_couple_id and progress_date = p_action_date;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_bonus_points, 'action');

  return true;
end;
$$;

-- ============================================================================
-- 5. spin_daily_reward_wheel -- NOT gambling: no stake, no purchase, a fixed
--    small set of pre-defined point values, at most one spin per couple per
--    day. The outcome is picked server-side (never trust a client-reported
--    result) and guarded by daily_progress.wheel_spun.
-- ============================================================================

create or replace function public.spin_daily_reward_wheel(
  p_couple_id uuid,
  p_action_date date,
  p_title text
)
returns int
language plpgsql
security definer
as $$
declare
  row_ public.daily_progress;
  wheel_values int[] := array[5, 10, 15, 20, 25, 30];
  reward int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.daily_progress (couple_id, progress_date, wheel_spun)
  values (p_couple_id, p_action_date, false)
  on conflict (couple_id, progress_date) do nothing;

  select * into row_ from public.daily_progress where couple_id = p_couple_id and progress_date = p_action_date for update;

  if row_.wheel_spun then
    raise exception 'WHEEL_ALREADY_SPUN';
  end if;

  reward := wheel_values[1 + floor(random() * array_length(wheel_values, 1))::int];

  update public.daily_progress
  set wheel_spun = true, wheel_reward_points = reward, updated_at = now()
  where couple_id = p_couple_id and progress_date = p_action_date;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, reward, 'action');

  return reward;
end;
$$;
