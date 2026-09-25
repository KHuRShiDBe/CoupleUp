-- CoupleUp migration 0013: weekly/daily challenges, achievements, reward
-- chest claims, couple quiz.
--
-- Five new tables, all additive, none touching pairing/auth/points ledger:
--   - challenge_progress   (weekly challenge completion, per couple/week)
--   - daily_challenges     (today's shared daily challenge, completed once
--                           per couple per day, same for both partners)
--   - achievement_unlocks  (permanent record: once unlocked, always stays
--                           unlocked even if the underlying stat later drops
--                           -- e.g. streak resetting to 0)
--   - reward_claims        (which fixed-reward "couple chest" milestones
--                           have already been claimed -- prevents claiming
--                           the same guaranteed reward twice)
--   - quiz_answers         (Couple Quiz -- each partner's answer, so they
--                           can be compared once both have answered)
--
-- Deliberately NOT created: a "couple_levels" table. XP/level is entirely
-- derived client-side from data that already exists for real (actions,
-- habit_logs, daily_answers, promises, challenge_progress) -- there is
-- nothing to store beyond what's already real, so no new table for it.
--
-- Every table uses the same is_couple_member() RLS pattern as the rest of
-- the app. Realtime is enabled on all five so both phones stay in sync.
--
-- Also (section 8): wires habit_logs / promises / daily_answers / plan_items
-- into the existing touch_couple_activity() so the couple streak reflects
-- ALL real shared activity, not just actions/tasks/penalties/goals.
--
-- Safe to re-run: guarded create/policy/grant statements throughout.

-- ============================================================================
-- 1. challenge_progress (weekly challenges)
-- ============================================================================

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  week_key text not null,
  challenge_key text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  reward_claimed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (couple_id, week_key, challenge_key)
);

alter table public.challenge_progress enable row level security;

drop policy if exists "challenge_progress_select_member" on public.challenge_progress;
create policy "challenge_progress_select_member" on public.challenge_progress
  for select using (public.is_couple_member(couple_id));

drop policy if exists "challenge_progress_insert_member" on public.challenge_progress;
create policy "challenge_progress_insert_member" on public.challenge_progress
  for insert with check (public.is_couple_member(couple_id));

drop policy if exists "challenge_progress_update_member" on public.challenge_progress;
create policy "challenge_progress_update_member" on public.challenge_progress
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- 2. daily_challenges (one shared challenge per couple per day -- the
--    challenge itself is deterministic client-side content keyed by date;
--    this row only records that the couple completed *today's*, and by whom)
-- ============================================================================

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  challenge_date date not null default current_date,
  completed_by uuid not null references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique (couple_id, challenge_date)
);

alter table public.daily_challenges enable row level security;

drop policy if exists "daily_challenges_select_member" on public.daily_challenges;
create policy "daily_challenges_select_member" on public.daily_challenges
  for select using (public.is_couple_member(couple_id));

drop policy if exists "daily_challenges_insert_member" on public.daily_challenges;
create policy "daily_challenges_insert_member" on public.daily_challenges
  for insert with check (completed_by = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 3. achievement_unlocks (permanent -- inserted once, never removed)
-- ============================================================================

create table if not exists public.achievement_unlocks (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  achievement_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (couple_id, achievement_key)
);

alter table public.achievement_unlocks enable row level security;

drop policy if exists "achievement_unlocks_select_member" on public.achievement_unlocks;
create policy "achievement_unlocks_select_member" on public.achievement_unlocks
  for select using (public.is_couple_member(couple_id));

drop policy if exists "achievement_unlocks_insert_member" on public.achievement_unlocks;
create policy "achievement_unlocks_insert_member" on public.achievement_unlocks
  for insert with check (public.is_couple_member(couple_id));

-- ============================================================================
-- 4. reward_claims (guaranteed fixed reward per milestone, claimed once)
-- ============================================================================

create table if not exists public.reward_claims (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  milestone_key text not null,
  points_awarded int not null,
  claimed_by uuid not null references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (couple_id, milestone_key)
);

alter table public.reward_claims enable row level security;

drop policy if exists "reward_claims_select_member" on public.reward_claims;
create policy "reward_claims_select_member" on public.reward_claims
  for select using (public.is_couple_member(couple_id));

drop policy if exists "reward_claims_insert_member" on public.reward_claims;
create policy "reward_claims_insert_member" on public.reward_claims
  for insert with check (claimed_by = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 5. quiz_answers (Couple Quiz -- separate answers, compared once both exist)
-- ============================================================================

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, user_id, question_key)
);

