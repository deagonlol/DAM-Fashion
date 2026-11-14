-- Missing-item fee: what a borrower owes if they lose an item.
--
-- The fee is the sale price when the listing has one. Otherwise the lender sets a replacement
-- value, at most 10x the daily rate (REPLACEMENT_CAP_MULTIPLIER in src/lib/data/listings.ts).
-- Listings from before this migration have no value and fall back to the cap.
--
-- A borrow keeps the fee it was requested at, like the offered price. It can be reported lost
-- by the borrower any time they have it, or by the lender once it's 7 days past due. A lost
-- item can still be returned with the return code, which clears the fee.

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

alter table public.listings
  add column replacement_value numeric(8, 2),
  add constraint listings_replacement_value_range check (
    replacement_value is null
    or (replacement_value > price_per_day and replacement_value <= price_per_day * 10)
  );

grant insert (replacement_value) on public.listings to authenticated;
grant update (replacement_value) on public.listings to authenticated;

-- Mirrors replacementValueFor in src/lib/data/listings.ts.
create function public.replacement_value_for(listing public.listings)
returns numeric
language sql immutable
as $$
  select coalesce(
    listing.sale_price,
    least(listing.replacement_value, listing.price_per_day * 10),
    listing.price_per_day * 10
  );
$$;

-- ---------------------------------------------------------------------------
-- Rentals
-- ---------------------------------------------------------------------------

alter table public.rentals
  add column replacement_value numeric(8, 2) check (replacement_value is null or replacement_value >= 0),
  add column lost_at timestamptz,
  add column lost_reported_by uuid references public.profiles;

-- Existing borrows get today's fee for their listing.
update public.rentals r
set replacement_value = public.replacement_value_for(l)
from public.listings l
where l.id = r.listing_id
  and r.replacement_value is null;

alter table public.rentals drop constraint rentals_status_check;
alter table public.rentals add constraint rentals_status_check check (status in (
  'requested', 'accepted', 'declined', 'cancelled', 'picked_up', 'returned', 'no_show', 'lost'
));

-- Return type changes, so the function has to be replaced. Same as 20261110180000_pickup_times.sql
-- plus the fee, which only the two people in the borrow can see, and when it was lost, which is
-- public because it can count as a strike.
drop function public.public_rentals();

create function public.public_rentals()
returns table (
  id uuid, listing_id uuid, borrower_id uuid, lender_id uuid, start_date date, end_date date,
  pickup_spot text, status text, created_at timestamptz, picked_up_at timestamptz,
  returned_at timestamptz, returned_late boolean, condition_issue text, no_show_reported_by uuid,
  offered_price_per_day numeric, pickup_time time, return_time time,
  replacement_value numeric, lost_at timestamptz, lost_reported_by uuid
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
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.return_time end,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.replacement_value end,
         r.lost_at, r.lost_reported_by
  from public.rentals r
  where auth.uid() is not null;
$$;

-- Same as the version in 20261111000000_sell_only_listings.sql, plus: the borrow keeps the
-- listing's missing-item fee at the time of the request.
create or replace function public.request_rental(
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
  if not listing.rentable then
    raise exception 'This item is only for sale.';
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
    pickup_time, return_time, replacement_value
  )
  values (
    listing.id, auth.uid(), listing.owner_id, start_on, end_on, spot, offer_per_day,
    pickup_at, return_at, public.replacement_value_for(listing)
  )
  returning * into created;
  return created;
end;
$$;

-- Same as the version in 20261020000002_app_functions.sql, plus: a lost item that turns up
-- can be returned too.
create or replace function public.confirm_return(target_id uuid, entered_code text)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.lender_id then raise exception 'The lender enters the return code.'; end if;
  if rental.status not in ('picked_up', 'lost') then raise exception 'This item isn''t out on a borrow.'; end if;
  if not exists (
    select 1 from public.rental_codes where rental_id = rental.id and kind = 'return' and code = trim(entered_code)
  ) then
    raise exception 'That code doesn''t match. Check the code on the borrower''s screen.';
  end if;
  update public.rentals
  set status = 'returned',
      returned_at = now(),
      -- Late means past the end of the return date plus a 2-hour grace period.
      returned_late = now() > ((rental.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '2 hours'
  where id = rental.id
  returning * into rental;
  return rental;
end;
$$;

-- Mirrors reportLost in src/lib/data/rentals.ts. Also pauses the listing so nobody requests
-- an item that's gone; the lender unpauses it if it comes back.
create function public.report_lost(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if rental.status <> 'picked_up' then raise exception 'This item isn''t out on a borrow.'; end if;
  if auth.uid() = rental.lender_id
     and now() <= ((rental.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '7 days' then
    raise exception 'You can mark it lost once it''s 7 days past the return date.';
  end if;
  update public.rentals set status = 'lost', lost_at = now(), lost_reported_by = auth.uid()
  where id = rental.id returning * into rental;
  update public.listings set paused = true where id = rental.listing_id;
  return rental;
end;
$$;

-- Same as the version in 20261112020000_appeals_and_ai_review.sql, plus: reporting an item lost
-- after the late cutoff still counts as a late return. Mirrors strikesFor in moderation.ts.
create or replace function public.strikes_for(target uuid)
returns table (source text, ref_id uuid, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with rental_strikes as (
    -- The person who didn't show is whoever didn't report it.
    select 'no_show'::text as source, r.id as ref_id,
           ((r.start_date + time '12:00') at time zone 'America/Chicago') as at
    from public.rentals r
    where r.status = 'no_show'
      and r.no_show_reported_by is not null
      and target = case when r.no_show_reported_by = r.lender_id then r.borrower_id else r.lender_id end
    union all
    -- Returned, still out, or reported lost more than 3 days past the due date.
    select 'late_return', r.id,
           case when r.status = 'returned' then r.returned_at
                else ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days' end
    from public.rentals r
    where r.borrower_id = target
      and (
        (r.status = 'returned'
          and r.returned_at > ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days')
        or (r.status = 'picked_up'
          and now() > ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days')
        or (r.status = 'lost'
          and r.lost_at > ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days')
      )
  ),
  report_strikes as (
    -- An upheld report about a borrow that already produced a strike doesn't count twice.
    select 'report'::text, p.id, coalesce(p.reviewed_at, p.created_at)
    from public.reports p
    where p.reported_user_id = target
      and p.status = 'upheld'
      and (p.rental_id is null or p.rental_id not in (select rs.ref_id from rental_strikes rs))
  ),
  all_strikes as (
    select * from rental_strikes
    union all
    select * from report_strikes
  )
  select s.source, s.ref_id, s.at
  from all_strikes s
  where s.at >= now() - interval '180 days' and s.at <= now()
    and not exists (
      select 1 from public.appeals a
      where a.user_id = target and a.source = s.source and a.ref_id = s.ref_id and a.status = 'approved'
    )
  order by s.at;
$$;

revoke execute on function
  public.replacement_value_for(public.listings),
  public.public_rentals(),
  public.report_lost(uuid)
from public, anon;

grant execute on function
  public.replacement_value_for(public.listings),
  public.public_rentals(),
  public.report_lost(uuid)
to authenticated;
