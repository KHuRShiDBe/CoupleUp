-- CoupleUp migration 0018: QA fix package #3.
--
-- Sections:
--   1. respond_reward_request / respond_penalty: add the same `for update`
--      row lock complete_task/complete_promise/respond_purchase_request
--      already got (0016/0017). Without it, two near-simultaneous accept
--      calls for the same request could both pass the "status = pending"
--      check before either commits, double-deducting/double-confirming.
--      respond_reward_request also gains a balance check: accepting a
--      reward request must not be able to take the requester's own balance
--      negative. Penalties are deliberately NOT capped the same way -- a
--      penalty is an imposed consequence, not an opt-in spend, and is
--      allowed to put someone in the red by design.
--   2. game_reward_claims + claim_game_reward(): one small, reusable,
--      idempotent primitive (same shape as reward_claims/achievement_unlocks)
--      so PartnerQuiz/EitherOr/TruthOrDare can pay out a real points reward
--      exactly once per (couple, game_key) -- game_key encodes which game,
--      and for per-person rewards, which user, e.g.
--      'partner_quiz:partner-1:<uuid>', 'either_or:<uuid>', 'truth_or_dare'.
--   3. partner_quiz_answers -- PartnerQuiz moves off local-only state. Quiz
--      CONTENT stays static client-side (PARTNER_QUIZZES, unchanged, always
--      identical for both phones since quizId is a fixed nav param, never
--      randomized) -- only each partner's own answers are now real rows.
--   4. either_or_choices -- same pattern for EitherOr (EITHER_OR_PAIRS is
--      already a fixed, non-randomized array walk, so the "same question"
--      requirement was already satisfied; only answers were local-only).
--   5. truth_or_dare_progress -- ONE shared, couple-scoped row tracking the
--      current round number and which kind (truth/dare) was picked for it,
--      mutated only through the two RPCs below (no direct client write
--      policy, same reasoning as purchase_requests in 0017) so both phones
--      genuinely see the same round/kind instead of each picking locally.
--      The actual prompt TEXT is still never stored -- both phones derive it
--      deterministically client-side from (couple_id, round, kind), the same
--      "static content, real completion state" split every other game/
--      challenge in this app already uses.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- 1. Row-lock hardening for the two RPCs that didn't get it in 0016/0017.
-- ============================================================================

create or replace function public.respond_reward_request(p_request_id uuid, p_accept boolean)
returns public.reward_requests
language plpgsql
security definer
as $$
declare
  r public.reward_requests;
  current_balance int;
begin
  select * into r from public.reward_requests where id = p_request_id for update;
  if r.id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if not public.is_couple_member(r.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if r.requested_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if r.status <> 'pending' then
    return r;
  end if;

  if p_accept then
    select coalesce(sum(points), 0) into current_balance
    from public.actions
    where couple_id = r.couple_id and recipient_id = r.requested_by;

    if current_balance < r.cost then
      raise exception 'INSUFFICIENT_BALANCE';
    end if;
  end if;

  update public.reward_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      resolved_at = now()
  where id = p_request_id
  returning * into r;

  if p_accept then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (r.couple_id, r.requested_by, r.requested_by, r.title, -r.cost, 'reward');
  end if;

  return r;
end;
$$;

create or replace function public.respond_penalty(p_penalty_id uuid, p_accept boolean)
returns public.penalties
language plpgsql
security definer
as $$
declare
  p public.penalties;
begin
  select * into p from public.penalties where id = p_penalty_id for update;
  if p.id is null then
    raise exception 'PENALTY_NOT_FOUND';
  end if;
  if not public.is_couple_member(p.couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p.created_by = auth.uid() then
    raise exception 'CANNOT_SELF_CONFIRM';
  end if;
  if p.status <> 'pending' then
    return p;
  end if;

  update public.penalties
  set status = case when p_accept then 'confirmed' else 'rejected' end,
      resolved_at = now()
  where id = p_penalty_id
  returning * into p;

  if p_accept then
    insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
    values (p.couple_id, p.created_by, p.target_user_id, p.title, -p.points, 'penalty');
  end if;

  return p;
end;
$$;

-- ============================================================================
-- 2. game_reward_claims + claim_game_reward() -- shared, reusable, exactly-
--    once reward primitive for the mini-games below.
-- ============================================================================

create table if not exists public.game_reward_claims (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  game_key text not null,
  claimed_at timestamptz not null default now(),
  unique (couple_id, game_key)
);

alter table public.game_reward_claims enable row level security;

drop policy if exists "game_reward_claims_select_member" on public.game_reward_claims;
create policy "game_reward_claims_select_member" on public.game_reward_claims
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy: only the security-definer RPC below can write
-- here, so a client can never forge or bypass the "already claimed" guard.

grant usage on schema public to authenticated;
grant select on public.game_reward_claims to authenticated;

create or replace function public.claim_game_reward(p_couple_id uuid, p_game_key text, p_points int, p_title text)
returns boolean
language plpgsql
security definer
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.game_reward_claims (couple_id, game_key)
  values (p_couple_id, p_game_key);

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, p_points, 'action');

  return true;
exception when unique_violation then
  -- Already claimed (by this call racing itself, or a genuine retake) --
  -- no error, just no second payout.
  return false;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_reward_claims') then
    alter publication supabase_realtime add table public.game_reward_claims;
  end if;
end $$;

-- ============================================================================
-- 3. partner_quiz_answers
-- ============================================================================

create table if not exists public.partner_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  quiz_id text not null,
  question_index int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  selected_index int not null,
  created_at timestamptz not null default now(),
  unique (couple_id, quiz_id, question_index, user_id)
);

