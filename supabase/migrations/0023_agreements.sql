-- CoupleUp migration 0023: turns accepted couple_offers into real
-- agreements (deadline + assignee + completion/failure/mutual-cancel), a
-- ×2 late-failure penalty, and adds profile photo support (Storage bucket
-- + profiles.photo_url).
--
-- Purely additive to couple_offers (migration 0021): no row, column, or
-- existing behavior is removed -- new columns are nullable, the status
-- check constraint is only ever widened, never narrowed. respond_couple_offer
-- and respond_couple_offer_counter gain one extra `set assignee_id = ...`
-- on their existing accept path; everything else in both functions is
-- unchanged.
--
-- Safe to re-run: guarded create/policy/grant statements throughout.

-- ============================================================================
-- 1. couple_offers: new columns for the agreement lifecycle.
--    assignee_id = whoever did NOT create the offer -- they're the one who
--    committed to perform it once it (or a counter) was accepted.
-- ============================================================================

alter table public.couple_offers add column if not exists deadline timestamptz;
alter table public.couple_offers add column if not exists assignee_id uuid references public.profiles(id) on delete set null;
alter table public.couple_offers add column if not exists cancel_requested_by uuid references public.profiles(id) on delete set null;

alter table public.couple_offers drop constraint if exists couple_offers_status_check;
alter table public.couple_offers add constraint couple_offers_status_check
  check (status in ('pending', 'accepted', 'declined', 'completed', 'failed', 'cancel_pending', 'cancelled'));

-- ============================================================================
-- 2. respond_couple_offer -- unchanged rules, accept now also sets assignee_id.
-- ============================================================================

create or replace function public.respond_couple_offer(p_offer_id uuid, p_accept boolean)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if o.created_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if o.status <> 'pending' then
    return o;
  end if;

  update public.couple_offers
  set status = case when p_accept then 'accepted' else 'declined' end,
      assignee_id = case when p_accept then auth.uid() else assignee_id end,
      resolved_at = now()
  where id = p_offer_id
  returning * into o;

  return o;
end;
$$;

-- ============================================================================
-- 3. respond_couple_offer_counter -- unchanged rules, accept now also sets
--    assignee_id to the counter's proposer (the performer regardless of
--    whether the final price came from the original offer or a counter).
-- ============================================================================

create or replace function public.respond_couple_offer_counter(p_counter_id uuid, p_accept boolean)
returns public.couple_offer_counters
language plpgsql
security definer
as $$
declare
  c public.couple_offer_counters;
  o public.couple_offers;
