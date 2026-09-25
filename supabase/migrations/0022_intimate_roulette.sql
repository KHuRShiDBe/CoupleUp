-- CoupleUp migration 0022: Intimate Roulette -- per-partner consent, shared
-- allowed-category toggles, and a short spin-result history.
--
-- No points/payout involved anywhere in this feature, so unlike the RPC-only
-- tables elsewhere in this app, plain client-writable insert/update under RLS
-- is enough -- there's nothing here worth forging.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- 1. intimate_roulette_consent -- one row per (couple, user). A user may only
--    ever write their OWN row (RLS: user_id = auth.uid()) -- consent can
--    never be set on someone else's behalf.
-- ============================================================================

create table if not exists public.intimate_roulette_consent (
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  consented boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);

alter table public.intimate_roulette_consent enable row level security;

drop policy if exists "intimate_roulette_consent_select_member" on public.intimate_roulette_consent;
create policy "intimate_roulette_consent_select_member" on public.intimate_roulette_consent
  for select using (public.is_couple_member(couple_id));

drop policy if exists "intimate_roulette_consent_upsert_self" on public.intimate_roulette_consent;
create policy "intimate_roulette_consent_upsert_self" on public.intimate_roulette_consent
  for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());

drop policy if exists "intimate_roulette_consent_update_self" on public.intimate_roulette_consent;
create policy "intimate_roulette_consent_update_self" on public.intimate_roulette_consent
  for update using (user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update on public.intimate_roulette_consent to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'intimate_roulette_consent') then
    alter publication supabase_realtime add table public.intimate_roulette_consent;
  end if;
end $$;

-- ============================================================================
-- 2. intimate_roulette_settings -- one row per couple, the shared "allowed
--    today" category toggles. Either partner may update it (same trust level
--    as e.g. budgets -- a shared setting, not a private one).
-- ============================================================================

create table if not exists public.intimate_roulette_settings (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  allowed jsonb not null default '{"tender":true,"active":true,"dominant":true,"blindfold":true,"bondage":true,"roleplay":true}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.intimate_roulette_settings enable row level security;

drop policy if exists "intimate_roulette_settings_select_member" on public.intimate_roulette_settings;
create policy "intimate_roulette_settings_select_member" on public.intimate_roulette_settings
  for select using (public.is_couple_member(couple_id));

drop policy if exists "intimate_roulette_settings_insert_member" on public.intimate_roulette_settings;
create policy "intimate_roulette_settings_insert_member" on public.intimate_roulette_settings
  for insert with check (public.is_couple_member(couple_id));

drop policy if exists "intimate_roulette_settings_update_member" on public.intimate_roulette_settings;
create policy "intimate_roulette_settings_update_member" on public.intimate_roulette_settings
  for update using (public.is_couple_member(couple_id));

grant select, insert, update on public.intimate_roulette_settings to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'intimate_roulette_settings') then
    alter publication supabase_realtime add table public.intimate_roulette_settings;
  end if;
end $$;

-- ============================================================================
-- 3. intimate_roulette_results -- append-only spin history. No update/delete
--    policy -- once spun, a result is a permanent (if short-lived, the app
--    only shows the last 5) log entry.
-- ============================================================================

create table if not exists public.intimate_roulette_results (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  result_key text not null,
  spun_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.intimate_roulette_results enable row level security;

drop policy if exists "intimate_roulette_results_select_member" on public.intimate_roulette_results;
create policy "intimate_roulette_results_select_member" on public.intimate_roulette_results
  for select using (public.is_couple_member(couple_id));

drop policy if exists "intimate_roulette_results_insert_member" on public.intimate_roulette_results;
create policy "intimate_roulette_results_insert_member" on public.intimate_roulette_results
  for insert with check (public.is_couple_member(couple_id) and spun_by = auth.uid());

grant select, insert on public.intimate_roulette_results to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'intimate_roulette_results') then
    alter publication supabase_realtime add table public.intimate_roulette_results;
  end if;
end $$;
