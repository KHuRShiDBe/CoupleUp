-- CoupleUp migration 0007: let apply_action credit either partner.
--
-- Context (COUPLE POINTS VISIBILITY package): the app already has a real,
-- append-only points ledger -- public.actions (couple_id, author_id,
-- recipient_id, title, points, type, created_at), unchanged since migration
-- 0002. RLS on it is already correct (actions_select_member: only couple
-- members can read; couple_id is always required), and the
-- apply_couple_points_delta trigger already keeps couples.points/
-- earned_points/spent_points in sync from these rows. No new table and no
-- new migration was needed for the ledger itself -- only this one RPC change.
--
-- What was missing: apply_action() (used by the "Add action" screen, which
-- already lets you say "I did this for them" vs "they did this for me")
-- always hardcoded recipient_id = author_id = auth.uid(), so it could never
-- actually credit the partner -- every entry only ever credited whoever was
-- logged in. This adds an optional p_recipient_id (defaulting to the caller,
-- so existing callers keep working unchanged) and checks that the target is
-- really a member of the same couple, so a caller can only ever credit
-- themselves or their own partner -- never an arbitrary user.
--
-- Safe to re-run: create-or-replace, no data touched, no table changed.

create or replace function public.apply_action(
  p_couple_id uuid,
  p_title text,
  p_points int,
  p_recipient_id uuid default null
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

  insert into public.actions (couple_id, author_id, recipient_id, title, points, type)
  values (p_couple_id, auth.uid(), target_recipient, p_title, p_points, 'action')
  returning * into new_action;

  return new_action;
end;
$$;
