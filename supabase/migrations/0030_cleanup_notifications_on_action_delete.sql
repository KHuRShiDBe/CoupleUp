-- CoupleUp migration 0030: auto-clean notifications when their source action
-- row is deleted.
--
-- Root cause of the 402 orphaned "Новое доброе дело" notifications
-- (Sep 2026): notify_on_action_insert() (migration 0003) creates one
-- notifications row per INSERT into public.actions, with entity_id pointing
-- back at that actions row. Nothing ever deleted the notification when the
-- actions row was later deleted -- so migration 0025's throwaway test rows
-- (deleted by hand once testing was done, per 0025's own instructions) left
-- behind a notification each, forever. This trigger closes that gap.
--
-- Scope: notify_on_action_insert only ever creates entity_type 'action'
-- (good deed), 'task' (task completion) or 'goal' (goal contribution) from
-- an actions insert (see migration 0003) -- all three reference
-- public.actions.id. reward_request and other entity_types reference
-- different tables and are untouched by this trigger.

create or replace function public.cleanup_notifications_on_action_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.notifications
  where entity_id = OLD.id
    and entity_type in ('action', 'task', 'goal');
  return OLD;
end;
$$;

drop trigger if exists trg_cleanup_notifications_on_action_delete on public.actions;
create trigger trg_cleanup_notifications_on_action_delete
  after delete on public.actions
  for each row execute function public.cleanup_notifications_on_action_delete();
