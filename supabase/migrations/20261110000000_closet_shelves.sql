-- Closet shelves: named groups of listings, like Pinterest boards. Private to their owner.

create table public.shelves (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);
create index shelves_owner_idx on public.shelves (owner_id);

create table public.shelf_items (
  shelf_id uuid not null references public.shelves on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shelf_id, listing_id)
);
create index shelf_items_listing_idx on public.shelf_items (listing_id);

alter table public.shelves enable row level security;
alter table public.shelf_items enable row level security;

create policy "shelves: read own" on public.shelves for select to authenticated
  using (owner_id = auth.uid());
create policy "shelves: add own" on public.shelves for insert to authenticated
  with check (owner_id = auth.uid());
create policy "shelves: rename own" on public.shelves for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "shelves: remove own" on public.shelves for delete to authenticated
  using (owner_id = auth.uid());

-- Items follow their shelf: you can only see and change items on your own shelves.
create policy "shelf items: read own" on public.shelf_items for select to authenticated
  using (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = auth.uid()));
create policy "shelf items: add own" on public.shelf_items for insert to authenticated
  with check (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = auth.uid()));
create policy "shelf items: remove own" on public.shelf_items for delete to authenticated
  using (exists (select 1 from public.shelves s where s.id = shelf_id and s.owner_id = auth.uid()));

grant select, delete on public.shelves to authenticated;
grant insert (name) on public.shelves to authenticated;
grant update (name) on public.shelves to authenticated;
grant select, insert, delete on public.shelf_items to authenticated;
