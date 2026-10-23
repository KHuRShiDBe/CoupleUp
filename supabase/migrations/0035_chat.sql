-- CoupleUp migration 0035: Chat -- a plain text message log between the two
-- members of a couple, with a read_at column for read-receipt status.
--
-- No points/payout involved, so (same reasoning as intimate_roulette_*
-- in migration 0022) plain client-writable insert/update under RLS is
-- enough -- there's nothing here worth forging via a client-only couple_id.
-- membership is still always re-checked server-side through
-- public.is_couple_member(couple_id), never trusted from the client alone.
--
-- Safe to re-run: guarded create/policy/grant statements throughout, no
-- table or column is ever dropped, every function is `create or replace`.

-- ============================================================================
-- chat_messages -- append-only log, one row per message. Only two updatable
-- things ever happen to a row after insert: the RECIPIENT (never the sender)
-- marks it read by setting read_at. No delete policy -- deleting messages is
-- out of scope for this MVP.
-- ============================================================================

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (char_length(btrim(text)) > 0 and char_length(text) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists chat_messages_couple_created_idx on public.chat_messages (couple_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_select_member" on public.chat_messages;
create policy "chat_messages_select_member" on public.chat_messages
  for select using (public.is_couple_member(couple_id));

drop policy if exists "chat_messages_insert_self" on public.chat_messages;
create policy "chat_messages_insert_self" on public.chat_messages
  for insert with check (public.is_couple_member(couple_id) and sender_id = auth.uid());

-- Only the recipient (never the sender) can update a row, and only to mark
-- it read -- the client only ever sends { read_at }.
drop policy if exists "chat_messages_update_recipient" on public.chat_messages;
create policy "chat_messages_update_recipient" on public.chat_messages
  for update using (public.is_couple_member(couple_id) and sender_id <> auth.uid())
  with check (public.is_couple_member(couple_id) and sender_id <> auth.uid());

grant usage on schema public to authenticated;
grant select, insert, update on public.chat_messages to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;

notify pgrst, 'reload schema';
