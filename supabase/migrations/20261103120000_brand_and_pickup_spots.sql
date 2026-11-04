-- Listings can name a brand and the pickup spots the lender is willing to meet at.
-- No spots means anywhere on the usual list.

alter table public.listings
  add column brand text not null default '' check (char_length(brand) <= 40),
  add column pickup_spots text[] not null default '{}' check (
    pickup_spots <@ array[
      'Texas Union', 'PCL (Perry-Castañeda Library)', 'Gregory Gym', 'Jester Center',
      'Speedway Plaza', 'West Campus (Guadalupe & 24th)'
    ]::text[]
  );

grant insert (brand, pickup_spots) on public.listings to authenticated;
grant update (brand, pickup_spots) on public.listings to authenticated;

-- Same as the version in 20261023120000_sale_price.sql, plus: the spot must be one the lender offers.
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
  if cardinality(listing.pickup_spots) > 0 and not (spot = any(listing.pickup_spots)) then
    raise exception 'Pick one of the lender''s pickup spots.';
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
