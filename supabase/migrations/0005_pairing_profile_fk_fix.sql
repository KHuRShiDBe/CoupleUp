-- CoupleUp migration 0005: grant base table privileges to `authenticated`.
--
-- Root cause of the "couples_created_by_fkey" pairing bug (fails on
-- "Создать код"): couples.created_by already references public.profiles(id)
-- correctly (see migration 0004), and profileService already writes to
-- public.profiles too -- there is no table-name mismatch.
--
-- The real cause: migrations 0001-0004 defined RLS policies on every table,
-- but never issued the underlying Postgres GRANTs that let the
-- `authenticated` role touch these tables at all. RLS only *restricts*
-- access on top of the coarser GRANT system -- without a GRANT, every direct
-- table query (the app's supabase.from(...) calls) fails with "permission
-- denied for table X" (Postgres error 42501), regardless of RLS policy
-- content.
--
-- This is why profileService.createProfile()/getProfile() have never
-- actually written or read a profiles row for any user (confirmed live:
-- both a bare INSERT and a plain SELECT on public.profiles return
-- 42501 "permission denied for table profiles" for the `authenticated`
-- role), while create_couple()/join_couple_by_code() (both `security
-- definer`) appeared to get further -- security definer functions run with
-- the function owner's privileges, not the caller's, so they bypass this
-- gap entirely. create_couple() reached its INSERT into couples and only
-- then hit the FK violation, because no profiles row had ever actually been
-- created for the calling user.
--
-- Fix: grant the missing base privileges to `authenticated` on every table,
-- and set a default so future tables get them automatically too. RLS
-- (already correct) remains the real row-level security boundary; this only
-- restores the coarser table-level access Postgres also requires.
--
-- Safe to re-run: GRANT/ALTER DEFAULT PRIVILEGES are additive and idempotent.
-- No data is modified, dropped, or deleted by this migration.

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

-- Covers any table added by a future migration, so this exact class of bug
-- (RLS defined, GRANT forgotten) can't silently resurface.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
