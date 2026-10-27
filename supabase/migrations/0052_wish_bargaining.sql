-- CoupleUp migration 0052: bargaining over a wish's reward (in points).
--
-- Requires 0003 (create_notification, get_partner_id), 0045 (status +
-- request_/respond_wish_completion), 0047 (daily cap trigger +
-- daily_earn_remaining_points), 0048 (wish_important), 0049 (create_wish,
-- deadline fee), 0051. Uses the existing wishlist_items table only.
-- Additive / create-or-replace: no row is deleted, existing wishes stay as
-- they are (negotiation_status 'none' = legacy wish, no payout). The only
-- removed object is the 0049 create_wish(uuid,text,numeric,int,uuid)
-- overload, replaced by create_wish(..., p_offer_points int, ...).
-- Safe to re-run. Run inside BEGIN; ... COMMIT;.
--
-- Flow (100 points = 1 BOND):
--   1. Author creates the wish with an offered reward (1..500 points; the
--      daily earning cap is 500) -> negotiation 'open', offer_by = author.
--      The deadline fee (0049) is still charged once, separately.
--   2. Whoever did NOT make the current offer may accept, decline or
--      counter. A counter flips offer_by. After a decline the author may
--      propose a new price. Repeats until both agree.
--   3. Accept fixes agreed_points on the server; the price can no longer
--      change (no new bargaining on an agreed wish).
--   4. The partner can mark the wish done only once the price is agreed
--      (or for legacy wishes). When the author confirms (0045 flow):
--      * escrow: the WHOLE agreed price is debited from the author once
--        (refused if the author lacks the points -> never negative, the wish
--        stays pending);
--      * the executor is credited right away up to what is left of their
--        500-point daily cap (0047 trigger respected); the rest is stored on
--        the wish as debt (payout_pending_points) and the wish is done;
--      * debt is settled later, oldest first, within the daily cap: by
--        settle_my_wish_payouts() when the app opens, and by a pg_cron job
--        at 00:05 Asia/Tashkent if pg_cron is installed.
--      paid_at marks the escrow (set once); every credit and its debt
--      decrement happen in one transaction under row + per-recipient locks,
--      so nothing is debited or credited twice.

-- ============================================================================
-- 1. Columns (+ backfill legacy wishes, nothing removed)
-- ============================================================================

alter table public.wishlist_items
  add column if not exists offer_points int,
  add column if not exists offer_by uuid references public.profiles(id) on delete set null,
  add column if not exists agreed_points int,
  add column if not exists negotiation_status text not null default 'none',
  add column if not exists paid_at timestamptz,
  add column if not exists payout_points int,
  add column if not exists payout_pending_points int not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.wishlist_items'::regclass and conname = 'wishlist_items_negotiation_check') then
    alter table public.wishlist_items add constraint wishlist_items_negotiation_check
      check (negotiation_status in ('none', 'open', 'declined', 'agreed')
             and (offer_points is null or offer_points >= 0)
             and (agreed_points is null or agreed_points >= 0));
  end if;
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.wishlist_items'::regclass and conname = 'wishlist_items_payout_pending_check') then
    alter table public.wishlist_items add constraint wishlist_items_payout_pending_check
      check (payout_pending_points >= 0);
  end if;
end $$;

create index if not exists wishlist_items_payout_pending_idx
  on public.wishlist_items (completion_requested_by, completed_at)
  where payout_pending_points > 0;

-- Legacy wishes: show their old $ price as points (1 $ = 100 points); they
-- keep negotiation_status 'none' and are never paid out automatically.
update public.wishlist_items
   set offer_points = round(price_usd * 100)::int
 where offer_points is null and price_usd is not null;

-- Direct client inserts stay limited to free, un-negotiated wishes (0049
-- rules + no bargaining fields), so a price can only be set via create_wish
-- and only agreed via respond_wish_offer.
drop policy if exists "wishlist_items_insert_member" on public.wishlist_items;
create policy "wishlist_items_insert_member" on public.wishlist_items
  for insert with check (
    created_by = auth.uid()
    and public.is_couple_member(couple_id)
    and deadline_hours is null
    and not is_important
    and deadline_fee_points = 0
    and negotiation_status = 'none'
    and agreed_points is null
    and paid_at is null
    and payout_points is null
    and payout_pending_points = 0
  );

-- A wish whose reward is still owed (escrowed, not fully paid) cannot be
-- deleted, so the executor never loses the escrowed points.
drop policy if exists "wishlist_items_delete_own" on public.wishlist_items;
create policy "wishlist_items_delete_own" on public.wishlist_items
  for delete using (created_by = auth.uid() and payout_pending_points = 0);

