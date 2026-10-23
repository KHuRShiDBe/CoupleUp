-- CoupleUp migration 0043: gate quest bonus claims (5/7/10) behind partner
-- approval too, and close the apply_action() bypass.
--
-- GAP 1 -- bonus claims skipped approval entirely.
--   claim_quest_bonus() (0033/0042) checked eligibility then immediately
--   inserted quest_bonus_claims + actions -- self-credited, no partner
--   review. Fix: it now creates a pending action_requests row (reusing the
--   existing confirmation system, not a new one) via a new nullable
--   action_requests.bonus_milestone column. respond_action_request() only
--   writes quest_bonus_claims + actions once the partner approves (CANNOT_
--   SELF_CONFIRM already blocks the claimer from approving their own
--   request). A partial unique index blocks a second live (pending/approved)
--   request for the same (user, period, period_key, milestone); the existing
--   quest_bonus_claims_user_period_milestone_key index (migration 0033)
--   still blocks ever being paid twice for the same milestone.
--
-- GAP 2 -- apply_action() still allowed p_type = 'action' to insert into
--   actions directly, crediting points with zero approval, regardless of
--   what the UI does. No frontend caller passes 'action' (or omits p_type)
--   today -- AddActionScreen's quick tab uses create_action_request instead
--   (0037/0038) -- so dropping 'action' from the allow-list here is UI-
--   invisible and closes the RPC-level bypass. 'compliment' (Compliments,
--   partner-credited, not self-reported) and 'reward_chest' (system-
--   verified milestone, migration 0040) stay immediate on purpose.
--
-- Safe to re-run: guarded ADD COLUMN / CREATE ... IF NOT EXISTS, CREATE OR
-- REPLACE, guarded constraint drop/re-add. No data is deleted.

-- ============================================================================
-- 1. Schema: bonus_milestone + its active-request guard.
--
-- FIX (this run failed with 42703 "column period does not exist"): migrations
-- 0041/0042 -- which add action_requests.period/period_key/item_key and the
-- quest-item active-key index -- were never actually applied to this
-- database, even though 0043's functions reference those columns. Re-asserted
-- here, guarded/idempotent, so 0043 no longer depends on 0041/0042 having run.
-- ============================================================================

alter table public.action_requests add column if not exists period text
  check (period in ('daily', 'weekly', 'monthly', 'yearly'));
alter table public.action_requests add column if not exists period_key text;
alter table public.action_requests add column if not exists item_key text;

create unique index if not exists action_requests_quest_item_active_key
  on public.action_requests (couple_id, period, period_key, item_key)
  where item_key is not null and status in ('pending', 'approved');

alter table public.action_requests add column if not exists bonus_milestone int
  check (bonus_milestone is null or bonus_milestone > 0);

create unique index if not exists action_requests_bonus_active_key
  on public.action_requests (actor_user_id, period, period_key, bonus_milestone)
  where bonus_milestone is not null and status in ('pending', 'approved');

-- ============================================================================
-- 1b. complete_quest_item -- re-asserted from 0041/0042 (never actually
--    applied live: it still wrote quest_progress immediately on "Отметить",
--    before any approval, which is the original "pending counted as done"
--    bug). Pending action_requests row only; guarded against paying an item
--    twice if a quest_progress row already exists for it.
-- ============================================================================

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
set search_path = public, pg_temp
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if exists (
    select 1 from public.quest_progress
    where couple_id = p_couple_id
      and period = p_period
      and period_key = p_period_key
      and item_key = p_item_key
  ) then
    return false;
  end if;

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, item_key)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, p_period, p_period_key, p_item_key);

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 2. claim_quest_bonus -- creates a pending action_request, no longer credits
--    directly. Same return semantics (true = request created, false =
--    already claimed/already has a live request).
-- ============================================================================

-- p_bonus_points is accepted only to keep the existing RPC call signature
-- (questsService.ts) working -- it is IGNORED. The points actually paid out
-- come solely from the server-side v_points map below, keyed off a fixed
-- milestone whitelist (5/7/15, matching QUEST_BONUS_MILESTONES in
-- questEconomy.ts), so a client can never claim an inflated bonus.
create or replace function public.claim_quest_bonus(
  p_couple_id uuid,
  p_period text,
  p_period_key text,
  p_milestone int,
  p_bonus_points int,
  p_title text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actual_count int;
  v_points int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_period not in ('daily', 'weekly') then
    raise exception 'MILESTONES_NOT_AVAILABLE';
  end if;

  v_points := case p_milestone
    when 5 then 20
    when 7 then 30
    when 15 then 50
    else null
  end;
  if v_points is null then
    raise exception 'INVALID_MILESTONE';
  end if;

  select count(*) into actual_count
  from public.quest_progress
  where couple_id = p_couple_id
    and period = p_period
    and period_key = p_period_key
    and completed_by = auth.uid();

  if actual_count < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  if exists (
    select 1 from public.quest_bonus_claims
    where user_id = auth.uid() and period = p_period and period_key = p_period_key and milestone = p_milestone
  ) then
    return false;
  end if;

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, bonus_milestone)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, v_points, p_period, p_period_key, p_milestone);

  return true;
exception when unique_violation then
  return false;
end;
$$;

-- ============================================================================
-- 3. respond_action_request -- on approval, also pay out a bonus request.
-- ============================================================================

create or replace function public.respond_action_request(p_action_request_id uuid, p_accept boolean)
returns public.action_requests
language plpgsql
security definer
set search_path = public, pg_temp
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
    -- Both idempotency inserts happen BEFORE actions, and each is checked
    -- via FOUND: if the row already existed (ON CONFLICT DO NOTHING -> no
    -- row affected), we return immediately without crediting actions --
    -- points can never be paid twice, even if quest_progress/quest_bonus_
    -- claims already had the row going into this call (e.g. a stale/retried
    -- request, or a row left over from before migration 0043).
    if ar.bonus_milestone is not null then
      insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
      values (ar.couple_id, ar.actor_user_id, ar.period, ar.period_key, ar.bonus_milestone, ar.points)
      on conflict (user_id, period, period_key, milestone) do nothing;

      if not found then
        return ar;
      end if;
    end if;

    if ar.item_key is not null then
      insert into public.quest_progress (couple_id, period, period_key, item_key, title, points, completed_by)
      values (ar.couple_id, ar.period, ar.period_key, ar.item_key, ar.title, ar.points, ar.actor_user_id)
      on conflict (couple_id, period, period_key, item_key) do nothing;

      if not found then
        return ar;
      end if;
    end if;

    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (ar.couple_id, ar.actor_user_id, ar.recipient_id, ar.title, ar.points, 'action');
  end if;

  return ar;
end;
$$;

-- ============================================================================
-- 4. apply_action -- drop 'action' from the allowed types (no UI caller uses
--    it; closes the self-credit bypass at the RPC level).
-- ============================================================================

create or replace function public.apply_action(
  p_couple_id uuid,
  p_title text,
  p_points int,
  p_recipient_id uuid default null,
  p_type text default 'compliment'
)
returns public.actions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  new_action public.actions;
  target_recipient uuid := coalesce(p_recipient_id, auth.uid());
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if not exists (
    select 1 from public.couple_members
    where couple_id = p_couple_id and user_id = target_recipient
  ) then
    raise exception 'RECIPIENT_NOT_IN_COUPLE';
  end if;

  if p_type not in ('compliment', 'reward_chest') then
    raise exception 'INVALID_TYPE';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, p_type)
  returning * into new_action;

  return new_action;
end;
$$;

notify pgrst, 'reload schema';
