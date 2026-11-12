-- Lendr: rules enforced on the server, and the read functions the app uses.
--
-- The app keeps its rules as pure TypeScript (src/lib/data/*.ts) for instant feedback, but anyone
-- with the publishable key can call the API directly, so everything that matters is re-checked
-- here. Error messages match the app's so they can be shown as-is.
--
-- Times: the app treats dates as Austin local time, so these functions do too.

-- ---------------------------------------------------------------------------
-- Schema changes
-- ---------------------------------------------------------------------------

-- Listings are soft-deleted so past borrows, chats, and reviews of them survive.
alter table public.listings add column deleted_at timestamptz;

-- Either side of a block can see it (the app hides both people from each other).
drop policy "blocks: read own" on public.blocks;
create policy "blocks: read either side" on public.blocks for select to authenticated
  using (auth.uid() in (blocker_id, blocked_id));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create function public.austin_now()
returns timestamp
language sql stable
as $$ select now() at time zone 'America/Chicago' $$;

create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- Mirrors strikesFor in src/lib/data/moderation.ts.
create function public.strikes_for(target uuid)
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
    -- Returned, or still out, more than 3 days past the due date.
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
  order by s.at;
$$;

-- Mirrors penaltyFor + isRestricted: 3+ strikes is a ban, 2 is a soft ban for 7 days after the latest.
create function public.is_restricted(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when count(*) >= 3 then true
    when count(*) = 2 then now() < max(s.at) + interval '7 days'
    else false
  end
  from public.strikes_for(target) s;
$$;

create function public.assert_can_transact()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.';
  end if;
  if public.is_restricted(auth.uid()) then
    raise exception 'Your account is limited right now because of recent no-shows or reports. You can still message and return items.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Policies that now also check blocks and restrictions
-- ---------------------------------------------------------------------------

drop policy "listings: read" on public.listings;
create policy "listings: read" on public.listings for select to authenticated
  using (deleted_at is null and (not paused or owner_id = auth.uid()));

drop policy "listings: insert own" on public.listings;
create policy "listings: insert own" on public.listings for insert to authenticated
  with check (owner_id = auth.uid() and not public.is_restricted(auth.uid()));

drop policy "conversations: start" on public.conversations;
create policy "conversations: start" on public.conversations for insert to authenticated
  with check (
    auth.uid() in (borrower_id, owner_id)
    and not public.is_blocked_between(borrower_id, owner_id)
    and exists (
      select 1 from public.listings l
      where l.id = conversations.listing_id and l.owner_id = conversations.owner_id
    )
  );

drop policy "messages: send" on public.messages;
create policy "messages: send" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and auth.uid() in (c.borrower_id, c.owner_id)
        and not public.is_blocked_between(c.borrower_id, c.owner_id)
    )
  );

-- Borrows are only created through request_rental below.
drop policy "rentals: request" on public.rentals;
revoke insert on public.rentals from authenticated;
-- Listings are only deleted through delete_listing below.
drop policy "listings: delete own" on public.listings;
revoke delete on public.listings from authenticated;

-- ---------------------------------------------------------------------------
-- Public reads
-- ---------------------------------------------------------------------------

-- Every borrow, for badges, stats, and strikes. Pickup spot and condition notes are only
-- returned to the two people in the borrow.
create function public.public_rentals()
returns table (
  id uuid, listing_id uuid, borrower_id uuid, lender_id uuid, start_date date, end_date date,
  pickup_spot text, status text, created_at timestamptz, picked_up_at timestamptz,
  returned_at timestamptz, returned_late boolean, condition_issue text, no_show_reported_by uuid
)
language sql stable security definer set search_path = ''
as $$
  select r.id, r.listing_id, r.borrower_id, r.lender_id, r.start_date, r.end_date,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.pickup_spot end,
         r.status, r.created_at, r.picked_up_at, r.returned_at, r.returned_late,
         case when auth.uid() in (r.borrower_id, r.lender_id) then r.condition_issue end,
         r.no_show_reported_by
  from public.rentals r
  where auth.uid() is not null;
$$;

-- Upheld reports count as strikes, so everyone needs to know they exist, but not who filed them.
create function public.upheld_reports()
returns table (id uuid, reported_user_id uuid, rental_id uuid, created_at timestamptz, reviewed_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.reported_user_id, p.rental_id, p.created_at, p.reviewed_at
  from public.reports p
  where p.status = 'upheld' and auth.uid() is not null;
$$;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

-- Mirrors deleteListing: refuses while a borrow is upcoming or active, declines waiting requests.
create function public.delete_listing(target_id uuid)
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
  update public.listings set deleted_at = now() where id = target_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrows. Each mirrors the function of the same name in src/lib/data/rentals.ts.
-- ---------------------------------------------------------------------------

create function public.request_rental(
  target_listing_id uuid, start_on date, end_on date, spot text
)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  listing public.listings;
  created public.rentals;
begin
  perform public.assert_can_transact();
  select * into listing from public.listings where id = target_listing_id and deleted_at is null;
  if listing.id is null then
    raise exception 'Listing not found.';
  end if;
  if public.is_blocked_between(auth.uid(), listing.owner_id) then
    raise exception 'You can''t interact with this person.';
  end if;
  if listing.owner_id = auth.uid() then
    raise exception 'You can''t borrow your own item.';
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

  insert into public.rentals (listing_id, borrower_id, lender_id, start_date, end_date, pickup_spot)
  values (listing.id, auth.uid(), listing.owner_id, start_on, end_on, spot)
  returning * into created;
  return created;
end;
$$;

-- Loads a borrow for the caller, or fails the way findOrThrow does.
create function public.rental_for_update(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  found public.rentals;
begin
  select * into found from public.rentals where id = target_id for update;
  if found.id is null or auth.uid() not in (found.borrower_id, found.lender_id) then
    raise exception 'Borrow not found.';
  end if;
  return found;
end;
$$;

create function public.accept_rental(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  perform public.assert_can_transact();
  if auth.uid() <> rental.lender_id then raise exception 'Only the lender can accept.'; end if;
  if rental.status <> 'requested' then raise exception 'This request is no longer waiting for a response.'; end if;
  if exists (
    select 1 from public.rentals
    where id <> rental.id and listing_id = rental.listing_id and status in ('accepted', 'picked_up')
      and start_date <= rental.end_date and rental.start_date <= end_date
  ) then
    raise exception 'You''ve already accepted another borrow for some of these dates.';
  end if;

  -- The lender shows the pickup code; the borrower shows the return code.
  insert into public.rental_codes (rental_id, kind, holder_id, code) values
    (rental.id, 'pickup', rental.lender_id, (1000 + floor(random() * 9000))::int::text),
    (rental.id, 'return', rental.borrower_id, (1000 + floor(random() * 9000))::int::text);
  update public.rentals set status = 'accepted' where id = rental.id returning * into rental;
  return rental;
end;
$$;

create function public.decline_rental(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.lender_id then raise exception 'Only the lender can decline.'; end if;
  if rental.status <> 'requested' then raise exception 'This request is no longer waiting for a response.'; end if;
  update public.rentals set status = 'declined' where id = rental.id returning * into rental;
  return rental;
end;
$$;

create function public.cancel_rental(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.borrower_id then raise exception 'Only the borrower can cancel.'; end if;
  if rental.status not in ('requested', 'accepted') then raise exception 'This borrow can''t be cancelled anymore.'; end if;
  update public.rentals set status = 'cancelled' where id = rental.id returning * into rental;
  return rental;
end;
$$;

create function public.confirm_pickup(target_id uuid, entered_code text)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.borrower_id then raise exception 'The borrower enters the pickup code.'; end if;
  if rental.status <> 'accepted' then raise exception 'This borrow isn''t waiting for pickup.'; end if;
  if not exists (
    select 1 from public.rental_codes where rental_id = rental.id and kind = 'pickup' and code = trim(entered_code)
  ) then
    raise exception 'That code doesn''t match. Check the code on the lender''s screen.';
  end if;
  update public.rentals set status = 'picked_up', picked_up_at = now() where id = rental.id returning * into rental;
  return rental;
end;
$$;

create function public.confirm_return(target_id uuid, entered_code text)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.lender_id then raise exception 'The lender enters the return code.'; end if;
  if rental.status <> 'picked_up' then raise exception 'This item isn''t out on a borrow.'; end if;
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

create function public.report_condition_issue(target_id uuid, description text)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if auth.uid() <> rental.lender_id then raise exception 'Only the lender can report a problem with the item.'; end if;
  if coalesce(trim(description), '') = '' then raise exception 'Describe what was wrong.'; end if;
  if rental.status <> 'returned' or rental.condition_issue is not null
     or now() > rental.returned_at + interval '24 hours' then
    raise exception 'Problems must be reported within 24 hours of the return.';
  end if;
  update public.rentals set condition_issue = trim(description) where id = rental.id returning * into rental;
  return rental;
end;
$$;

create function public.report_no_show(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  if rental.status <> 'accepted' or public.austin_now() < rental.start_date::timestamp then
    raise exception 'You can report a no-show once the pickup day has started.';
  end if;
  update public.rentals set status = 'no_show', no_show_reported_by = auth.uid()
  where id = rental.id returning * into rental;
  return rental;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from anon, public;

grant execute on function
  public.is_blocked_between(uuid, uuid),
  public.strikes_for(uuid),
  public.is_restricted(uuid),
  public.public_rentals(),
  public.upheld_reports(),
  public.delete_listing(uuid),
  public.request_rental(uuid, date, date, text),
  public.accept_rental(uuid),
  public.decline_rental(uuid),
  public.cancel_rental(uuid),
  public.confirm_pickup(uuid, text),
  public.confirm_return(uuid, text),
  public.report_condition_issue(uuid, text),
  public.report_no_show(uuid)
to authenticated;

-- Live updates: new borrow requests and status changes, and new chats (RLS still applies).
alter publication supabase_realtime add table public.rentals;
alter publication supabase_realtime add table public.conversations;
