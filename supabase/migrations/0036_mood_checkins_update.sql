-- CoupleUp migration 0036: fix mood_checkins so a user can change today's
-- mood more than once.
--
-- Root cause: migration 0010 created mood_checkins with a unique
-- (user_id, checkin_date) constraint and the client (submitMoodCheckin)
-- already correctly used upsert(..., { onConflict: 'user_id,checkin_date' })
-- -- but only granted/allowed INSERT (`grant select, insert`, and only an
-- "insert_self" RLS policy). Postgres executes an upsert's ON CONFLICT DO
-- UPDATE branch as a real UPDATE, which needs UPDATE privilege + an UPDATE
-- RLS policy. Without either, the first mood pick (plain insert, no
-- conflict yet) succeeded, but every later change that day (now hits the
-- conflict branch) was rejected by Postgres -- silently, since the app
-- never surfaced interaction.error on this screen. That's the entire bug;
-- no client-side "already chosen" guard existed anywhere.
--
-- Safe to re-run: guarded policy/grant statements, no table or column is
-- ever dropped.

drop policy if exists "mood_checkins_update_self" on public.mood_checkins;
create policy "mood_checkins_update_self" on public.mood_checkins
  for update using (user_id = auth.uid() and public.is_couple_member(couple_id))
  with check (user_id = auth.uid() and public.is_couple_member(couple_id));

grant update on public.mood_checkins to authenticated;

notify pgrst, 'reload schema';