begin
  select * into c from public.couple_offer_counters where id = p_counter_id for update;
  if c.id is null then
    raise exception 'COUNTER_NOT_FOUND';
  end if;
  if not public.is_couple_member(c.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  select * into o from public.couple_offers where id = c.offer_id for update;

  if auth.uid() <> o.created_by then
    raise exception 'NOT_PROPOSER';
  end if;
  if c.status <> 'pending' then
    return c;
  end if;

  if p_accept then
    if o.status <> 'pending' then
      raise exception 'OFFER_NOT_PENDING';
    end if;

    update public.couple_offers
    set price_points = c.price_points, status = 'accepted', assignee_id = c.proposed_by, resolved_at = now()
    where id = o.id;

    update public.couple_offer_counters
    set status = 'accepted', resolved_at = now()
    where id = p_counter_id
    returning * into c;
  else
    update public.couple_offer_counters
    set status = 'declined', resolved_at = now()
    where id = p_counter_id
    returning * into c;
  end if;

  return c;
end;
$$;

-- ============================================================================
-- 4. complete_agreement -- only the assignee may mark it done, only while
--    'accepted'. Pays price_points from the creator to the assignee.
-- ============================================================================

create or replace function public.complete_agreement(p_offer_id uuid)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if auth.uid() <> o.assignee_id then
    raise exception 'NOT_ASSIGNEE';
  end if;
  if o.status <> 'accepted' then
    raise exception 'AGREEMENT_NOT_ACTIVE';
  end if;

  update public.couple_offers
  set status = 'completed', resolved_at = now()
  where id = p_offer_id
  returning * into o;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (o.couple_id, o.created_by, o.assignee_id, o.title, o.price_points, 'action');

  return o;
end;
$$;

-- ============================================================================
-- 5. fail_agreement_penalty -- either partner may call; server re-checks the
--    deadline itself (never trusts the client's clock). Penalty always
--    charged to the assignee, multiplier always passed by the client from
--    coupleEconomyConfig.ts (FAILURE_PENALTY_MULTIPLIER) -- same trust
--    model as every other client-supplied points value in this app.
-- ============================================================================

create or replace function public.fail_agreement_penalty(p_offer_id uuid, p_multiplier int default 2)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if o.status <> 'accepted' then
    raise exception 'AGREEMENT_NOT_ACTIVE';
  end if;
  if o.deadline is null or now() <= o.deadline then
    raise exception 'DEADLINE_NOT_PASSED';
  end if;

  update public.couple_offers
  set status = 'failed', resolved_at = now()
  where id = p_offer_id
  returning * into o;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (o.couple_id, o.assignee_id, o.assignee_id, o.title, -(o.price_points * greatest(p_multiplier, 1)), 'action');

  return o;
end;
$$;

-- ============================================================================
-- 6. request_cancel_agreement / respond_cancel_agreement -- mutual consent
--    only; no penalty either way. Either party may request; only the OTHER
--    party may respond.
-- ============================================================================

create or replace function public.request_cancel_agreement(p_offer_id uuid)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if auth.uid() <> o.created_by and auth.uid() <> o.assignee_id then
    raise exception 'NOT_A_PARTY';
  end if;
  if o.status <> 'accepted' then
    raise exception 'AGREEMENT_NOT_ACTIVE';
  end if;

  update public.couple_offers
  set status = 'cancel_pending', cancel_requested_by = auth.uid()
  where id = p_offer_id
  returning * into o;

  return o;
end;
$$;

create or replace function public.respond_cancel_agreement(p_offer_id uuid, p_accept boolean)
returns public.couple_offers
language plpgsql
security definer
as $$
declare
  o public.couple_offers;
begin
  select * into o from public.couple_offers where id = p_offer_id for update;
  if o.id is null then
    raise exception 'OFFER_NOT_FOUND';
  end if;
  if not public.is_couple_member(o.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if o.status <> 'cancel_pending' then
    raise exception 'AGREEMENT_NOT_ACTIVE';
  end if;
  if auth.uid() = o.cancel_requested_by then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if auth.uid() <> o.created_by and auth.uid() <> o.assignee_id then
    raise exception 'NOT_A_PARTY';
  end if;

  update public.couple_offers
  set status = case when p_accept then 'cancelled' else 'accepted' end,
      cancel_requested_by = case when p_accept then cancel_requested_by else null end,
      resolved_at = case when p_accept then now() else null end
  where id = p_offer_id
  returning * into o;

  return o;
end;
$$;

-- ============================================================================
-- 7. Profile photo -- profiles.photo_url + a public Storage bucket. Each
--    user may only write inside their own user-id folder; reads are open
--    (the bucket is public) since the partner needs to see it too.
-- ============================================================================

alter table public.profiles add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile_photos_select_all" on storage.objects;
create policy "profile_photos_select_all" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "profile_photos_write_own" on storage.objects;
create policy "profile_photos_write_own" on storage.objects
  for insert with check (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "profile_photos_update_own" on storage.objects;
create policy "profile_photos_update_own" on storage.objects
  for update using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "profile_photos_delete_own" on storage.objects;
create policy "profile_photos_delete_own" on storage.objects
  for delete using (bucket_id = 'profile-photos' and auth.uid()::text = (storage.foldername(name))[1]);
