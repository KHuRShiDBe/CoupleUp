-- CoupleUp migration 0040: dedicated 'reward_chest' actions.type so claiming
-- a Reward Chest milestone stops firing the generic "Новое доброе дело" /
-- "Партнёр совершил доброе дело" notification (notify_on_action_insert,
-- migration 0003/0015, only handles 'action'/'task'/'goal'/'compliment' --
-- any other type already falls through with no notification at all, so no
-- trigger change is needed here, only letting this new type exist).
--
-- Reward Chest stays a stays immediate, system-verified reward (not a
-- self-reported action) -- it deliberately does NOT go through
-- action_requests/partner approval, unlike AddActionScreen's "quick" tab
-- and daily quests (migrations 0037/0038).
--
-- Safe to re-run: guarded constraint drop/re-add, create-or-replace.

do $$
declare
  v_conname text;
begin
  select conname into v_conname
  from pg_constraint
  where conrelid = 'public.actions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%in%';
  if v_conname is not null then
    execute format('alter table public.actions drop constraint %I', v_conname);
  end if;
end $$;

alter table public.actions add constraint actions_type_check
  check (type in ('action', 'task', 'reward', 'penalty', 'goal', 'compliment', 'reward_chest'));

create or replace function public.apply_action(
  p_couple_id uuid,
  p_title text,
  p_points int,
  p_recipient_id uuid default null,
  p_type text default 'action'
)
returns public.actions
language plpgsql
security definer
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

  if p_type not in ('action', 'compliment', 'reward_chest') then
    raise exception 'INVALID_TYPE';
  end if;

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, p_type)
  returning * into new_action;

  return new_action;
end;
$$;

notify pgrst, 'reload schema';