alter table public.quiz_answers enable row level security;

drop policy if exists "quiz_answers_select_member" on public.quiz_answers;
create policy "quiz_answers_select_member" on public.quiz_answers
  for select using (public.is_couple_member(couple_id));

drop policy if exists "quiz_answers_insert_self" on public.quiz_answers;
create policy "quiz_answers_insert_self" on public.quiz_answers
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 6. Base table privileges (see migration 0005: RLS alone is not enough).
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update on public.challenge_progress to authenticated;
grant select, insert on public.daily_challenges to authenticated;
grant select, insert on public.achievement_unlocks to authenticated;
grant select, insert on public.reward_claims to authenticated;
grant select, insert on public.quiz_answers to authenticated;

-- ============================================================================
-- 7. Realtime -- all five are couple-shared, so both phones stay in sync.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'challenge_progress') then
    alter publication supabase_realtime add table public.challenge_progress;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_challenges') then
    alter publication supabase_realtime add table public.daily_challenges;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'achievement_unlocks') then
    alter publication supabase_realtime add table public.achievement_unlocks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reward_claims') then
    alter publication supabase_realtime add table public.reward_claims;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quiz_answers') then
    alter publication supabase_realtime add table public.quiz_answers;
  end if;
end $$;

-- ============================================================================
-- 8. Couple streak -- wire the REAL activity sources this package adds into
-- the existing public.touch_couple_activity() (migration 0001), which already
-- maintains couples.couple_streak / best_couple_streak / last_activity_date.
-- Previously only actions/tasks/penalties/goals touched it; a day where the
-- only thing that happened was a habit log, a completed promise, both
-- partners answering the daily question, or a completed date plan item
-- would NOT have counted as an active day, contradicting "at least one
-- meaningful shared activity". These triggers close that gap. No fake days:
-- every trigger fires only on a real state change (a genuine insert, a
-- promise actually reaching 'completed', or the second distinct partner's
-- answer landing for the same question_date).
-- ============================================================================

create or replace function public.touch_activity_on_habit_log()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.touch_couple_activity(new.couple_id);
  return new;
end;
$$;

drop trigger if exists trg_touch_activity_habit_log on public.habit_logs;
create trigger trg_touch_activity_habit_log
  after insert on public.habit_logs
  for each row execute function public.touch_activity_on_habit_log();

create or replace function public.touch_activity_on_promise_completed()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.touch_couple_activity(new.couple_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_activity_promise on public.promises;
create trigger trg_touch_activity_promise
  after update on public.promises
  for each row execute function public.touch_activity_on_promise_completed();

create or replace function public.touch_activity_on_daily_answer()
returns trigger
language plpgsql
security definer
as $$
declare
  answered_count int;
begin
  select count(distinct user_id) into answered_count
  from public.daily_answers
  where couple_id = new.couple_id and question_date = new.question_date;

  if answered_count >= 2 then
    perform public.touch_couple_activity(new.couple_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_activity_daily_answer on public.daily_answers;
create trigger trg_touch_activity_daily_answer
  after insert on public.daily_answers
  for each row execute function public.touch_activity_on_daily_answer();

create or replace function public.touch_activity_on_date_done()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.kind = 'date' and new.done = true and old.done = false then
    perform public.touch_couple_activity(new.couple_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_activity_plan_item on public.plan_items;
create trigger trg_touch_activity_plan_item
  after update on public.plan_items
  for each row execute function public.touch_activity_on_date_done();
