-- CoupleUp migration 0045: wishlist completion with partner confirmation.
--
-- Flow (no BOND / points are ever credited here):
--   1. The partner (not the wish's author) marks an ACTIVE wish as done:
--      request_wish_completion() -> status 'pending', author is notified.
--   2. The author confirms or declines: respond_wish_completion()
--      confirm -> status 'done' (kept as history), decline -> back to 'active'.
--
-- Requires: 0001 (couples, is_couple_member), 0002 (profiles), 0003
-- (notifications, create_notification), 0017 (wishlist_items), 0037 (latest
-- notifications_type_check). Not numbered 0044: that number is already used
-- by supabase/migrations/0044_approval_hardening.sql on another branch.
--
-- Additive only: no table, column or row is dropped or rewritten. Existing
-- wishes get status 'active'. The only change to an existing object is
-- widening notifications_type_check with two new types (same drop/re-add by
-- exact name convention as 0015/0037); the list below is 0037's list plus
-- 'wish_completion_request' and 'wish_completion_response'.
-- Safe to re-run.

-- ============================================================================
-- 1. wishlist_items: completion state
-- ============================================================================

alter table public.wishlist_items
  add column if not exists status text not null default 'active',
  add column if not exists completion_requested_by uuid references public.profiles(id) on delete set null,
  add column if not exists completion_requested_at timestamptz,
  add column if not exists completed_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.wishlist_items'::regclass and conname = 'wishlist_items_status_check') then
    alter table public.wishlist_items add constraint wishlist_items_status_check
      check (status in ('active', 'pending', 'done'));
  end if;
end $$;

-- No UPDATE policy on purpose: status only changes through the two
-- security-definer RPCs below, which enforce who may do what.

-- ============================================================================
-- 2. notifications: two new types
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal',
    'compliment', 'promise_completed', 'challenge_completed', 'goal_completed',
    'purchase_request', 'purchase_response', 'nudge',
    'action_request', 'action_response',
    'wish_completion_request', 'wish_completion_response'
  ));

-- ============================================================================
-- 3. RPCs
-- ============================================================================

-- Partner marks the wish as fulfilled -> waits for the author's confirmation.
create or replace function public.request_wish_completion(p_item_id uuid)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.wishlist_items;
  actor_name text;
begin
  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if not public.is_couple_member(w.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if w.created_by = auth.uid() then
    raise exception 'CANNOT_COMPLETE_OWN_WISH';
  end if;
  if w.status <> 'active' then
    raise exception 'WISH_NOT_ACTIVE';
  end if;

  update public.wishlist_items
     set status = 'pending',
         completion_requested_by = auth.uid(),
         completion_requested_at = now()
   where id = p_item_id
  returning * into w;

  select name into actor_name from public.profiles where id = auth.uid();
  perform public.create_notification(w.couple_id, w.created_by, 'wish_completion_request', 'wishlist_item', w.id,
    'Желание выполнено?',
    format('%s отметил(а) желание «%s» как выполненное — подтвердите', coalesce(actor_name, 'Партнёр'), w.title));
  return w;
end;
$$;

-- Author confirms (-> done, kept as history) or declines (-> active again).
create or replace function public.respond_wish_completion(p_item_id uuid, p_approve boolean)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.wishlist_items;
  requester uuid;
begin
  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if w.created_by is distinct from auth.uid() then
    raise exception 'ONLY_AUTHOR_CAN_CONFIRM';
  end if;
  if w.status <> 'pending' then
    raise exception 'WISH_NOT_PENDING';
  end if;

  requester := w.completion_requested_by;

  if p_approve then
    update public.wishlist_items
       set status = 'done', completed_at = now()
     where id = p_item_id
    returning * into w;
  else
    update public.wishlist_items
       set status = 'active', completion_requested_by = null, completion_requested_at = null
     where id = p_item_id
    returning * into w;
  end if;

  perform public.create_notification(w.couple_id, requester, 'wish_completion_response', 'wishlist_item', w.id,
    case when p_approve then 'Желание подтверждено' else 'Желание не подтверждено' end,
    format('«%s» — %s', w.title, case when p_approve then 'отмечено как выполненное' else 'партнёр отклонил отметку' end));
  return w;
end;
$$;

revoke all on function public.request_wish_completion(uuid) from public, anon;
revoke all on function public.respond_wish_completion(uuid, boolean) from public, anon;
grant execute on function public.request_wish_completion(uuid) to authenticated;
grant execute on function public.respond_wish_completion(uuid, boolean) to authenticated;
