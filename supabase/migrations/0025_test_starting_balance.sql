-- CoupleUp migration 0025: TEMPORARY test-only starting balance.
--
-- Purpose: give every current couple member a one-time +1000 BOND credit so
-- the new Wish Roulette (500 BOND/spin) can actually be tested end-to-end.
-- This is explicitly a throwaway testing aid, NOT part of the real economy --
-- delete the credited rows (by title, below) once testing is done, or just
-- leave this file unapplied on a fresh/production database.
--
-- actions_points_range (migration 0002) caps every single actions row to
-- at most 500 points -- 1000 BOND at the going rate is far above that, so
-- the credit is split into multiple 500-point rows instead of one big one.
-- 1000 BOND in points is always an exact multiple of 500 (1000 * rate is
-- always divisible by 500 for any positive integer rate), so every chunk is
-- exactly 500 and none is ever left over.
--
-- Safe to re-run: the `where not exists` guard means each user is credited
-- (the full set of chunks) at most once, no matter how many times this
-- migration is executed.

with rate as (
  select coalesce((select b.points_per_bond from public.bond_rates b order by b.effective_from desc limit 1), 100) as points_per_bond
),
eligible as (
  select cm.couple_id, cm.user_id, rate.points_per_bond
  from public.couple_members cm
  cross join rate
  where not exists (
    select 1 from public.actions a
    where a.recipient_id = cm.user_id and a.title = 'Тестовый стартовый баланс (временно)'
  )
)
insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
select e.couple_id, e.user_id, e.user_id, 'Тестовый стартовый баланс (временно)', 500, 'action'
from eligible e
cross join lateral generate_series(1, e.points_per_bond * 2) as gs;