-- ============================================================================
-- 2. notifications: new type
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'action', 'task', 'task_done', 'reward_request', 'reward_response',
    'penalty', 'penalty_response', 'goal',
    'compliment', 'promise_completed', 'challenge_completed', 'goal_completed',
    'purchase_request', 'purchase_response', 'nudge',
    'action_request', 'action_response',
    'wish_completion_request', 'wish_completion_response',
    'prize_use_request',
    'wish_important',
    'wish_offer'
  ));

-- ============================================================================
-- 3. create_wish: offered reward in points + one-time deadline fee
-- ============================================================================

drop function if exists public.create_wish(uuid, text, numeric, int, uuid);

create or replace function public.create_wish(
  p_couple_id uuid,
  p_title text,
  p_offer_points int,
  p_deadline_hours int,
  p_client_request_id uuid
)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wishlist_items;
  v_title text := btrim(coalesce(p_title, ''));
  v_fee int;
  v_balance int;
  v_partner uuid;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID';
  end if;
  if char_length(v_title) < 1 then
    raise exception 'INVALID_TITLE';
  end if;
  if p_offer_points is null or p_offer_points < 1 or p_offer_points > 500 then
    raise exception 'INVALID_OFFER';
  end if;
  if p_deadline_hours is not null and p_deadline_hours not in (1, 24) then
    raise exception 'INVALID_DEADLINE';
  end if;

  perform pg_advisory_xact_lock(hashtext('coupleup-wish:' || auth.uid()::text));

  -- Idempotent replay: same request -> same wish, no second charge.
  select * into w from public.wishlist_items
  where created_by = auth.uid() and client_request_id = p_client_request_id;
  if found then
    return w;
  end if;

  v_fee := case p_deadline_hours when 1 then 50 when 24 then 20 else 0 end;

  if v_fee > 0 then
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a
    where a.couple_id = p_couple_id and a.recipient_id = auth.uid();
    if v_balance < v_fee then
      raise exception 'WISH_FEE_NOT_ENOUGH_BOND';
    end if;
  end if;

  insert into public.wishlist_items (
    couple_id, created_by, title, price_usd, deadline_hours, deadline_fee_points, client_request_id,
    offer_points, offer_by, negotiation_status
  )
  values (
    p_couple_id, auth.uid(), v_title, p_offer_points / 100.0, p_deadline_hours, v_fee, p_client_request_id,
    p_offer_points, auth.uid(), 'open'
  )
  returning * into w;

  if v_fee > 0 then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Срок желания: ' || v_title, -v_fee, 'reward');
  end if;

  v_partner := public.get_partner_id(p_couple_id, auth.uid());
  perform public.create_notification(p_couple_id, v_partner, 'wish_offer', 'wishlist_item', w.id,
    'Новое желание', format('«%s» — предложено %s очков', w.title, p_offer_points));
  return w;
end;
$$;

revoke all on function public.create_wish(uuid, text, int, int, uuid) from public, anon;
grant execute on function public.create_wish(uuid, text, int, int, uuid) to authenticated;

-- ============================================================================
-- 4. respond_wish_offer: accept / decline / counter
-- ============================================================================

create or replace function public.respond_wish_offer(
  p_item_id uuid,
  p_action text,
  p_counter_points int default null
)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wishlist_items;
  v_other uuid;
