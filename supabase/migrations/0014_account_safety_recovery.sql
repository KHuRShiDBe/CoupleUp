-- CoupleUp migration 0014: account safety, recovery, and couple disconnect.
--
-- Two independent fixes, both additive/non-destructive:
--
-- 1. SECURITY/DATA-INTEGRITY FIX: every couple-shared table added in
--    migrations 0010-0013 (mood_checkins, daily_answers, couple_moments,
--    important_dates, habits, habit_logs, promises, date_idea_saves, wants,
--    plan_items, shopping_items, budgets, expenses, savings_goals,
--    savings_contributions, purchase_requests, daily_challenges,
--    reward_claims, quiz_answers) referenced profiles(id) with
--    "on delete cascade". That means deleting EITHER partner's account
--    silently wiped the shared history out from under the OTHER, still-
--    active partner -- the exact bug migration 0004 already fixed for the
--    original five tables (actions/tasks/goals/reward_requests/penalties),
--    just never carried forward to every table added afterward. Converts
--    all of them to "on delete set null" so a couple's shared record
--    survives either partner deleting their account (the departed partner's
--    id is simply nulled out, same pattern as 0004).
--
--    Deliberately EXCLUDED: surprise_ideas.author_id. That table is
--    single-author-private by design (RLS: only the author can ever select
--    their own rows) -- if the author's account is gone, nobody could ever
--    read those rows again anyway, so cascading them away is correct, not a
--    bug.
--
-- 2. leave_couple() now performs a full, safe disconnect instead of a
--    solo exit: removes BOTH members (not just the caller) and immediately
--    invalidates the couple's invite code, so neither the departed partner
--    nor a stranger can rejoin this couple shell with the old code, and
--    the remaining partner is correctly routed back to "connect a partner"
--    instead of being left "paired" with someone who is gone. Shared
--    history/points/tasks/goals/habits/etc are left completely untouched
--    for both former partners to keep as their own record.
--
-- Safe to re-run: every statement uses IF EXISTS / OR REPLACE, no table or
-- row is ever dropped.

-- ============================================================================
-- 1. Nullable-on-delete for every couple-shared author/user reference added
--    since 0004 (see rationale above). Each column already has NOT NULL
--    dropped only where dropping it is required to allow NULL.
-- ============================================================================

-- 0010_couple_interaction
alter table public.mood_checkins alter column user_id drop not null;
alter table public.mood_checkins drop constraint if exists mood_checkins_user_id_fkey;
alter table public.mood_checkins add constraint mood_checkins_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.daily_answers alter column user_id drop not null;
alter table public.daily_answers drop constraint if exists daily_answers_user_id_fkey;
alter table public.daily_answers add constraint daily_answers_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.couple_moments alter column author_id drop not null;
alter table public.couple_moments drop constraint if exists couple_moments_author_id_fkey;
alter table public.couple_moments add constraint couple_moments_author_id_fkey foreign key (author_id) references public.profiles(id) on delete set null;

alter table public.important_dates alter column created_by drop not null;
alter table public.important_dates drop constraint if exists important_dates_created_by_fkey;
alter table public.important_dates add constraint important_dates_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- 0011_habits_promises_dates_plans
alter table public.habits alter column created_by drop not null;
alter table public.habits drop constraint if exists habits_created_by_fkey;
alter table public.habits add constraint habits_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.habit_logs alter column user_id drop not null;
alter table public.habit_logs drop constraint if exists habit_logs_user_id_fkey;
alter table public.habit_logs add constraint habit_logs_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.promises alter column from_user_id drop not null;
alter table public.promises drop constraint if exists promises_from_user_id_fkey;
alter table public.promises add constraint promises_from_user_id_fkey foreign key (from_user_id) references public.profiles(id) on delete set null;

alter table public.promises alter column to_user_id drop not null;
alter table public.promises drop constraint if exists promises_to_user_id_fkey;
alter table public.promises add constraint promises_to_user_id_fkey foreign key (to_user_id) references public.profiles(id) on delete set null;

