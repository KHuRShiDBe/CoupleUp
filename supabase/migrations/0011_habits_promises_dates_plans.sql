-- CoupleUp migration 0011: habits, promises, saved date ideas, wants, plan
-- board.
--
-- Seven new tables, all additive, none touching pairing/auth/points ledger:
--   - habits            (Couple Habits)
--   - habit_logs        (daily completion log, drives streaks client-side)
--   - promises          (Promises, with completion -> tiny real points via
--                        the existing apply_action() RPC, not a new balance)
--   - date_idea_saves   ("Хотим попробовать" -- the browsable idea/category
--                        list itself is static content, shipped in the app,
--                        not stored here)
--   - wants             (Want / Don't want, both tagged by author)
--   - surprise_ideas    (PRIVATE: only the author can see their own rows --
--                        see the RLS policies below, deliberately NOT the
--                        usual "any couple member" pattern)
--   - plan_items        (Couple Plan Board: today/week/month/someday)
--
-- All couple-scoped tables (everything except the surprise_ideas privacy
-- carve-out) use the same is_couple_member() RLS pattern already used by
-- every other couple table. Realtime is added for the ones both partners
-- need to see live; surprise_ideas is intentionally NOT added to realtime
-- or shared in any way -- it's single-user data that happens to carry a
-- couple_id for cleanup-on-leave-couple purposes only.
--
-- Safe to re-run: guarded create/policy/grant statements throughout.

-- ============================================================================
-- 1. habits + habit_logs
-- ============================================================================

create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  assignee text not null default 'both' check (assignee in ('me', 'partner', 'both')),
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

drop policy if exists "habits_select_member" on public.habits;
create policy "habits_select_member" on public.habits
  for select using (public.is_couple_member(couple_id));

drop policy if exists "habits_insert_member" on public.habits;
create policy "habits_insert_member" on public.habits
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (habit_id, user_id, log_date)
);

alter table public.habit_logs enable row level security;

drop policy if exists "habit_logs_select_member" on public.habit_logs;
create policy "habit_logs_select_member" on public.habit_logs
  for select using (public.is_couple_member(couple_id));

drop policy if exists "habit_logs_insert_self" on public.habit_logs;
create policy "habit_logs_insert_self" on public.habit_logs
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 2. promises
-- ============================================================================

create table if not exists public.promises (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.promises enable row level security;

drop policy if exists "promises_select_member" on public.promises;
create policy "promises_select_member" on public.promises
  for select using (public.is_couple_member(couple_id));

drop policy if exists "promises_insert_member" on public.promises;
create policy "promises_insert_member" on public.promises
  for insert with check (from_user_id = auth.uid() and public.is_couple_member(couple_id));

-- Either side of the promise may update its status (mark complete/cancelled).
drop policy if exists "promises_update_member" on public.promises;
create policy "promises_update_member" on public.promises
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- 3. date_idea_saves ("Хотим попробовать" -- the idea/category catalog
--    itself is static app content, not stored server-side)
-- ============================================================================

create table if not exists public.date_idea_saves (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  idea_key text,
  title text not null,
  category text not null,
  price_usd numeric,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.date_idea_saves enable row level security;

drop policy if exists "date_idea_saves_select_member" on public.date_idea_saves;
create policy "date_idea_saves_select_member" on public.date_idea_saves
  for select using (public.is_couple_member(couple_id));

drop policy if exists "date_idea_saves_insert_member" on public.date_idea_saves;
create policy "date_idea_saves_insert_member" on public.date_idea_saves
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 4. wants (Want / Don't want -- tagged by author, both partners can read)
-- ============================================================================

create table if not exists public.wants (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('want', 'dont_want')),
  text text not null,
  created_at timestamptz not null default now()
);

alter table public.wants enable row level security;

drop policy if exists "wants_select_member" on public.wants;
create policy "wants_select_member" on public.wants
  for select using (public.is_couple_member(couple_id));

drop policy if exists "wants_insert_self" on public.wants;
create policy "wants_insert_self" on public.wants
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 5. surprise_ideas -- PRIVATE. Deliberately NOT the couple-wide select
--    policy used everywhere else: only the author can ever read their own
--    rows. couple_id is stored only so these rows get cleaned up correctly
--    if ever needed; it grants no read access to the partner.
-- ============================================================================

create table if not exists public.surprise_ideas (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  note text,
  price_usd numeric,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table public.surprise_ideas enable row level security;

drop policy if exists "surprise_ideas_select_own" on public.surprise_ideas;
create policy "surprise_ideas_select_own" on public.surprise_ideas
  for select using (author_id = auth.uid());

drop policy if exists "surprise_ideas_insert_own" on public.surprise_ideas;
create policy "surprise_ideas_insert_own" on public.surprise_ideas
  for insert with check (author_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "surprise_ideas_delete_own" on public.surprise_ideas;
create policy "surprise_ideas_delete_own" on public.surprise_ideas
  for delete using (author_id = auth.uid());

-- ============================================================================
-- 6. plan_items (Couple Plan Board: today / week / month / someday)
-- ============================================================================

create table if not exists public.plan_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('date', 'task', 'goal', 'purchase', 'trip', 'event')),
  title text not null,
  bucket text not null check (bucket in ('today', 'week', 'month', 'someday')),
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.plan_items enable row level security;

drop policy if exists "plan_items_select_member" on public.plan_items;
create policy "plan_items_select_member" on public.plan_items
  for select using (public.is_couple_member(couple_id));

drop policy if exists "plan_items_insert_member" on public.plan_items;
create policy "plan_items_insert_member" on public.plan_items
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "plan_items_update_member" on public.plan_items;
create policy "plan_items_update_member" on public.plan_items
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- 7. Base table privileges (see migration 0005: RLS alone is not enough).
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert on public.habits to authenticated;
grant select, insert on public.habit_logs to authenticated;
grant select, insert, update on public.promises to authenticated;
grant select, insert on public.date_idea_saves to authenticated;
grant select, insert on public.wants to authenticated;
grant select, insert, delete on public.surprise_ideas to authenticated;
grant select, insert, update on public.plan_items to authenticated;

-- ============================================================================
-- 8. Realtime for the couple-shared tables. surprise_ideas is deliberately
--    excluded -- it is single-user data and must never broadcast to the
--    partner.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'habits') then
    alter publication supabase_realtime add table public.habits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'habit_logs') then
    alter publication supabase_realtime add table public.habit_logs;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'promises') then
    alter publication supabase_realtime add table public.promises;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'date_idea_saves') then
    alter publication supabase_realtime add table public.date_idea_saves;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wants') then
    alter publication supabase_realtime add table public.wants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'plan_items') then
    alter publication supabase_realtime add table public.plan_items;
  end if;
end $$;
