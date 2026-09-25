-- CoupleUp migration 0034: replace a standard quest item with a custom one.
--
-- Lets a user permanently hide one of their 15 standard items (per period)
-- and have a custom item take its place in that slot -- the custom
-- replacement doesn't count as an "extra" (priced) item, it just occupies
-- the free slot the hidden standard item vacated, so the total stays at 15.
--
-- Two additive pieces, no RPC needed:
--   1. quest_hidden_items -- one row per (user, period, standard item_key)
--      the user has hidden. Plain client-writable insert, same trust level
--      as couple_offers -- hiding an item has zero economic value, nothing
--      here is worth forging. Own rows only (RLS: user_id = auth.uid()).
--   2. quest_custom_items gains a nullable replaces_item_key column so the
--      client can tell "this custom item fills a hidden standard slot"
--      apart from "this is a genuine paid extra beyond the free 15" --
--      purely descriptive (like title/points on this table already are),
--      same trust level as the rest of the row.
--
-- Nothing here touches quest_progress (History is untouched -- a hidden
-- item's past completions stay exactly as they are) or complete_quest_item
-- (a replacement item is completed through the exact same RPC as any other
-- custom item, with its own fresh item_key, so it can never collide with or
-- re-pay the standard item it replaced).
--
-- Does NOT touch: any roulette, coupons, BOND rate, quest_bonus_claims,
-- claim_quest_bonus, or any existing row.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, ADD COLUMN IF NOT EXISTS,
-- guarded policies -- nothing is ever dropped.

-- ============================================================================
-- 1. quest_hidden_items
-- ============================================================================

create table if not exists public.quest_hidden_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  item_key text not null,
  hidden_at timestamptz not null default now(),
  unique (user_id, period, item_key)
);

alter table public.quest_hidden_items enable row level security;

drop policy if exists "quest_hidden_items_select_member" on public.quest_hidden_items;
create policy "quest_hidden_items_select_member" on public.quest_hidden_items
  for select using (public.is_couple_member(couple_id));

drop policy if exists "quest_hidden_items_insert_self" on public.quest_hidden_items;
create policy "quest_hidden_items_insert_self" on public.quest_hidden_items
  for insert with check (public.is_couple_member(couple_id) and user_id = auth.uid());

grant usage on schema public to authenticated;
grant select, insert on public.quest_hidden_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'quest_hidden_items') then
    alter publication supabase_realtime add table public.quest_hidden_items;
  end if;
end $$;

-- ============================================================================
-- 2. quest_custom_items -- descriptive marker for "this fills a hidden slot".
-- ============================================================================

alter table public.quest_custom_items add column if not exists replaces_item_key text;

notify pgrst, 'reload schema';