alter table public.partner_quiz_answers enable row level security;

drop policy if exists "partner_quiz_answers_select_member" on public.partner_quiz_answers;
create policy "partner_quiz_answers_select_member" on public.partner_quiz_answers
  for select using (public.is_couple_member(couple_id));

drop policy if exists "partner_quiz_answers_insert_self" on public.partner_quiz_answers;
create policy "partner_quiz_answers_insert_self" on public.partner_quiz_answers
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "partner_quiz_answers_update_self" on public.partner_quiz_answers;
create policy "partner_quiz_answers_update_self" on public.partner_quiz_answers
  for update using (user_id = auth.uid());

grant select, insert, update on public.partner_quiz_answers to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'partner_quiz_answers') then
    alter publication supabase_realtime add table public.partner_quiz_answers;
  end if;
end $$;

-- ============================================================================
-- 4. either_or_choices
-- ============================================================================

create table if not exists public.either_or_choices (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  pair_index int not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  choice text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, pair_index, user_id)
);

alter table public.either_or_choices enable row level security;

drop policy if exists "either_or_choices_select_member" on public.either_or_choices;
create policy "either_or_choices_select_member" on public.either_or_choices
  for select using (public.is_couple_member(couple_id));

drop policy if exists "either_or_choices_insert_self" on public.either_or_choices;
create policy "either_or_choices_insert_self" on public.either_or_choices
  for insert with check (user_id = auth.uid() and public.is_couple_member(couple_id));

drop policy if exists "either_or_choices_update_self" on public.either_or_choices;
create policy "either_or_choices_update_self" on public.either_or_choices
  for update using (user_id = auth.uid());

grant select, insert, update on public.either_or_choices to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'either_or_choices') then
    alter publication supabase_realtime add table public.either_or_choices;
  end if;
end $$;

-- ============================================================================
-- 5. truth_or_dare_progress -- one shared row per couple, RPC-only writes.
-- ============================================================================

create table if not exists public.truth_or_dare_progress (
  couple_id uuid primary key references public.couples(id) on delete cascade,
  current_round int not null default 1,
  current_kind text check (current_kind in ('truth', 'dare')),
  updated_at timestamptz not null default now()
);

alter table public.truth_or_dare_progress enable row level security;

drop policy if exists "truth_or_dare_progress_select_member" on public.truth_or_dare_progress;
create policy "truth_or_dare_progress_select_member" on public.truth_or_dare_progress
  for select using (public.is_couple_member(couple_id));

-- No insert/update policy for clients -- only set_truth_or_dare_kind() and
-- advance_truth_or_dare() below (both security definer) may write, so the
-- two phones can never race each other into an inconsistent round/kind.

grant select on public.truth_or_dare_progress to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'truth_or_dare_progress') then
    alter publication supabase_realtime add table public.truth_or_dare_progress;
  end if;
end $$;

create or replace function public.set_truth_or_dare_kind(p_couple_id uuid, p_kind text)
returns public.truth_or_dare_progress
language plpgsql
security definer
as $$
declare
  row_ public.truth_or_dare_progress;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_kind not in ('truth', 'dare') then
    raise exception 'INVALID_KIND';
  end if;

  insert into public.truth_or_dare_progress (couple_id, current_round, current_kind)
  values (p_couple_id, 1, p_kind)
  on conflict (couple_id) do update set current_kind = p_kind, updated_at = now();

  select * into row_ from public.truth_or_dare_progress where couple_id = p_couple_id;
  return row_;
end;
$$;

-- Advances to the next round. Once past p_total_rounds, claims the
-- couple-wide completion reward exactly once (via claim_game_reward, guarded
-- by game_reward_claims) and resets the round counter to 1 so the couple can
-- play again for fun without earning a second payout.
create or replace function public.advance_truth_or_dare(
  p_couple_id uuid,
  p_total_rounds int,
  p_reward_points int,
  p_title text
)
returns public.truth_or_dare_progress
language plpgsql
security definer
as $$
declare
  row_ public.truth_or_dare_progress;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  insert into public.truth_or_dare_progress (couple_id, current_round, current_kind)
  values (p_couple_id, 1, null)
  on conflict (couple_id) do nothing;

  update public.truth_or_dare_progress
  set current_round = current_round + 1, current_kind = null, updated_at = now()
  where couple_id = p_couple_id
  returning * into row_;

  if row_.current_round > p_total_rounds then
    perform public.claim_game_reward(p_couple_id, 'truth_or_dare', p_reward_points, p_title);
    update public.truth_or_dare_progress
    set current_round = 1, current_kind = null
    where couple_id = p_couple_id
    returning * into row_;
  end if;

  return row_;
end;
$$;
