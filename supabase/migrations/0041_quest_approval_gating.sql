-- CoupleUp migration 0041: a pending quest item must NOT count as done.
--
-- Bug: complete_quest_item() (0038) still inserted into quest_progress
-- IMMEDIATELY, before any partner approval -- only the points half was
-- gated behind action_requests. Since "X/15 done" (RewardsScreen,
-- Home's badge) and the 5/7/10 milestone bonuses are both computed purely
-- from quest_progress row *existence*, a pending (unapproved, even
-- rejected) item was already counted as done the instant "Отметить" was
-- tapped -- before the partner ever saw it, and even if they rejected it.
--
-- Fix: quest_progress is no longer written by complete_quest_item() at all.
-- It's written by respond_action_request() instead, and only inside the
-- p_accept branch -- i.e. only once approved. action_requests gains
-- period/period_key/item_key (nullable -- only quest-originated requests
-- use them; AddActionScreen's "quick" tab leaves them null) so
-- respond_action_request knows which quest_progress row to create on
-- approval. A partial unique index on the still-active (pending/approved)
-- request per item replaces quest_progress's own unique constraint as the
-- "can't double-submit" guard -- a REJECTED item is deliberately excluded
-- from that index, so "Отметить" can be tapped again after a ✕.
--
-- Nothing else changes: AddActionScreen's "quick" tab (period/item_key
-- always null there) is unaffected: the balance/notification/approve-reject
-- flow for it is identical to before. Reward Chest, Chat, mood untouched.
--
-- Safe to re-run: ADD COLUMN IF NOT EXISTS, CREATE (OR REPLACE) ... IF NOT
-- EXISTS, no data is ever deleted.

alter table public.action_requests add column if not exists period text
  check (period in ('daily', 'weekly', 'monthly', 'yearly'));
alter table public.action_requests add column if not exists period_key text;
alter table public.action_requests add column if not exists item_key text;

-- Only one LIVE (pending or approved) request per quest item at a time --
-- a rejected one is excluded, so a fresh "Отметить" after a ✕ is never
-- blocked by this index.
create unique index if not exists action_requests_quest_item_active_key
  on public.action_requests (couple_id, period, period_key, item_key)
  where item_key is not null and status in ('pending', 'approved');

-- complete_quest_item: quest_progress insert removed entirely -- it now
-- only creates the pending action_request. Same return semantics (true =
-- recorded, false = already pending/approved -- unique_violation on the
-- partial index above).
create or replace function public.complete_quest_item(
  p_couple_id uuid,
  p_period text,
  p_period_key text,
  p_item_key text,
  p_title text,
  p_points int
)
returns boolean
language plpgsql
security definer
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, item_key)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, p_period, p_period_key, p_item_key);

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- respond_action_request: on approval, ALSO write quest_progress (only when
-- the request is quest-originated, i.e. item_key is set) -- this is the one
-- and only moment a quest item becomes "done" now. "on conflict do nothing"
-- is just defense in depth; the partial unique index above already makes a
-- genuine double-insert here impossible.
create or replace function public.respond_action_request(p_action_request_id uuid, p_accept boolean)
returns public.action_requests
language plpgsql
security definer
as $$
declare
  ar public.action_requests;
begin
  select * into ar from public.action_requests where id = p_action_request_id for update;
  if ar.id is null then
    raise exception 'ACTION_REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(ar.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if ar.actor_user_id = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if ar.status <> 'pending' then
    return ar;
  end if;

  update public.action_requests
  set status = case when p_accept then 'approved' else 'rejected' end,
      approved_by = case when p_accept then auth.uid() else null end,
      approved_at = case when p_accept then now() else null end,
      rejected_at = case when p_accept then null else now() end
  where id = p_action_request_id
  returning * into ar;

  if p_accept then
    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');

    if ar.item_key is not null then
      insert into public.quest_progress (couple_id, period, period_key, item_key, title, points, completed_by)
      values (ar.couple_id, ar.period, ar.period_key, ar.item_key, ar.title, ar.points, ar.actor_user_id)
      on conflict (couple_id, period, period_key, item_key) do nothing;
    end if;
  end if;

  return ar;
end;
$$;

notify pgrst, 'reload schema';
