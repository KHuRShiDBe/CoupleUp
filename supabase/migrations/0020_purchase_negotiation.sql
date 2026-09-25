-- CoupleUp migration 0020: Feature Package #4B -- partner negotiation /
-- counter-offers for purchase requests.
--
-- Scope: negotiation is added ONLY to purchase_requests (real-world $ asks),
-- not reward_requests (fixed points catalog) -- bargaining over a real price
-- ("$30 instead of $50") is the natural fit; a fixed-cost catalog reward
-- isn't something that makes sense to haggle over the same way.
--
-- Flow:
--   1. recipient_id (who'd fulfil the purchase) can, instead of a flat
--      approve/decline, propose a counter price via
--      propose_purchase_counter_offer() -- this does NOT change the
--      purchase_request's own status, it just attaches a pending offer.
--   2. requested_by (who originally asked) responds to that offer via
--      respond_purchase_counter_offer():
--        - accept: the purchase_request itself is updated to the
--          countered price and marked 'approved', atomically.
--        - decline: only the offer is marked declined; the original
--          purchase_request stays 'pending' so the recipient can still
--          approve/decline it directly (via the existing
--          respond_purchase_request) or propose another counter.
--   3. A new counter automatically supersedes any still-pending one for the
--      same request, so there's only ever one live offer at a time.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

create table if not exists public.purchase_request_offers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  proposed_by uuid references public.profiles(id) on delete set null,
  price_usd numeric not null check (price_usd > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'superseded')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.purchase_request_offers enable row level security;

drop policy if exists "purchase_request_offers_select_member" on public.purchase_request_offers;
create policy "purchase_request_offers_select_member" on public.purchase_request_offers
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy for clients -- only the two RPCs below (both
-- security definer) can write here, so a client can't forge an offer's
-- status or skip the "supersede the previous pending offer" step.

grant usage on schema public to authenticated;
grant select on public.purchase_request_offers to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'purchase_request_offers') then
    alter publication supabase_realtime add table public.purchase_request_offers;
  end if;
end $$;

-- ============================================================================
-- propose_purchase_counter_offer -- only the RECIPIENT (who'd fulfil the
-- purchase) may propose a counter price, same "other party responds" rule
-- as every accept/decline flow elsewhere in this app. Only while the
-- request is still 'pending'.
-- ============================================================================

create or replace function public.propose_purchase_counter_offer(
  p_request_id uuid,
  p_price_usd numeric,
  p_note text default null
)
returns public.purchase_request_offers
language plpgsql
security definer
as $$
declare
  pr public.purchase_requests;
  offer public.purchase_request_offers;
begin
  select * into pr from public.purchase_requests where id = p_request_id for update;
  if pr.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(pr.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if auth.uid() <> pr.recipient_id then
    raise exception 'NOT_RECIPIENT';
  end if;
  if pr.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;
  if p_price_usd is null or p_price_usd <= 0 then
    raise exception 'INVALID_PRICE';
  end if;

  update public.purchase_request_offers
  set status = 'superseded', resolved_at = now()
  where purchase_request_id = p_request_id and status = 'pending';

  insert into public.purchase_request_offers (couple_id, purchase_request_id, proposed_by, price_usd, note)
  values (pr.couple_id, p_request_id, auth.uid(), p_price_usd, p_note)
  returning * into offer;

  return offer;
end;
$$;

-- ============================================================================
-- respond_purchase_counter_offer -- only the ORIGINAL REQUESTER may accept
-- or decline a counter-offer. Accepting atomically re-prices AND approves
-- the underlying purchase_request in the same transaction.
-- ============================================================================

create or replace function public.respond_purchase_counter_offer(p_offer_id uuid, p_accept boolean)
returns public.purchase_request_offers
language plpgsql
security definer
as $$
declare
  offer public.purchase_request_offers;
  pr public.purchase_requests;
begin
  select * into offer from public.purchase_request_offers where id = p_offer_id for update;
  if offer.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(offer.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into pr from public.purchase_requests where id = offer.purchase_request_id for update;

  if auth.uid() <> pr.requested_by then
    raise exception 'NOT_REQUESTER';
  end if;
  if offer.status <> 'pending' then
    return offer;
  end if;

  if p_accept then
    if pr.status <> 'pending' then
      raise exception 'REQUEST_NOT_PENDING';
    end if;

    update public.purchase_requests
    set price_usd = offer.price_usd, status = 'approved', resolved_at = now()
    where id = pr.id;

    update public.purchase_request_offers
    set status = 'accepted', resolved_at = now()
    where id = p_offer_id
    returning * into offer;
  else
    update public.purchase_request_offers
    set status = 'declined', resolved_at = now()
    where id = p_offer_id
    returning * into offer;
  end if;

  return offer;
end;
$$;
