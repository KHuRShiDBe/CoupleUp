-- CoupleUp migration 0044: close the remaining client-side bypasses of the
-- partner-approval flow (0037/0038/0041-0043). Run AFTER 0043. Idempotent.
--
-- 1. actions: the 0001 policy "actions_insert_member" let any member INSERT
--    straight into actions (author_id = self, recipient = self, any points),
--    crediting points with no approval. All legitimate writers are
--    SECURITY DEFINER RPCs/triggers (owner role, unaffected by RLS/grants),
--    and the app only SELECTs actions directly, so direct INSERT is removed.
-- 2. action_requests: the insert policy let a client insert status='approved',
--    a bonus_milestone with arbitrary points (bypassing the 5/7/15 whitelist
--    and the quest_progress count), item_key rows, or a recipient outside the
--    couple. Direct inserts are now restricted to plain pending requests for a
--    couple member; quest items / bonuses can only be created through
--    complete_quest_item() / claim_quest_bonus(). Reviewer is always forced to
--    the partner server-side.
-- 3. apply_action: 'compliment' can no longer be sent to oneself and is
--    capped; 'reward_chest' points are capped.

-- 1 ---------------------------------------------------------------------------
drop policy if exists "actions_insert_member" on public.actions;
revoke insert, update, delete on public.actions from authenticated;

-- 2 ---------------------------------------------------------------------------
drop policy if exists "action_requests_insert_member" on public.action_requests;
create policy "action_requests_insert_member" on public.action_requests
  for insert with check (
    public.is_couple_member(couple_id)
    and actor_user_id = auth.uid()
    and status = 'pending'
    and approved_by is null
    and approved_at is null
    and rejected_at is null
    and bonus_milestone is null
    and item_key is null
    and period is null
    and period_key is null
    and exists (
      select 1 from public.couple_members cm
      where cm.couple_id = action_requests.couple_id and cm.user_id = recipient_id
    )
  );

revoke update, delete on public.action_requests from authenticated;

-- Reviewer is always the partner, never client-supplied.
create or replace function public.set_action_request_reviewer()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  NEW.reviewer_user_id := public.get_partner_id(NEW.couple_id, NEW.actor_user_id);
  return NEW;
end;
$$;

-- 3 ---------------------------------------------------------------------------
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
  if p_points is null or p_points <= 0 or p_points > 500 then
    raise exception 'INVALID_POINTS';
  end if;
  if p_type = 'compliment' and (target_recipient = auth.uid() or p_points > 10) then
    raise exception 'INVALID_COMPLIMENT';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, p_type)
  returning * into new_action;

  return new_action;
end;
$$;

notify pgrst, 'reload schema';
