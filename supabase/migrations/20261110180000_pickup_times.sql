-- Borrows get a pickup time and a return time, not just dates, so both people know when to
-- meet. Older borrows have none and show dates only. Times are Austin local, on the hour or
-- half hour, between 8 AM and 10 PM.

alter table public.rentals
  add column pickup_time time,
  add column return_time time,
  add constraint rentals_pickup_time_window check (
    pickup_time is null
    or (pickup_time between '08:00' and '22:00' and extract(minute from pickup_time) in (0, 30))
  ),
  add constraint rentals_return_time_window check (
    return_time is null
    or (return_time between '08:00' and '22:00' and extract(minute from return_time) in (0, 30))
  );

-- Return type changes, so the function has to be replaced. Same as 20261023000000_offered_price.sql
-- plus the two times, which only the two people in the borrow can see.
drop function public.public_rentals();

create function public.public_rentals()
returns table (
  id uuid, listing_id uuid, borrower_id uuid, lender_id uuid, start_date date, end_date date,
  pickup_spot text, status text, created_at timestamptz, picked_up_at timestamptz,
  returned_at timestamptz, returned_late boolean, condition_issue text, no_show_reported_by uuid,
  offered_price_per_day numeric, pickup_time time, return_time time
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.listing_id, r.borrower_id, r.lender_id, r.start_date, r.end_date,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.pickup_spot end,
         r.status, r.created_at, r.picked_up_at, r.returned_at, r.returned_late,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.condition_issue end,
         r.no_show_reported_by,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.offered_price_per_day end,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.pickup_time end,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.return_time end
  from public.rentals r
  where auth.uid() is not null;
$$;

-- Same as the version in 20261103120000_brand_and_pickup_spots.sql, plus the two times. They
-- default to null so an app that hasn't updated yet can still send requests.
drop function public.request_rental(uuid, date, date, text, numeric);

create function public.request_rental(
  target_listing_id uuid, start_on date, end_on date, spot text, offer_per_day numeric,
  pickup_at time default null, return_at time default null
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
  if pickup_at is not null and start_on + pickup_at <= public.austin_now() then
    raise exception 'Pick a pickup time that hasn''t passed yet.';
  end if;
  if end_on < start_on then
    raise exception 'The return date must be on or after the pickup date.';
  end if;
  if pickup_at is not null and return_at is not null and end_on = start_on and return_at <= pickup_at then
    raise exception 'For a one-day borrow, the return time has to be after the pickup time.';
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
    listing_id, borrower_id, lender_id, start_date, end_date, pickup_spot, offered_price_per_day,
    pickup_time, return_time
  )
  values (
    listing.id, auth.uid(), listing.owner_id, start_on, end_on, spot, offer_per_day, pickup_at, return_at
  )
  returning * into created;
  return created;
end;
$$;

revoke execute on function
  public.public_rentals(),
  public.request_rental(uuid, date, date, text, numeric, time, time)
from public, anon;

grant execute on function
  public.public_rentals(),
  public.request_rental(uuid, date, date, text, numeric, time, time)
to authenticated;
