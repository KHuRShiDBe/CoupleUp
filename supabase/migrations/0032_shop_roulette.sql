-- CoupleUp migration 0032: Shop Roulette -- a new, female-only 16-sector
-- wheel that replaces the intimate roulette entry point for female accounts
-- (male accounts keep the existing intimate roulette, untouched by this
-- file). Confirmed with the user before writing this:
--
--   - 16 sectors, order fixed to match assets/roulette/shop-roulette.png
--     (see src/constants/shopRoulette.ts) -- every sector is a WISH, saved
--     to the same wish_inventory table the main wish roulette already uses
--     (owner_id = auth.uid(), gender = 'female'). No sector is ever money.
--   - Cost: 10 BOND per spin, OR one coupon instead (same coupon the main
--     wish roulette's "Джекпот" sector grants -- item_key
--     'intimate_spin_coupon' in wish_inventory, NOT renamed, so coupons
--     already won under that key keep working). For a female owner, this is
--     now the wheel that coupon redeems against; for a male owner, it's
--     still spin_intimate_roulette (migration 0031) -- same token, two
--     different RPCs depending on who's spending it.
--   - Only a profile with role='female' may call this RPC -- checked
--     server-side from auth.uid()'s own profiles row, never trusted from a
--     client argument (same pattern as spin_wish_roulette's gender check).
--   - The winning sector is picked SERVER-SIDE (unlike intimate roulette,
--     where the client picks) -- the whole point of this feature is that
--     the server's result must exactly match the sector the wheel's pointer
--     lands on, so the server has to be the one deciding it, same
--     architecture as spin_wish_roulette.
--
-- Does NOT touch: intimate_roulette_* tables/RPC, spin_wish_roulette,
-- public.actions history, wish_roulette_results, or any existing balance.
-- Purely additive -- one new table, one new function.
--
-- Safe to re-run: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION,
-- guarded DROP POLICY IF EXISTS -- nothing is ever dropped or overwritten
-- destructively.

-- ============================================================================
-- 1. shop_roulette_results -- append-only spin history, couple-visible.
--    No client insert policy from the start (unlike intimate_roulette_results
--    originally was) -- only spin_shop_roulette (security definer, below)
--    may ever write here, since payment is real from day one on this wheel.
-- ============================================================================

create table if not exists public.shop_roulette_results (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  spun_by uuid references public.profiles(id) on delete set null,
  item_key text not null,
  used_coupon boolean not null default false,
  cost_points int not null default 0,
  client_request_id uuid,
  created_at timestamptz not null default now()
);

alter table public.shop_roulette_results enable row level security;

drop policy if exists "shop_roulette_results_select_member" on public.shop_roulette_results;
create policy "shop_roulette_results_select_member" on public.shop_roulette_results
  for select using (public.is_couple_member(couple_id));

-- No insert policy for clients -- only spin_shop_roulette() writes here.

grant usage on schema public to authenticated;
grant select on public.shop_roulette_results to authenticated;

create unique index if not exists shop_roulette_results_client_request_id_key
  on public.shop_roulette_results (client_request_id)
  where client_request_id is not null;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shop_roulette_results') then
    alter publication supabase_realtime add table public.shop_roulette_results;
  end if;
end $$;

-- ============================================================================
-- 2. spin_shop_roulette -- female-only. Cost is 10 BOND unless p_use_coupon
--    is true and the caller actually has one, in which case one coupon is
--    consumed and no BOND moves. The winning sector is picked here (weighted
--    random over all 16, equal weight) and returned as item_key -- the
--    client only ever animates the wheel to whatever index this function
--    decided, never rolls its own.
-- ============================================================================

create or replace function public.spin_shop_roulette(
  p_couple_id uuid,
  p_use_coupon boolean,
  p_client_request_id uuid
)
returns table(item_key text, used_coupon boolean, cost_points int, balance_after int, coupons_remaining int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rate int;
  v_cost int;
  v_balance int;
  v_gender text;
  v_item_key text;
  v_coupon_id uuid;
  v_coupons_remaining int;
  v_existing public.shop_roulette_results%rowtype;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_client_request_id is null then
    raise exception 'MISSING_REQUEST_ID';
  end if;

  -- Same per-caller serialization as the other two roulettes: two
  -- near-simultaneous spins from the same account can never both read the
  -- same pre-spin balance/coupon count.
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select * into v_existing from public.shop_roulette_results
  where client_request_id = p_client_request_id
    and spun_by = auth.uid()
    and couple_id = p_couple_id;
  if found then
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();
    select count(*) into v_coupons_remaining from public.wish_inventory
      where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available';
    return query select v_existing.item_key, v_existing.used_coupon, v_existing.cost_points, v_balance, v_coupons_remaining;
    return;
  end if;

  -- This wheel is female-only -- checked from the caller's own profile,
  -- never trusted from a client argument (same pattern as
  -- spin_wish_roulette's gender check).
  select role into v_gender from public.profiles where id = auth.uid();
  if v_gender <> 'female' then
    raise exception 'SHOP_ROULETTE_FEMALE_ONLY';
  end if;

  select b.points_per_bond into v_rate from public.bond_rates b order by b.effective_from desc limit 1;
  v_rate := coalesce(v_rate, 100);
  v_cost := 10 * v_rate;

  if p_use_coupon then
    select id into v_coupon_id from public.wish_inventory
    where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available'
    order by won_at asc
    limit 1
    for update;

    if v_coupon_id is null then
      raise exception 'NO_COUPON_AVAILABLE';
    end if;

    update public.wish_inventory set status = 'used', used_at = now() where id = v_coupon_id;
  else
    select coalesce(sum(a.points), 0) into v_balance
    from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

    if v_balance < v_cost then
      raise exception 'ROULETTE_NOT_ENOUGH_BOND';
    end if;

    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p_couple_id, auth.uid(), auth.uid(), 'Рулетка магазина: ставка', -v_cost, 'reward');
  end if;

  -- Equal weight over all 16 sectors -- keep this list in exact sync with
  -- SHOP_ROULETTE_ITEMS in src/constants/shopRoulette.ts (same order the
  -- wheel image and the client's index-lookup use).
  with pool(pool_key) as (
    values
      ('shop_handbag'), ('shop_socks'), ('shop_necklace'), ('shop_makeup'),
      ('shop_perfume'), ('shop_scarf'), ('shop_robe'), ('shop_bow'),
      ('shop_cream'), ('shop_earrings'), ('shop_bracelet'), ('shop_phone'),
      ('shop_candle'), ('shop_chocolate'), ('shop_mask'), ('shop_bag')
  ),
  ranked as (
    select pool_key, row_number() over () as rn, count(*) over () as total
    from pool
  ),
  roll as (
    select 1 + floor(random() * (select total from ranked limit 1)) as r
  )
  select ranked.pool_key into v_item_key
  from ranked, roll
  where ranked.rn = roll.r;

  insert into public.wish_inventory (couple_id, owner_id, gender, item_key)
  values (p_couple_id, auth.uid(), 'female', v_item_key);

  insert into public.shop_roulette_results (couple_id, spun_by, item_key, used_coupon, cost_points, client_request_id)
  values (p_couple_id, auth.uid(), v_item_key, p_use_coupon, (case when p_use_coupon then 0 else v_cost end), p_client_request_id);

  select coalesce(sum(a.points), 0) into v_balance
  from public.actions a where a.couple_id = p_couple_id and a.recipient_id = auth.uid();

  select count(*) into v_coupons_remaining from public.wish_inventory
    where owner_id = auth.uid() and item_key = 'intimate_spin_coupon' and status = 'available';

  return query select v_item_key, p_use_coupon, (case when p_use_coupon then 0 else v_cost end), v_balance, v_coupons_remaining;
end;
$$;

grant execute on function public.spin_shop_roulette(uuid, boolean, uuid) to authenticated;

notify pgrst, 'reload schema';
