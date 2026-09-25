-- CoupleUp migration 0009: mark holiday BOND rate weeks.
--
-- Additive on top of 0008 (public.bond_rates). Adds a flag so a rate row can
-- be shown on BondRateScreen with a "Праздничный курс" badge -- purely
-- informational, does not change how points/BOND convert.
--
-- Safe to re-run: guarded column add, no data touched.

alter table public.bond_rates add column if not exists is_holiday boolean not null default false;
