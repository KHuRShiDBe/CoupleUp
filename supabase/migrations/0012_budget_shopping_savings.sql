-- CoupleUp migration 0012: shared shopping list, budget, expenses, savings
-- goals, and purchase requests.
--
-- Six new tables, all additive, none touching pairing/auth/points ledger:
--   - shopping_items       (Shared Shopping List, with "who pays")
--   - budgets              (monthly planned amount per category)
--   - expenses             (manually entered spend, one row per expense)
--   - savings_goals        (Savings Goal, e.g. "vacation")
--   - savings_contributions (who put in how much toward a savings goal)
--   - purchase_requests    ("Покупка" request type: propose -> partner
--                           approves/declines, no real payment)
--
-- All amounts are stored as USD-equivalent numerics -- BOND/points are
-- purely a display conversion (useBond() client-side), computed live except
-- on purchase_requests, which snapshots the rate at creation time (same
-- pattern as custom reward requests) so an approval later isn't affected by
-- a rate change in between.
--
-- Every table uses the same is_couple_member() RLS pattern as the rest of
-- the app: a user can only ever see/write their own couple's rows. Realtime
-- is enabled on all six so both phones stay in sync.
--
-- Safe to re-run: guarded create/policy/grant statements throughout.

-- ============================================================================
-- 1. shopping_items
-- ============================================================================

create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  quantity int not null default 1 check (quantity > 0),
  price_usd numeric,
  added_by uuid not null references public.profiles(id) on delete cascade,
  payer_mode text not null default 'undetermined' check (payer_mode in ('assigned', 'together', 'undetermined')),
  payer_user_id uuid references public.profiles(id) on delete set null,
  purchased boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.shopping_items enable row level security;

drop policy if exists "shopping_items_select_member" on public.shopping_items;
create policy "shopping_items_select_member" on public.shopping_items
  for select using (public.is_couple_member(couple_id));

drop policy if exists "shopping_items_insert_member" on public.shopping_items;
create policy "shopping_items_insert_member" on public.shopping_items
  for insert with check (added_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "shopping_items_update_member" on public.shopping_items;
create policy "shopping_items_update_member" on public.shopping_items
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- 2. budgets (one row per couple/category/month)
-- ============================================================================

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  category text not null check (category in ('food', 'home', 'fun', 'transport', 'gifts', 'travel', 'other')),
  month date not null,
  planned_usd numeric not null check (planned_usd >= 0),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (couple_id, category, month)
);

alter table public.budgets enable row level security;

drop policy if exists "budgets_select_member" on public.budgets;
create policy "budgets_select_member" on public.budgets
  for select using (public.is_couple_member(couple_id));

drop policy if exists "budgets_insert_member" on public.budgets;
create policy "budgets_insert_member" on public.budgets
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "budgets_update_member" on public.budgets;
create policy "budgets_update_member" on public.budgets
  for update using (public.is_couple_member(couple_id));

-- ============================================================================
-- 3. expenses (manual entry only -- no bank connection)
-- ============================================================================

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  amount_usd numeric not null check (amount_usd > 0),
  category text not null check (category in ('food', 'home', 'fun', 'transport', 'gifts', 'travel', 'other')),
  paid_by uuid not null references public.profiles(id) on delete cascade,
  expense_date date not null default current_date,
  note text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.expenses enable row level security;

drop policy if exists "expenses_select_member" on public.expenses;
create policy "expenses_select_member" on public.expenses
  for select using (public.is_couple_member(couple_id));

drop policy if exists "expenses_insert_member" on public.expenses;
create policy "expenses_insert_member" on public.expenses
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 4. savings_goals + savings_contributions
-- ============================================================================

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  title text not null,
  target_usd numeric not null check (target_usd > 0),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.savings_goals enable row level security;

drop policy if exists "savings_goals_select_member" on public.savings_goals;
create policy "savings_goals_select_member" on public.savings_goals
  for select using (public.is_couple_member(couple_id));

drop policy if exists "savings_goals_insert_member" on public.savings_goals;
create policy "savings_goals_insert_member" on public.savings_goals
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

create table if not exists public.savings_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_usd numeric not null check (amount_usd > 0),
  created_at timestamptz not null default now()
);

alter table public.savings_contributions enable row level security;

drop policy if exists "savings_contributions_select_member" on public.savings_contributions;
create policy "savings_contributions_select_member" on public.savings_contributions
  for select using (public.is_couple_member(couple_id));

drop policy if exists "savings_contributions_insert_self" on public.savings_contributions;
create policy "savings_contributions_insert_self" on public.savings_contributions
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 5. purchase_requests ("Покупка" request type -- approve/decline only, no
--    real payment; rate is snapshotted at creation so a later rate change
--    doesn't alter what this request originally asked for).
-- ============================================================================

create table if not exists public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  price_usd numeric not null check (price_usd > 0),
  rate_snapshot int not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.purchase_requests enable row level security;

drop policy if exists "purchase_requests_select_member" on public.purchase_requests;
create policy "purchase_requests_select_member" on public.purchase_requests
  for select using (public.is_couple_member(couple_id));

drop policy if exists "purchase_requests_insert_member" on public.purchase_requests;
create policy "purchase_requests_insert_member" on public.purchase_requests
  for insert with check (requested_by = auth.uid() and public.is_couple_member(couple_id));

-- Only the recipient (not the requester) may approve/decline -- mirrors the
-- existing "can't confirm your own request" rule used by reward_requests.
drop policy if exists "purchase_requests_update_recipient" on public.purchase_requests;
create policy "purchase_requests_update_recipient" on public.purchase_requests
  for update using (recipient_id = auth.uid() and public.is_couple_member(couple_id));

-- ============================================================================
-- 6. Base table privileges (see migration 0005: RLS alone is not enough).
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update on public.shopping_items to authenticated;
grant select, insert, update on public.budgets to authenticated;
grant select, insert on public.expenses to authenticated;
grant select, insert on public.savings_goals to authenticated;
grant select, insert on public.savings_contributions to authenticated;
grant select, insert, update on public.purchase_requests to authenticated;

-- ============================================================================
-- 7. Realtime -- all six are couple-shared, so both phones stay in sync.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items') then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'budgets') then
    alter publication supabase_realtime add table public.budgets;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'expenses') then
    alter publication supabase_realtime add table public.expenses;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'savings_goals') then
    alter publication supabase_realtime add table public.savings_goals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'savings_contributions') then
    alter publication supabase_realtime add table public.savings_contributions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchase_requests') then
    alter publication supabase_realtime add table public.purchase_requests;
  end if;
end $$;
