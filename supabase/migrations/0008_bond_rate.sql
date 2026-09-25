-- CoupleUp migration 0008: BOND exchange rate table.
--
-- BOND is purely a display/denomination layer over the existing points
-- ledger -- it is NOT a new balance, NOT real money, NOT a payout, and does
-- NOT touch pairing/actions/couples in any way. The core unit of the app
-- stays "points" (public.actions, public.couples.points/earned_points/
-- spent_points), completely unchanged by this migration.
--
-- This table only stores the points-per-BOND exchange rate over time, so
-- both partners always see the same rate (it can't live in local app state),
-- and so a rate change doesn't retroactively alter what a past reward
-- request's price meant in BOND ("снимок курса" is taken client-side at
-- request time and stored on the local request itself, not here -- the
-- reward_requests table is currently unused by the client, still fully
-- local-mock, so nothing there needed to change).
--
-- Global, not couple-scoped: the rate applies to the whole app, not one
-- couple, so there is no couple_id and no per-couple RLS filtering -- every
-- authenticated user may read it (nothing sensitive), and only insert is
-- possible (no update/delete), i.e. a rate change is a new row, keeping full
-- history automatically. No client write path is granted in this pass --
-- add a new rate row directly in the SQL editor when the weekly rate
-- changes.
--
-- Safe to re-run: guarded create/seed, no data dropped.

create table if not exists public.bond_rates (
  id uuid primary key default gen_random_uuid(),
  points_per_bond int not null check (points_per_bond > 0),
  effective_from timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.bond_rates enable row level security;

drop policy if exists "bond_rates_select_all" on public.bond_rates;
create policy "bond_rates_select_all" on public.bond_rates
  for select using (true);

grant usage on schema public to authenticated;
grant select on public.bond_rates to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bond_rates'
  ) then
    alter publication supabase_realtime add table public.bond_rates;
  end if;
end $$;

-- Seed the base rate (100 points = 1 BOND ~= $1) if the table is empty --
-- never overwrites a rate that's already been set.
insert into public.bond_rates (points_per_bond, effective_from)
select 100, now()
where not exists (select 1 from public.bond_rates);
