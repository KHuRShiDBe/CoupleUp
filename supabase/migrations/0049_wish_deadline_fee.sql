-- CoupleUp migration 0049: wish deadline surcharge + important fee 0.5 BOND.
--
-- Requires 0017 (wishlist_items + insert policy), 0045 (status), 0048
-- (deadline_hours, is_important, make_wish_important). Additive /
-- create-or-replace: no table, column or row is dropped; existing wishes keep
-- their data (fee 0). Safe to re-run. Run inside BEGIN; ... COMMIT;.
--
-- A wish's own price (price_usd) is never multiplied or charged here.
-- 1. Deadline surcharge, debited once when the wish is created:
--      1 hour  -> 50 points (0.5 BOND), 24 hours -> 20 points (0.2 BOND),
--      no deadline -> free.
--    create_wish() inserts the wish and the debit in ONE transaction and is
--    idempotent per client_request_id (a retried request returns the same
--    wish and never charges twice). The fee is stored on the wish
--    (deadline_fee_points) for display.
-- 2. Direct client inserts may only create FREE wishes (no deadline, not
--    important, no fee) -- paid options go through create_wish /
--    make_wish_important, so the surcharge cannot be skipped.
-- 3. make_wish_important (from 0048): fixed 0.5 BOND (was 1 BOND); all
--    anti-abuse checks unchanged; once per wish.

-- ============================================================================
-- 1. Columns
-- ============================================================================

alter table public.wishlist_items
  add column if not exists deadline_fee_points int not null default 0,
  add column if not exists client_request_id uuid;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conrelid = 'public.wishlist_items'::regclass and conname = 'wishlist_items_deadline_fee_check') then
    alter table public.wishlist_items add constraint wishlist_items_deadline_fee_check
      check (deadline_fee_points >= 0);
  end if;
end $$;

create unique index if not exists wishlist_items_request_key
  on public.wishlist_items (created_by, client_request_id)
  where client_request_id is not null;

-- ============================================================================
-- 2. Direct inserts: free wishes only
-- ============================================================================

drop policy if exists "wishlist_items_insert_member" on public.wishlist_items;
create policy "wishlist_items_insert_member" on public.wishlist_items
  for insert with check (
    created_by = auth.uid()
    and public.is_couple_member(couple_id)
    and deadline_hours is null
    and not is_important
    and deadline_fee_points = 0
  );

-- ============================================================================
-- 3. create_wish: wish + one-time deadline surcharge, idempotent
-- ============================================================================

create or replace function public.create_wish(
  p_couple_id uuid,
  p_title text,
  p_price_usd numeric,
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

  insert into public.wishlist_items (couple_id, created_by, title, price_usd, deadline_hours, deadline_fee_points, client_request_id)
  values (p_couple_id, auth.uid(), v_title, p_price_usd, p_deadline_hours, v_fee, p_client_request_id)
  returning * into w;

  if v_fee > 0 then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Срок желания: ' || v_title, -v_fee, 'reward');
  end if;

  return w;
end;
$$;

revoke all on function public.create_wish(uuid, text, numeric, int, uuid) from public, anon;
grant execute on function public.create_wish(uuid, text, numeric, int, uuid) to authenticated;

-- ============================================================================
-- 4. make_wish_important (0048, fee 1 -> 0.5 BOND)
-- ============================================================================

create or replace function public.make_wish_important(p_item_id uuid)
returns public.wishlist_items
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  w public.wishlist_items;
  v_partner uuid;
  v_rate int;
  v_cost int;
  v_balance int;
  v_last timestamptz;
begin
  -- One author at a time: the checks and the debit below are atomic.
  perform pg_advisory_xact_lock(hashtext('coupleup-important:' || auth.uid()::text));

  select * into w from public.wishlist_items where id = p_item_id for update;
  if w.id is null then
    raise exception 'WISH_NOT_FOUND';
  end if;
  if w.created_by is distinct from auth.uid() then
    raise exception 'NOT_OWNER';
  end if;
  if w.status <> 'active' then
    raise exception 'WISH_NOT_ACTIVE';
  end if;
  if w.is_important then
    raise exception 'WISH_ALREADY_IMPORTANT';
  end if;
  v_partner := public.get_partner_id(w.couple_id, auth.uid());
  if v_partner is null then
    raise exception 'NO_PARTNER';
  end if;

  if exists (select 1 from public.wishlist_items
             where created_by = auth.uid() and is_important and important_seen_at is null
               and status <> 'done') then
    raise exception 'IMPORTANT_PENDING';
  end if;
  select max(important_at) into v_last from public.wishlist_items
  where created_by = auth.uid() and is_important;
  if v_last is not null and v_last > now() - interval '1 hour' then
    raise exception 'IMPORTANT_COOLDOWN';
  end if;
  if (select count(*) from public.wishlist_items
      where created_by = auth.uid() and is_important and important_at > now() - interval '24 hours') >= 3 then
    raise exception 'IMPORTANT_DAILY_LIMIT';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := round(0.5 * v_rate)::int;  -- 0049: 0.5 BOND (was 1); never touches the wish's price

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a
  where a.couple_id = w.couple_id and a.recipient_id = auth.uid();
  if v_balance < v_cost then
    raise exception 'IMPORTANT_NOT_ENOUGH_BOND';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (w.couple_id, auth.uid(), auth.uid(), 'Важное желание: ' || w.title, -v_cost, 'reward');

  update public.wishlist_items
     set is_important = true, important_at = now(), important_seen_at = null
   where id = p_item_id
  returning * into w;

  perform public.create_notification(w.couple_id, v_partner, 'wish_important', 'wishlist_item', w.id,
    '🚨 Важное желание', w.title);
  return w;
end;
$$;

revoke all on function public.make_wish_important(uuid) from public, anon;
grant execute on function public.make_wish_important(uuid) to authenticated;
