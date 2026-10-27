-- CoupleUp migration 0051: quest milestone bonuses for month and year.
--
-- Requires 0033 (quest_progress, quest_bonus_claims + partial unique index),
-- 0047 (daily cap), 0048 (claim_quest_bonus). Reuses the existing
-- claim_quest_bonus -- create-or-replace only, no table/column/row changes.
-- Safe to re-run. Run inside BEGIN; ... COMMIT;.
--
-- Monthly and yearly lists now get the same 5/7/10 milestones as daily and
-- weekly: counted only from partner-approved items (quest_progress), paid
-- immediately without a second approval or partner notification, once per
-- (user, period, period_key, milestone), clamped by the 5 BOND daily cap.
--   month: 5 -> 40, 7 -> 60, 10 -> 100 points (2 BOND in total)
--   year:  5 -> 80, 7 -> 120, 10 -> 200 points (4 BOND in total)
-- Daily/weekly amounts are unchanged.

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
  v_pay int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  if p_period not in ('daily', 'weekly', 'monthly', 'yearly') then
    raise exception 'MILESTONES_NOT_AVAILABLE';
  end if;

  -- Server-fixed amounts (p_bonus_points is ignored). Every period has 10
  -- items. Day/week 20/30/50, month 40/60/100, year 80/120/200 points --
  -- every single bonus stays under the 500-point (5 BOND) daily cap, which
  -- still clamps the day's total.
  v_points := case
    when p_period in ('daily', 'weekly') then
      case p_milestone when 5 then 20 when 7 then 30 when 10 then 50
        when 15 then case when p_period = 'weekly' then 50 end  -- legacy weekly milestone
      end
    when p_period = 'monthly' then
      case p_milestone when 5 then 40 when 7 then 60 when 10 then 100 end
    when p_period = 'yearly' then
      case p_milestone when 5 then 80 when 7 then 120 when 10 then 200 end
  end;
  if v_points is null then
    raise exception 'INVALID_MILESTONE';
  end if;

  -- quest_progress rows exist only for partner-approved items.
  select count(*) into actual_count
  from public.quest_progress
  where couple_id = p_couple_id
    and period = p_period
    and period_key = p_period_key
    and completed_by = auth.uid();

  if actual_count < p_milestone then
    raise exception 'MILESTONE_NOT_REACHED';
  end if;

  perform pg_advisory_xact_lock(hashtext('coupleup-earn:' || auth.uid()::text));
  v_pay := least(v_points, public.daily_earn_remaining_points(auth.uid()));
  if v_pay <= 0 then
    raise exception 'DAILY_LIMIT_REACHED';
  end if;

  -- Claim first: the partial unique index makes a second claim a no-op, so
  -- the bonus can never be credited twice for the same period.
  insert into public.quest_bonus_claims (couple_id, user_id, period, period_key, milestone, points)
  values (p_couple_id, auth.uid(), p_period, p_period_key, p_milestone, v_pay)
  on conflict (user_id, period, period_key, milestone) where user_id is not null do nothing;

  if not found then
    return false;
  end if;

  -- Bonuses are not announced to the partner.
  perform set_config('coupleup.suppress_action_notify', 'on', true);
  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, v_pay, 'action');

  return true;
end;
$$;

grant execute on function public.claim_quest_bonus(uuid, text, text, int, int, text) to authenticated;
