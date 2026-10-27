-- CoupleUp migration 0053: quest key catalog for the 10-item pools.
--
-- Bug: "Отметить" fails with UNKNOWN_QUEST_ITEM. The live
-- complete_quest_item() checks item keys against the OLD 15-item pools
-- (that check is not in this repo), so the new dm_/df_ (and wm_/wf_, mm_/mf_,
-- ym_/yf_) keys are rejected.
--
-- Fix: a server-side catalog of the CURRENT keys (= src/constants/questPools/*,
-- points = QUEST_BASE_POINTS) and complete_quest_item() re-created on top of
-- it. Anti-forgery is kept: an unknown key still raises UNKNOWN_QUEST_ITEM,
-- and the points always come from the server (catalog, or the couple's own
-- quest_custom_items row for custom:* keys), never from the client.
-- Flow unchanged: it only creates the pending action_requests row; the
-- partner's approval (respond_action_request), points, BOND, daily cap and
-- history are not touched. Signature unchanged. Safe to re-run.
-- Run inside BEGIN; ... COMMIT;.

create table if not exists public.quest_item_catalog (
  period text not null check (period in ('daily', 'weekly', 'monthly', 'yearly')),
  item_key text not null,
  points int not null check (points > 0),
  primary key (period, item_key)
);

alter table public.quest_item_catalog enable row level security;
revoke all on public.quest_item_catalog from anon, authenticated;

insert into public.quest_item_catalog (period, item_key, points) values
    ('daily', 'dm_morning', 15),
    ('daily', 'dm_thanks', 15),
    ('daily', 'dm_compliment', 15),
    ('daily', 'dm_drink', 25),
    ('daily', 'dm_listen', 25),
    ('daily', 'dm_plan', 25),
    ('daily', 'dm_chore', 40),
    ('daily', 'dm_massage', 40),
    ('daily', 'dm_gift', 40),
    ('daily', 'dm_dinner', 60),
    ('daily', 'df_morning', 15),
    ('daily', 'df_proud', 15),
    ('daily', 'df_hug', 15),
    ('daily', 'df_snack', 25),
    ('daily', 'df_listen', 25),
    ('daily', 'df_date_idea', 25),
    ('daily', 'df_errand', 40),
    ('daily', 'df_massage', 40),
    ('daily', 'df_gift', 40),
    ('daily', 'df_evening', 60),
    ('weekly', 'wm_note', 30),
    ('weekly', 'wm_playlist', 30),
    ('weekly', 'wm_grateful', 30),
    ('weekly', 'wm_breakfast', 50),
    ('weekly', 'wm_walk', 50),
    ('weekly', 'wm_errand', 50),
    ('weekly', 'wm_cleaning', 80),
    ('weekly', 'wm_movie', 80),
    ('weekly', 'wm_massage', 80),
    ('weekly', 'wm_date', 120),
    ('weekly', 'wf_voice', 30),
    ('weekly', 'wf_grateful', 30),
    ('weekly', 'wf_photo', 30),
    ('weekly', 'wf_lunch', 50),
    ('weekly', 'wf_game', 50),
    ('weekly', 'wf_errand', 50),
    ('weekly', 'wf_dish', 80),
    ('weekly', 'wf_spa', 80),
    ('weekly', 'wf_surprise', 80),
    ('weekly', 'wf_date', 120),
    ('monthly', 'mm_letter', 60),
    ('monthly', 'mm_flowers', 60),
    ('monthly', 'mm_memory', 60),
    ('monthly', 'mm_cafe', 100),
    ('monthly', 'mm_album', 100),
    ('monthly', 'mm_skill', 100),
    ('monthly', 'mm_day_off', 150),
    ('monthly', 'mm_fix', 150),
    ('monthly', 'mm_thoughtful_gift', 150),
    ('monthly', 'mm_trip', 250),
    ('monthly', 'mf_letter', 60),
    ('monthly', 'mf_treat', 60),
    ('monthly', 'mf_plans', 60),
    ('monthly', 'mf_cafe', 100),
    ('monthly', 'mf_video', 100),
    ('monthly', 'mf_hobby', 100),
    ('monthly', 'mf_day_off', 150),
    ('monthly', 'mf_feast', 150),
    ('monthly', 'mf_gift', 150),
    ('monthly', 'mf_adventure', 250),
    ('yearly', 'ym_letter', 150),
    ('yearly', 'ym_tradition', 150),
    ('yearly', 'ym_keepsake', 150),
    ('yearly', 'ym_anniv', 250),
    ('yearly', 'ym_family', 250),
    ('yearly', 'ym_book', 250),
    ('yearly', 'ym_course', 400),
    ('yearly', 'ym_project', 400),
    ('yearly', 'ym_challenge', 400),
    ('yearly', 'ym_vacation', 500),
    ('yearly', 'yf_letter', 150),
    ('yearly', 'yf_wishlist', 150),
    ('yearly', 'yf_keepsake', 150),
    ('yearly', 'yf_anniv', 250),
    ('yearly', 'yf_friends', 250),
    ('yearly', 'yf_film', 250),
    ('yearly', 'yf_class', 400),
    ('yearly', 'yf_dream', 400),
    ('yearly', 'yf_habit', 400),
    ('yearly', 'yf_vacation', 500)
on conflict (period, item_key) do update set points = excluded.points;

create or replace function public.complete_quest_item(
  p_couple_id uuid,
  p_period text,
  p_period_key text,
  p_item_key text,
  p_title text,
  p_points int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_points int;
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;

  if p_item_key like 'custom:%' then
    select c.points into v_points
    from public.quest_custom_items c
    where c.couple_id = p_couple_id
      and c.period = p_period
      and c.period_key = p_period_key
      and c.item_key = p_item_key;
  else
    select q.points into v_points
    from public.quest_item_catalog q
    where q.period = p_period
      and q.item_key = p_item_key;
  end if;

  if v_points is null then
    raise exception 'UNKNOWN_QUEST_ITEM';
  end if;

  if exists (
    select 1 from public.quest_progress
    where couple_id = p_couple_id
      and period = p_period
      and period_key = p_period_key
      and item_key = p_item_key
  ) then
    return false;
  end if;

  insert into public.action_requests (couple_id, actor_user_id, recipient_id, title, points, period, period_key, item_key)
  values (p_couple_id, auth.uid(), auth.uid(), p_title, v_points, p_period, p_period_key, p_item_key);

  return true;
exception when unique_violation then
  return false;
end;
$$;

revoke all on function public.complete_quest_item(uuid, text, text, text, text, int) from public, anon;
grant execute on function public.complete_quest_item(uuid, text, text, text, text, int) to authenticated;

notify pgrst, 'reload schema';