begin
  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if not public.is_couple_member(w.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if w.status <> 'active' then
    raise exception 'WISH_NOT_ACTIVE';
  end if;
  if p_action not in ('accept', 'decline', 'counter') then
    raise exception 'INVALID_ACTION';
  end if;

  if p_action in ('accept', 'decline') then
    -- Only the side that did NOT make the current offer answers it, once.
    if w.negotiation_status <> 'open' then
      raise exception 'OFFER_NOT_OPEN';
    end if;
    if w.offer_by = auth.uid() then
      raise exception 'CANNOT_ANSWER_OWN_OFFER';
    end if;
    if p_action = 'accept' then
      update public.wishlist_items
         set negotiation_status = 'agreed', agreed_points = w.offer_points
       where id = p_item_id
      returning * into w;
    else
      update public.wishlist_items set negotiation_status = 'declined' where id = p_item_id
      returning * into w;
    end if;
  else
    if p_counter_points is null or p_counter_points < 1 or p_counter_points > 500 then
      raise exception 'INVALID_OFFER';
    end if;
    -- Counter an open offer made by the other side, or (after a decline)
    -- the author proposes a new price. An agreed price never changes.
    if not (
      (w.negotiation_status = 'open' and w.offer_by is distinct from auth.uid())
      or (w.negotiation_status = 'declined' and w.created_by = auth.uid())
    ) then
      raise exception 'OFFER_NOT_OPEN';
    end if;
    update public.wishlist_items
       set offer_points = p_counter_points, offer_by = auth.uid(), negotiation_status = 'open',
           price_usd = p_counter_points / 100.0
     where id = p_item_id
    returning * into w;
  end if;

  v_other := public.get_partner_id(w.couple_id, auth.uid());
  perform public.create_notification(w.couple_id, v_other, 'wish_offer', 'wishlist_item', w.id,
    case p_action when 'accept' then 'Цена желания согласована'
                  when 'decline' then 'Цену желания отклонили'
                  else 'Новое предложение цены' end,
    format('«%s» — %s очков', w.title, coalesce(w.agreed_points, w.offer_points)));
  return w;
end;
$$;

revoke all on function public.respond_wish_offer(uuid, text, int) from public, anon;
grant execute on function public.respond_wish_offer(uuid, text, int) to authenticated;

-- ============================================================================
-- 5. request_wish_completion (0045 + price must be agreed)
-- ============================================================================

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
  if w.id is null then raise exception 'WISH_NOT_FOUND'; end if;
  if not public.is_couple_member(w.couple_id) then raise exception 'NOT_A_MEMBER'; end if;
  if w.created_by = auth.uid() then raise exception 'CANNOT_COMPLETE_OWN_WISH'; end if;
  if w.status <> 'active' then raise exception 'WISH_NOT_ACTIVE'; end if;
  -- 0052: a bargained wish can be done only at an agreed price.
  if w.negotiation_status in ('open', 'declined') then raise exception 'PRICE_NOT_AGREED'; end if;

  update public.wishlist_items
     set status = 'pending', completion_requested_by = auth.uid(), completion_requested_at = now()
   where id = p_item_id
  returning * into w;

  select name into actor_name from public.profiles where id = auth.uid();
  perform public.create_notification(w.couple_id, w.created_by, 'wish_completion_request', 'wishlist_item', w.id,
    'Желание выполнено?',
    format('%s отметил(а) желание «%s» как выполненное — подтвердите', coalesce(actor_name, 'Партнёр'), w.title));
  return w;
end;
$$;

-- ============================================================================
-- 6. respond_wish_completion (0045 + one-time payout of the agreed price)
-- ============================================================================

create or replace function public.respond_wish_completion(p_item_id uuid, p_approve boolean)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public
as $$
declare
  w public.wishlist_items;
  requester uuid;
  v_total int;
  v_now int;
  v_paid int := 0;
  v_balance int;
begin
  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then raise exception 'WISH_NOT_FOUND'; end if;
  if w.created_by is distinct from auth.uid() then raise exception 'ONLY_AUTHOR_CAN_CONFIRM'; end if;
  if w.status <> 'pending' then raise exception 'WISH_NOT_PENDING'; end if;

  requester := w.completion_requested_by;

  if p_approve then
    -- 0052: escrow + immediate partial credit + debt (see header).
    if w.negotiation_status = 'agreed' and w.paid_at is null and coalesce(w.agreed_points, 0) > 0 and requester is not null then
      v_total := w.agreed_points;

      -- Escrow: the whole price, once; refuse (wish stays pending) if the
      -- author cannot cover it, so no balance ever goes negative. The
      -- per-author lock serialises parallel confirmations of DIFFERENT
      -- wishes by the same author (the row lock only covers this wish).
      perform pg_advisory_xact_lock(hashtext('coupleup-spend:' || auth.uid()::text));
      select coalesce(sum(a.points), 0) into v_balance
      from public.actions a
      where a.couple_id = w.couple_id and a.recipient_id = auth.uid();
      if v_balance < v_total then
        raise exception 'WISH_PAYOUT_NOT_ENOUGH_POINTS';
      end if;
      insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
      values (w.couple_id, auth.uid(), auth.uid(), 'Желание: ' || w.title, -v_total, 'reward');

      -- Credit what fits today's cap (same lock the 0047 trigger takes).
      perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || requester::text));
      v_now := least(v_total, public.daily_earn_remaining_points(requester));
      if v_now > 0 then
        perform set_config('coupleup.suppress_action_notify', 'on', true);
        insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
        values (w.couple_id, auth.uid(), requester, 'Желание: ' || w.title, v_now, 'action')
        returning points into v_paid;  -- what the cap trigger actually let through
      end if;

      update public.wishlist_items
         set status = 'done', completed_at = now(), paid_at = now(),
             payout_points = v_paid, payout_pending_points = v_total - v_paid
       where id = p_item_id
      returning * into w;
    else
      update public.wishlist_items set status = 'done', completed_at = now()
       where id = p_item_id returning * into w;
    end if;
  else
    update public.wishlist_items
       set status = 'active', completion_requested_by = null, completion_requested_at = null
     where id = p_item_id returning * into w;
  end if;

  perform public.create_notification(w.couple_id, requester, 'wish_completion_response', 'wishlist_item', w.id,
    case when p_approve then 'Желание подтверждено' else 'Желание не подтверждено' end,
    case when p_approve and w.payout_points is not null and w.payout_pending_points > 0
         then format('«%s» — начислено %s очков, ещё %s начислится позже (лимит 500 в день)',
                     w.title, w.payout_points, w.payout_pending_points)
         when p_approve and w.payout_points is not null
         then format('«%s» — начислено %s очков', w.title, w.payout_points)
         else format('«%s» — %s', w.title, case when p_approve then 'отмечено как выполненное' else 'партнёр отклонил отметку' end)
    end);
  return w;
