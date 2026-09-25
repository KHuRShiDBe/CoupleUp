-- CoupleUp migration 0006: add couple_members to the realtime publication.
--
-- Root cause of "Phone A stays 'Не связан' after Phone B joins": joining a
-- couple (join_couple_by_code) links the second user by inserting a row into
-- public.couple_members -- it never updates the couples row itself. But
-- couple_members was never added to the supabase_realtime publication
-- (0001 added couples/actions/tasks/reward_requests/goals/penalties, 0002
-- added profiles, 0003 added notifications -- couple_members was missed).
-- So the side that created the code had nothing to receive that join event
-- from, and its cached partner/profile stayed stale until a manual restart.
--
-- RLS already allows this correctly (couple_members_select_own: user_id =
-- auth.uid() OR is_couple_member(couple_id)), so no policy change is needed --
-- only the publication was missing.
--
-- Safe to re-run: guarded to skip if already added. No data is touched.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'couple_members'
  ) then
    alter publication supabase_realtime add table public.couple_members;
  end if;
end $$;
