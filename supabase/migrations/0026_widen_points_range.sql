-- CoupleUp migration 0026: widen actions_points_range.
--
-- actions_points_range (migration 0002) capped every single actions row to
-- between -10000 and 500 points. That was sized for small everyday point
-- amounts (quest rewards, daily bonuses) and predates every BOND-scale
-- feature added since: couple_offers.price_points (0021) has no upper bound
-- at all, and Wish Roulette (0024) nets up to -50000 (losing the full 500
-- BOND stake on a cheap prize) or +450000 (a 10x/5000-BOND jackpot minus the
-- 500 BOND stake) in a single row. Both would violate the old range even
-- though nothing about them is a bug -- the constraint itself is just out of
-- date relative to the app's current economy scale.
--
-- New range: -1,000,000 to 1,000,000 points (=/- 10,000 BOND at the default
-- 100 points/BOND rate), comfortably covering every existing feature
-- (including the priciest reward-catalog item seen client-side, 200,000
-- points) with headroom, while still being a real, enforced bound -- not a
-- blank check.
--
-- Purely a constraint widening: no row, column, or existing behavior is
-- removed, and nothing already in the table can start violating it (a
-- narrower-to-wider check never invalidates existing data).
--
-- Safe to re-run.

alter table public.actions drop constraint if exists actions_points_range;
alter table public.actions add constraint actions_points_range check (points between -1000000 and 1000000);