end;
$$;

revoke all on function public.request_wish_completion(uuid) from public, anon;
revoke all on function public.respond_wish_completion(uuid, boolean) from public, anon;
grant execute on function public.request_wish_completion(uuid) to authenticated;
grant execute on function public.respond_wish_completion(uuid, boolean) to authenticated;

-- ============================================================================
-- 7. Debt settlement (0052): pay pending wish rewards within the daily cap
-- ============================================================================

-- Internal: settles one executor's debt, oldest first. Returns points paid.
create or replace function public.settle_wish_payouts_for(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w record;
  v_left int;
  v_now int;
  v_paid int;
  v_total int := 0;
begin
  if p_user is null then
    return 0;
  end if;
  -- Same per-recipient lock as the cap trigger / respond_wish_completion:
  -- parallel settlements for one user run one after another.
  perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || p_user::text));

  for w in
    select id, couple_id, created_by, title, payout_pending_points
    from public.wishlist_items
    where completion_requested_by = p_user and status = 'done' and payout_pending_points > 0
    order by completed_at, id
    for update
  loop
    v_left := public.daily_earn_remaining_points(p_user);
    exit when v_left <= 0;
    v_now := least(w.payout_pending_points, v_left);
    v_paid := 0;
    perform set_config('coupleup.suppress_action_notify', 'on', true);
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (w.couple_id, w.created_by, p_user, 'Желание (долг): ' || w.title, v_now, 'action')
    returning points into v_paid;
    exit when coalesce(v_paid, 0) <= 0;
    update public.wishlist_items
       set payout_points = coalesce(payout_points, 0) + v_paid,
           payout_pending_points = payout_pending_points - v_paid
     where id = w.id;
    v_total := v_total + v_paid;
  end loop;
  return v_total;
end;
$$;

revoke all on function public.settle_wish_payouts_for(uuid) from public, anon, authenticated;

-- Called by the app on open / return to foreground: settles MY debt only.
create or replace function public.settle_my_wish_payouts()
returns int
language sql
security definer
set search_path = public, pg_temp
as $$
  select public.settle_wish_payouts_for(auth.uid());
$$;

revoke all on function public.settle_my_wish_payouts() from public, anon;
grant execute on function public.settle_my_wish_payouts() to authenticated;

-- For pg_cron: settles every executor with debt.
create or replace function public.settle_all_wish_payouts()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  u uuid;
  v_total int := 0;
begin
  for u in
    select distinct completion_requested_by from public.wishlist_items
    where status = 'done' and payout_pending_points > 0 and completion_requested_by is not null
  loop
    v_total := v_total + public.settle_wish_payouts_for(u);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.settle_all_wish_payouts() from public, anon, authenticated;

-- Nightly job at 00:05 Asia/Tashkent (= 19:05 UTC, no DST) -- only if the
-- pg_cron extension is installed; otherwise the app-open settlement above
-- still pays the debt. Re-running replaces the job instead of duplicating it.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $q$select cron.unschedule(jobid) from cron.job where jobname = 'coupleup-settle-wish-payouts'$q$;
    execute $q$select cron.schedule('coupleup-settle-wish-payouts', '5 19 * * *', 'select public.settle_all_wish_payouts()')$q$;
  else
    raise notice 'pg_cron is not installed: wish debt is settled only when the app opens (settle_my_wish_payouts).';
  end if;
end $$;
