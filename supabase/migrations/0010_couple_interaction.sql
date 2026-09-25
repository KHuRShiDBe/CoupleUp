-- CoupleUp migration 0010: couple interaction + engagement features.
--
-- New tables for the four features that genuinely need to be shared live
-- between both partners (so they can't be local-only AsyncStorage data):
--   - mood_checkins    (Daily Check-in / Mood History)
--   - daily_answers    (Question of the Day, real per-user answers)
--   - couple_moments   (Couple Moments timeline)
--   - important_dates  (Anniversary / Important Dates)
-- All four are couple-scoped (couple_id), RLS-protected to members of that
-- couple only, and added to the realtime publication so a partner's
-- check-in/answer/moment/date appears live on the other phone.
--
-- Compliments do NOT get a new table -- they're logged through the existing
-- apply_action() RPC/public.actions ledger (same real points/History
-- pipeline from the COUPLE POINTS VISIBILITY package), just tagged with a
-- new 'compliment' action type so they can be counted separately from
-- regular actions. This keeps one single source of truth for "what appears
-- in History" instead of a second parallel feed.
--
-- Does not touch pairing, couples, couple_members, or the core points
-- trigger. Safe to re-run: every statement is guarded (if not exists /
-- or replace / drop-if-exists-then-add), no data is dropped.

-- ============================================================================
-- 1. mood_checkins
-- ============================================================================

create table if not exists public.mood_checkins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood text not null check (mood in ('great', 'good', 'okay', 'tired', 'low')),
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, checkin_date)
);

alter table public.mood_checkins enable row level security;

drop policy if exists "mood_checkins_select_member" on public.mood_checkins;
create policy "mood_checkins_select_member" on public.mood_checkins
  for select using (public.is_couple_member(couple_id));

drop policy if exists "mood_checkins_insert_self" on public.mood_checkins;
create policy "mood_checkins_insert_self" on public.mood_checkins
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 2. daily_answers (real per-user answers to the existing deterministic
--    Question of the Day -- the question text itself stays client-computed
--    from the date, identical on both phones, so it doesn't need storing).
-- ============================================================================

create table if not exists public.daily_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_date date not null default current_date,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (user_id, question_date)
);

alter table public.daily_answers enable row level security;

drop policy if exists "daily_answers_select_member" on public.daily_answers;
create policy "daily_answers_select_member" on public.daily_answers
  for select using (public.is_couple_member(couple_id));

drop policy if exists "daily_answers_insert_self" on public.daily_answers;
create policy "daily_answers_insert_self" on public.daily_answers
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 3. couple_moments
-- ============================================================================

create table if not exists public.couple_moments (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  moment_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.couple_moments enable row level security;

drop policy if exists "couple_moments_select_member" on public.couple_moments;
create policy "couple_moments_select_member" on public.couple_moments
  for select using (public.is_couple_member(couple_id));

drop policy if exists "couple_moments_insert_member" on public.couple_moments;
create policy "couple_moments_insert_member" on public.couple_moments
  for insert with check (author_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 4. important_dates
-- ============================================================================

create table if not exists public.important_dates (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('anniversary', 'met_day', 'wedding_day', 'partner_birthday', 'custom')),
  label text not null,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.important_dates enable row level security;

drop policy if exists "important_dates_select_member" on public.important_dates;
create policy "important_dates_select_member" on public.important_dates
  for select using (public.is_couple_member(couple_id));

drop policy if exists "important_dates_insert_member" on public.important_dates;
create policy "important_dates_insert_member" on public.important_dates
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 5. Base table privileges -- learned from migration 0005: RLS policies
--    alone are not enough, the `authenticated` role also needs the coarser
--    Postgres GRANT or every direct query 42501s regardless of policy
--    content.
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert on public.mood_checkins to authenticated;
grant select, insert on public.daily_answers to authenticated;
grant select, insert on public.couple_moments to authenticated;
grant select, insert on public.important_dates to authenticated;

-- ============================================================================
-- 6. Realtime -- so a partner's check-in/answer/moment/date shows up live.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mood_checkins'
  ) then
    alter publication supabase_realtime add table public.mood_checkins;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_answers'
  ) then
    alter publication supabase_realtime add table public.daily_answers;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_moments'
  ) then
    alter publication supabase_realtime add table public.couple_moments;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'important_dates'
  ) then
    alter publication supabase_realtime add table public.important_dates;
  end if;
end $$;

-- ============================================================================
-- 7. Compliments: extend actions.type to allow 'compliment', and let
--    apply_action() write that type. Drops whatever the (possibly
--    auto-named) existing check constraint on actions.type is, by looking
--    it up rather than assuming a name, then re-adds it widened.
-- ============================================================================

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.actions'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%type%in%'
  loop
    execute format('alter table public.actions drop constraint %I', con.conname);
  end loop;
end $$;

alter table public.actions add constraint actions_type_check
  check (type in ('action', 'task', 'reward', 'penalty', 'goal', 'compliment'));

create or replace function public.apply_action(
  p_couple_id uuid,
  p_title text,
  p_points int,
  p_recipient_id uuid default null,
  p_type text default 'action'
)
returns public.actions
language plpgsql
security definer
as $$
declare
  new_action public.actions;
  target_recipient uuid := coalesce(p_recipient_id, auth.uid());
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = target_recipient
  ) then
    raise exception 'RECIPIENT_NOT_IN_COUPLE';
  end if;

  if p_type not in ('action', 'compliment') then
    raise exception 'INVALID_TYPE';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, p_type)
  returning * into new_action;

  return new_action;
end;
$$;
