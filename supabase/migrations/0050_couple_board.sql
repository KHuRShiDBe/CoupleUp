-- CoupleUp migration 0050: shared couple board (drawing + text).
--
-- Requires 0001 (couples, is_couple_member), 0002 (profiles). Additive only:
-- one new table + one RPC, nothing existing is changed. Safe to re-run.
-- Run inside BEGIN; ... COMMIT;.
--
-- One board per couple = all couple_board_items rows of that couple_id.
-- Each row is one finished action (a stroke, an eraser stroke or a text), so
-- "undo" = delete your own latest row and the board survives app restarts.
-- Coordinates are normalised 0..1, so both phones render the same board.

create table if not exists public.couple_board_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  kind text not null check (kind in ('stroke', 'eraser', 'text')),
  color text not null check (color in ('red', 'blue', 'green', 'eraser')),
  -- stroke/eraser: {"points": [[x, y], ...]}; text: {"x": .., "y": .., "text": ".."}
  data jsonb not null check (octet_length(data::text) <= 60000),
  created_at timestamptz not null default now()
);

create index if not exists couple_board_items_couple_created_idx
  on public.couple_board_items (couple_id, created_at);

alter table public.couple_board_items enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'couple_board_items' and policyname = 'couple_board_items_select_member') then
    create policy "couple_board_items_select_member" on public.couple_board_items
      for select using (public.is_couple_member(couple_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'couple_board_items' and policyname = 'couple_board_items_insert_own') then
    create policy "couple_board_items_insert_own" on public.couple_board_items
      for insert with check (author_id = auth.uid() and public.is_couple_member(couple_id));
  end if;
  -- Undo removes only your own actions.
  if not exists (select 1 from pg_policies where schemaname = 'public'
                 and tablename = 'couple_board_items' and policyname = 'couple_board_items_delete_own') then
    create policy "couple_board_items_delete_own" on public.couple_board_items
      for delete using (author_id = auth.uid() and public.is_couple_member(couple_id));
  end if;
end $$;

grant select, insert, delete on public.couple_board_items to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime'
                 and schemaname = 'public' and tablename = 'couple_board_items') then
    alter publication supabase_realtime add table public.couple_board_items;
  end if;
end $$;

-- "Clear board" (after confirmation in the app): removes every item of the
-- caller's couple, including the partner's.
create or replace function public.clear_couple_board(p_couple_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_couple_member(p_couple_id) then
    raise exception 'NOT_A_MEMBER';
  end if;
  delete from public.couple_board_items where couple_id = p_couple_id;
end;
$$;

revoke all on function public.clear_couple_board(uuid) from public, anon;
grant execute on function public.clear_couple_board(uuid) to authenticated;
