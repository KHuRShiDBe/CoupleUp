-- CoupleUp migration 0017: QA fix package #2 -- moves Tasks/Rewards/Requests/
-- SharedGoals/Wishlist/Games off the legacy per-device mock store, and closes
-- the remaining Critical/High gaps from the audit. 0016 (points-ledger
-- hardening) is already applied.
--
-- Sections:
--   1. promises: complete_promise() now only lets the RECIPIENT (to_user_id)
--      confirm completion -- not the promisor. Note: in a 2-person couple
--      is_couple_member() already means "is from_user_id or to_user_id", so
--      this was never a third-party security hole; it's a workflow-integrity
--      fix (mirrors respond_reward_request: the other party confirms, not
--      the requester) so a promise can't be self-attested.
--   2. purchase_requests: new respond_purchase_request() RPC replaces the raw
--      client UPDATE -- guards against self-approval, wrong-status
--      transitions, and (by removing the old update policy) against the
--      recipient's "approve" update silently rewriting price/title/etc.
--   3. daily_challenges: adds `reward_claimed` (same guard challenge_progress
--      already had) + complete_daily_challenge() RPC, so the daily-challenge
--      bonus can only ever be paid out once, atomically.
--   4. challenge_progress: new claim_challenge_reward() RPC replaces the
--      client's two-step "complete then claim" (which had a stale-read race
--      that could double-pay the weekly bonus) with one atomic call.
--   5. wishlist_items: new table -- WishlistScreen had no backend at all
--      before this, only local AsyncStorage. Couple-shared (both partners
--      see the same list), same RLS shape as every other couple table.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- 1. Promises -- completion requires the recipient.
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
  if auth.uid() <> pr.to_user_id then
    raise exception 'NOT_RECIPIENT';
  end if;
  if pr.status <> 'active' then
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

-- ============================================================================
-- 2. purchase_requests -- server-side respond RPC, raw client UPDATE removed.
-- ============================================================================

create or replace function public.respond_purchase_request(p_request_id uuid, p_approve boolean)
returns public.purchase_requests
language plpgsql
security definer
as $$
declare
  pr public.purchase_requests;
begin
  select * into pr from public.purchase_requests where id = p_request_id for update;
  if pr.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(pr.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if auth.uid() = pr.requested_by then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if auth.uid() <> pr.recipient_id then
    raise exception 'NOT_RECIPIENT';
  end if;
  if pr.status <> 'pending' then
    -- Already resolved (by an earlier call, or a concurrent one that got
    -- here first) -- return as-is rather than flipping it again.
    return pr;
  end if;

  update public.purchase_requests
  set status = case when p_approve then 'approved' else 'declined' end,
      resolved_at = now()
  where id = p_request_id
  returning * into pr;

  return pr;
end;
$$;

-- Remove the raw client UPDATE path -- every status change now goes through
-- respond_purchase_request() above (security definer, so it still works with
-- no update policy present). Without this, a recipient's "approve" could
-- rewrite price_usd/title/rate_snapshot in the same call instead of only
-- flipping status.
drop policy if exists "purchase_requests_update_recipient" on public.purchase_requests;

-- ============================================================================
-- 3. daily_challenges -- add the same reward_claimed guard challenge_progress
--    already has, and an atomic claim RPC.
-- ============================================================================

alter table public.daily_challenges add column if not exists reward_claimed boolean not null default false;

create or replace function public.complete_daily_challenge(p_couple_id uuid, p_reward_points int, p_title text)
returns public.daily_challenges
language plpgsql
security definer
as $$
declare
  dc public.daily_challenges;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.daily_challenges (couple_id, challenge_date, completed_by)
  values (p_couple_id, current_date, auth.uid())
  on conflict (couple_id, challenge_date) do nothing;

  select * into dc from public.daily_challenges
  where couple_id = p_couple_id and challenge_date = current_date
  for update;

  if not dc.reward_claimed then
    update public.daily_challenges set reward_claimed = true where id = dc.id returning * into dc;

    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, dc.completed_by, dc.completed_by, p_title, p_reward_points, 'action');
  end if;

  return dc;
end;
$$;

-- ============================================================================
-- 4. challenge_progress -- atomic "complete + claim" for weekly challenges.
--    Replaces the previous client pattern of completeChallenge() followed by
--    a separate markChallengeRewardClaimed(), which read its own just-issued
--    insert from a stale local array and could skip the "already claimed"
--    guard, double-paying the bonus.
-- ============================================================================

create or replace function public.claim_challenge_reward(
  p_couple_id uuid,
  p_week_key text,
  p_challenge_key text,
  p_reward_points int,
  p_title text
)
returns public.challenge_progress
language plpgsql
security definer
as $$
declare
  cp public.challenge_progress;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.challenge_progress (couple_id, week_key, challenge_key, completed, completed_at)
  values (p_couple_id, p_week_key, p_challenge_key, true, now())
  on conflict (couple_id, week_key, challenge_key)
  do update set completed = true, completed_at = coalesce(public.challenge_progress.completed_at, now());

  select * into cp from public.challenge_progress
  where couple_id = p_couple_id and week_key = p_week_key and challenge_key = p_challenge_key
  for update;

  if not cp.reward_claimed then
    update public.challenge_progress set reward_claimed = true where id = cp.id returning * into cp;

    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), p_title, p_reward_points, 'action');
  end if;

  return cp;
end;
$$;

-- ============================================================================
-- 5. wishlist_items -- new, couple-shared (WishlistScreen had no backend
--    before this). Points/BOND are deliberately NOT stored, same as every
--    other price_usd-bearing table (shopping_items, purchase_requests,
--    date_idea_saves) -- computed client-side from the live rate via
--    useBond(), never a stale snapshot.
-- ============================================================================

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  price_usd numeric,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  created_at timestamptz not null default now()
);

alter table public.wishlist_items enable row level security;

drop policy if exists "wishlist_items_select_member" on public.wishlist_items;
create policy "wishlist_items_select_member" on public.wishlist_items
  for select using (public.is_couple_member(couple_id));

drop policy if exists "wishlist_items_insert_member" on public.wishlist_items;
create policy "wishlist_items_insert_member" on public.wishlist_items
  for insert with check (created_by = auth.uid() and public.is_couple_member(couple_id));

-- Only the creator can remove their own wishlist item (matches the original
-- local-only screen's behavior: no "remove partner's item" affordance).
drop policy if exists "wishlist_items_delete_own" on public.wishlist_items;
create policy "wishlist_items_delete_own" on public.wishlist_items
  for delete using (created_by = auth.uid());

grant usage on schema public to authenticated;
grant select, insert, delete on public.wishlist_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'wishlist_items') then
    alter publication supabase_realtime add table public.wishlist_items;
  end if;
end $$;