alter table public.date_idea_saves alter column created_by drop not null;
alter table public.date_idea_saves drop constraint if exists date_idea_saves_created_by_fkey;
alter table public.date_idea_saves add constraint date_idea_saves_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.wants alter column user_id drop not null;
alter table public.wants drop constraint if exists wants_user_id_fkey;
alter table public.wants add constraint wants_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.plan_items alter column created_by drop not null;
alter table public.plan_items drop constraint if exists plan_items_created_by_fkey;
alter table public.plan_items add constraint plan_items_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

-- 0012_budget_shopping_savings
alter table public.shopping_items alter column added_by drop not null;
alter table public.shopping_items drop constraint if exists shopping_items_added_by_fkey;
alter table public.shopping_items add constraint shopping_items_added_by_fkey foreign key (added_by) references public.profiles(id) on delete set null;

alter table public.budgets alter column created_by drop not null;
alter table public.budgets drop constraint if exists budgets_created_by_fkey;
alter table public.budgets add constraint budgets_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.expenses alter column paid_by drop not null;
alter table public.expenses drop constraint if exists expenses_paid_by_fkey;
alter table public.expenses add constraint expenses_paid_by_fkey foreign key (paid_by) references public.profiles(id) on delete set null;

alter table public.expenses alter column created_by drop not null;
alter table public.expenses drop constraint if exists expenses_created_by_fkey;
alter table public.expenses add constraint expenses_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.savings_goals alter column created_by drop not null;
alter table public.savings_goals drop constraint if exists savings_goals_created_by_fkey;
alter table public.savings_goals add constraint savings_goals_created_by_fkey foreign key (created_by) references public.profiles(id) on delete set null;

alter table public.savings_contributions alter column user_id drop not null;
alter table public.savings_contributions drop constraint if exists savings_contributions_user_id_fkey;
alter table public.savings_contributions add constraint savings_contributions_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.purchase_requests alter column requested_by drop not null;
alter table public.purchase_requests drop constraint if exists purchase_requests_requested_by_fkey;
alter table public.purchase_requests add constraint purchase_requests_requested_by_fkey foreign key (requested_by) references public.profiles(id) on delete set null;

alter table public.purchase_requests alter column recipient_id drop not null;
alter table public.purchase_requests drop constraint if exists purchase_requests_recipient_id_fkey;
alter table public.purchase_requests add constraint purchase_requests_recipient_id_fkey foreign key (recipient_id) references public.profiles(id) on delete set null;

-- 0013_games_challenges_levels
alter table public.daily_challenges alter column completed_by drop not null;
alter table public.daily_challenges drop constraint if exists daily_challenges_completed_by_fkey;
alter table public.daily_challenges add constraint daily_challenges_completed_by_fkey foreign key (completed_by) references public.profiles(id) on delete set null;

alter table public.reward_claims alter column claimed_by drop not null;
alter table public.reward_claims drop constraint if exists reward_claims_claimed_by_fkey;
alter table public.reward_claims add constraint reward_claims_claimed_by_fkey foreign key (claimed_by) references public.profiles(id) on delete set null;

alter table public.quiz_answers alter column user_id drop not null;
alter table public.quiz_answers drop constraint if exists quiz_answers_user_id_fkey;
alter table public.quiz_answers add constraint quiz_answers_user_id_fkey foreign key (user_id) references public.profiles(id) on delete set null;

-- ============================================================================
-- 2. leave_couple(): full mutual disconnect + invite code invalidation.
-- ============================================================================

create or replace function public.leave_couple()
returns void
language plpgsql
security definer
as $$
declare
  my_couple uuid;
begin
  select couple_id into my_couple from public.couple_members where user_id = auth.uid();
  if my_couple is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  update public.reward_requests
  set status = 'rejected', resolved_at = now()
  where couple_id = my_couple and status = 'pending';

  update public.penalties
  set status = 'rejected', resolved_at = now()
  where couple_id = my_couple and status = 'pending';

  -- Full disconnect: remove BOTH members so neither side stays "paired"
  -- with someone who is no longer reachable, and kill the old invite code
  -- immediately so it can never be reused (by the departed partner or by a
  -- stranger who happened to have it). The couples row itself, and every
  -- couple-scoped history table, is left completely untouched.
  delete from public.couple_members where couple_id = my_couple;
  update public.couples set code_expires_at = now() where id = my_couple;
end;
$$;
