-- A listing can also be bought, at a price higher than its daily rate.
-- Accepting a buy marks it sold and closes other open requests.

alter table public.listings
  add column sale_price numeric(8, 2),
  add column sold_at timestamptz,
  add constraint listings_sale_above_daily check (sale_price is null or sale_price > price_per_day);

grant insert (sale_price) on public.listings to authenticated;
grant update (sale_price) on public.listings to authenticated;

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  buyer_id uuid not null references public.profiles on delete cascade,
  seller_id uuid not null references public.profiles on delete cascade,
  price numeric(8, 2) not null check (price >= 0),
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  check (buyer_id <> seller_id)
);
create index sales_listing_idx on public.sales (listing_id);
create unique index sales_one_open_request on public.sales (listing_id, buyer_id) where status = 'requested';
create unique index sales_one_accepted on public.sales (listing_id) where status = 'accepted';

alter table public.sales enable row level security;
create policy "sales: read own" on public.sales for select to authenticated
  using (auth.uid() in (buyer_id, seller_id));
grant select on public.sales to authenticated;

-- Only the buyer and seller can see a buy request.
create function public.public_sales()
returns table (
  id uuid, listing_id uuid, buyer_id uuid, seller_id uuid, price numeric, status text, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select s.id, s.listing_id, s.buyer_id, s.seller_id, s.price, s.status, s.created_at
  from public.sales s
  where auth.uid() in (s.buyer_id, s.seller_id);
$$;

create function public.request_sale(target_listing_id uuid)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare
  listing public.listings;
  created public.sales;
begin
  perform public.assert_can_transact();
  select * into listing from public.listings where id = target_listing_id and deleted_at is null for update;
  if listing.id is null then
    raise exception 'Listing not found.';
  end if;
  if public.is_blocked_between(auth.uid(), listing.owner_id) then
    raise exception 'You can''t interact with this person.';
  end if;
  if listing.owner_id = auth.uid() then
    raise exception 'You can''t buy your own item.';
  end if;
  if listing.sold_at is not null then
    raise exception 'This item has been sold.';
  end if;
  if listing.paused or public.is_restricted(listing.owner_id) then
    raise exception 'This item isn''t available right now.';
  end if;
  if listing.sale_price is null then
    raise exception 'This item isn''t for sale.';
  end if;
  if exists (
    select 1 from public.sales
    where listing_id = listing.id and buyer_id = auth.uid() and status = 'requested'
  ) then
    raise exception 'You already asked to buy this item.';
  end if;

  insert into public.sales (listing_id, buyer_id, seller_id, price)
  values (listing.id, auth.uid(), listing.owner_id, listing.sale_price)
  returning * into created;
  return created;
end;
$$;

create function public.accept_sale(target_id uuid)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare
  sale public.sales;
  listing public.listings;
begin
  perform public.assert_can_transact();
  select * into sale from public.sales where id = target_id for update;
  if sale.id is null or auth.uid() not in (sale.buyer_id, sale.seller_id) then
    raise exception 'Buy request not found.';
  end if;
  if auth.uid() <> sale.seller_id then
    raise exception 'Only the seller can accept.';
  end if;
  if sale.status <> 'requested' then
    raise exception 'This request is no longer waiting for a response.';
  end if;

  select * into listing from public.listings where id = sale.listing_id for update;
  if listing.sold_at is not null then
    raise exception 'This item has been sold.';
  end if;
  if exists (
    select 1 from public.rentals
    where listing_id = sale.listing_id and status in ('accepted', 'picked_up')
  ) then
    raise exception 'Finish the current borrow first.';
  end if;

  update public.sales set status = 'accepted' where id = sale.id returning * into sale;
  update public.listings set sold_at = now() where id = sale.listing_id;
  update public.sales set status = 'declined'
  where listing_id = sale.listing_id and status = 'requested' and id <> sale.id;
  update public.rentals set status = 'declined'
  where listing_id = sale.listing_id and status = 'requested';
  return sale;
end;
$$;

create function public.decline_sale(target_id uuid)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare
  sale public.sales;
begin
  select * into sale from public.sales where id = target_id for update;
  if sale.id is null or auth.uid() not in (sale.buyer_id, sale.seller_id) then
    raise exception 'Buy request not found.';
  end if;
  if auth.uid() <> sale.seller_id then
    raise exception 'Only the seller can decline.';
  end if;
  if sale.status <> 'requested' then
    raise exception 'This request is no longer waiting for a response.';
  end if;
  update public.sales set status = 'declined' where id = sale.id returning * into sale;
  return sale;
end;
$$;

create function public.cancel_sale(target_id uuid)
returns public.sales
language plpgsql security definer set search_path = ''
as $$
declare
  sale public.sales;
begin
  select * into sale from public.sales where id = target_id for update;
  if sale.id is null or auth.uid() not in (sale.buyer_id, sale.seller_id) then
    raise exception 'Buy request not found.';
  end if;
  if auth.uid() <> sale.buyer_id then
    raise exception 'Only the buyer can cancel.';
  end if;
  if sale.status <> 'requested' then
    raise exception 'This request is no longer waiting for a response.';
  end if;
  update public.sales set status = 'cancelled' where id = sale.id returning * into sale;
  return sale;
end;
$$;

-- A sold item can't be borrowed.
create or replace function public.request_rental(
  target_listing_id uuid, start_on date, end_on date, spot text, offer_per_day numeric
)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  listing public.listings;
  created public.rentals;
begin
  perform public.assert_can_transact();
  select * into listing from public.listings where id = target_listing_id and deleted_at is null for update;
  if listing.id is null then
    raise exception 'Listing not found.';
  end if;
  if public.is_blocked_between(auth.uid(), listing.owner_id) then
    raise exception 'You can''t interact with this person.';
  end if;
  if listing.owner_id = auth.uid() then
    raise exception 'You can''t borrow your own item.';
  end if;
  if listing.sold_at is not null then
    raise exception 'This item has been sold.';
  end if;
  if listing.paused or public.is_restricted(listing.owner_id) then
    raise exception 'This item isn''t available to borrow right now.';
  end if;
  if start_on < public.austin_now()::date then
    raise exception 'Pick a pickup date from today on.';
  end if;
  if end_on < start_on then
    raise exception 'The return date must be on or after the pickup date.';
  end if;
  if end_on - start_on + 1 > 14 then
    raise exception 'Borrows can be at most 14 days.';
  end if;
  if offer_per_day < listing.price_per_day then
    raise exception 'Offer at least the listed daily price.';
  end if;
  if exists (
    select 1 from public.rentals
    where listing_id = listing.id and borrower_id = auth.uid() and status in ('requested', 'accepted', 'picked_up')
  ) then
    raise exception 'You already have an open borrow for this item.';
  end if;
  if exists (
    select 1 from public.rentals
    where listing_id = listing.id and status in ('accepted', 'picked_up')
      and start_date <= end_on and start_on <= end_date
  ) then
    raise exception 'It''s already booked for some of those dates.';
  end if;
  if exists (select 1 from unnest(listing.blocked_dates) d where d between start_on and end_on) then
    raise exception 'The owner isn''t lending it on some of those dates.';
  end if;

  insert into public.rentals (
    listing_id, borrower_id, lender_id, start_date, end_date, pickup_spot, offered_price_per_day
  )
  values (listing.id, auth.uid(), listing.owner_id, start_on, end_on, spot, offer_per_day)
  returning * into created;
  return created;
end;
$$;

-- Deleting a listing also closes buy requests that were still waiting.
create or replace function public.delete_listing(target_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.listings where id = target_id and owner_id = auth.uid() and deleted_at is null) then
    raise exception 'You can only change your own listings.';
  end if;
  if exists (select 1 from public.rentals where listing_id = target_id and status in ('accepted', 'picked_up')) then
    raise exception 'It has an upcoming or active borrow. Finish or cancel that first, or pause it instead.';
  end if;
  update public.rentals set status = 'declined' where listing_id = target_id and status = 'requested';
  update public.sales set status = 'declined' where listing_id = target_id and status = 'requested';
  update public.listings set deleted_at = now() where id = target_id;
end;
$$;

revoke execute on function
  public.public_sales(),
  public.request_sale(uuid),
  public.accept_sale(uuid),
  public.decline_sale(uuid),
  public.cancel_sale(uuid)
from public, anon;

grant execute on function
  public.public_sales(),
  public.request_sale(uuid),
  public.accept_sale(uuid),
  public.decline_sale(uuid),
  public.cancel_sale(uuid)
to authenticated;

alter publication supabase_realtime add table public.sales;
