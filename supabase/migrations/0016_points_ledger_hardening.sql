-- CoupleUp migration 0016: points-ledger hardening (QA fix package #1).
--
-- Two targeted, additive fixes found during the QA audit -- neither changes
-- who is allowed to do what, only closes a double-award race in each flow:
--
-- 1. complete_task(): re-reads the task row with `for update` before the
--    status check. Previously the read had no lock, so two near-simultaneous
--    calls (double-tap, or both partners tapping at once) could both pass
--    "if t.status = 'completed' then return t" before either one's UPDATE
--    committed, and both would insert an `actions` row -- double-crediting
--    the task's points. This RPC is currently not called anywhere in the app
--    (Tasks still runs on the legacy local store), so this is purely
--    forward-hardening for whenever that screen is migrated to the real
--    backend -- but the bug is real and worth closing now while it's fresh.
--
-- 2. New complete_promise() RPC: replaces the previous client pattern of
--    (a) `update promises set status = 'completed'` followed by (b) a
--    separate, unguarded `apply_action()`-equivalent points insert -- with no
--    check that (a) actually changed anything, a double-tap or slow-network
--    retry could run (b) twice for the same promise. This RPC does both
--    atomically, guarded by `for update` + a status check, so a promise can
--    only ever be completed (and only ever pays out its reward) once.
--
-- Safe to re-run: both are `create or replace function`, no table is ever
-- dropped, and neither changes any RLS policy.

-- ============================================================================
-- 1. complete_task -- add the missing row lock.
-- ============================================================================

create or replace function public.complete_task(p_task_id uuid)
returns public.tasks
language plpgsql
security definer
as $$
declare
  t public.tasks;
begin
  select * into t from public.tasks where id = p_task_id for update;
  if t.id is null then
    raise exception 'TASK_NOT_FOUND';
  end if;
  if not public.is_couple_member(t.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if t.status = 'completed' then
    return t;
  end if;

  update public.tasks
  set status = 'completed', completed_at = now()
  where id = p_task_id
  returning * into t;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (t.couple_id, auth.uid(), auth.uid(), t.title, t.points, 'task');

  return t;
end;
$$;

-- ============================================================================
-- 2. complete_promise -- atomic, guarded promise completion + point award.
--    Fixed reward (2 points, matching the previous client-side PROMISE_POINTS
--    constant in PromisesScreen.tsx) is now applied server-side so the two
--    steps can never be split by a race. p_history_title is supplied by the
--    client (already localized via t('promises.historyTitle', {title}), same
--    as before this RPC existed) rather than hardcoded here, since the
--    database has no notion of the caller's selected language -- the RPC
--    only decides WHETHER to award (guarded by the status check below),
--    never what the ledger entry reads. Falls back to the promise's own
--    title if the client omits it.
-- ============================================================================

create or replace function public.complete_promise(p_promise_id uuid, p_history_title text default null)
returns public.promises
language plpgsql
security definer
as $$
declare
  pr public.promises;
begin
  select * into pr from public.promises where id = p_promise_id for update;
  if pr.id is null then
    raise exception 'PROMISE_NOT_FOUND';
  end if;
  if not public.is_couple_member(pr.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if pr.status <> 'active' then
    -- Already completed/cancelled by an earlier call (or a concurrent one
    -- that got here first) -- return the row as-is instead of re-awarding.
    return pr;
  end if;

  update public.promises
  set status = 'completed', resolved_at = now()
  where id = p_promise_id
  returning * into pr;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (pr.couple_id, auth.uid(), pr.from_user_id, coalesce(p_history_title, pr.title), 2, 'action');

  return pr;
end;
$$;
