-- Saved searches: a student saves a search (text and filters) and the app shows how many new
-- listings match it since they last looked.
create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  label text not null check (char_length(label) between 1 and 60),
  filters jsonb not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index saved_searches_user_idx on public.saved_searches (user_id);

alter table public.saved_searches enable row level security;

create policy "saved searches: read own" on public.saved_searches for select to authenticated
  using (user_id = auth.uid());
create policy "saved searches: add own" on public.saved_searches for insert to authenticated
  with check (user_id = auth.uid());
create policy "saved searches: update own" on public.saved_searches for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "saved searches: remove own" on public.saved_searches for delete to authenticated
  using (user_id = auth.uid());

grant select, delete on public.saved_searches to authenticated;
grant insert (label, filters) on public.saved_searches to authenticated;
grant update (last_seen_at, label) on public.saved_searches to authenticated;
