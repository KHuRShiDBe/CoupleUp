-- CoupleUp migration 0039: clean reset of mood to "one current mood per
-- user" -- replaces the broken, date-scoped mood_checkins model entirely.
--
-- Additive on top of every prior migration -- run this in the Supabase SQL
-- Editor. Safe to re-run: IF NOT EXISTS / OR REPLACE / guarded policy drops.
--
-- Does NOT touch or drop `mood_checkins` (migrations 0010/0014/0036) --
-- left in place, untouched, per explicit instruction not to delete an
-- existing table without confirmation. The app stops reading/writing it as
-- of this migration + the matching frontend change; its old rows are simply
-- no longer used by anything.
--
-- Why a new table instead of altering mood_checkins in place: the whole
-- shape is changing (one row per user per DAY, unique(user_id, checkin_date)
-- -> one row per user TOTAL, unique(user_id)) -- that's not a column tweak,
-- it's a different table. A fresh table also sidesteps the exact bug class
-- that broke mood_checkins (0010 granted insert but not update; 0036 had to
-- patch that in later) -- this one ships with select+insert+update policies
-- and grants from the start.

create table if not exists public.user_moods (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  mood text not null check (mood in ('great', 'good', 'okay', 'tired', 'low')),
  updated_at timestamptz not null default now()
);

alter table public.user_moods enable row level security;

drop policy if exists "user_moods_select_member" on public.user_moods;
create policy "user_moods_select_member" on public.user_moods
  for select using (public.is_couple_member(couple_id));

drop policy if exists "user_moods_insert_self" on public.user_moods;
create policy "user_moods_insert_self" on public.user_moods
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- Needed from day one this time: a plain upsert's ON CONFLICT (user_id) DO
-- UPDATE branch is a real UPDATE, which needs both a policy and a grant --
-- this is the exact gap that broke mood_checkins (fixed only later, in
-- migration 0036). No delete policy/grant -- nothing in the app ever
-- deletes a mood row.
drop policy if exists "user_moods_update_self" on public.user_moods;
create policy "user_moods_update_self" on public.user_moods
  for update using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

grant select, insert, update on public.user_moods to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_moods'
  ) then
    alter publication supabase_realtime add table public.user_moods;
  end if;
end $$;

notify pgrst, 'reload schema';
