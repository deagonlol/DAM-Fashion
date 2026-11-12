-- Change plans and counter-offers on borrows.
--
-- While a request is waiting, the borrower can edit it directly, and the lender can answer with a
-- counter-offer (different price, dates, times or spot). Accepting a counter-offer confirms the borrow.
-- After a borrow is confirmed and before pickup, either person can propose new dates, times or a spot;
-- the other person accepts or declines. One proposal can be open per borrow at a time.

create table public.rental_proposals (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals on delete cascade,
  proposer_id uuid not null references public.profiles on delete cascade,
  start_date date not null,
  end_date date not null,
  pickup_time time,
  return_time time,
  pickup_spot text not null check (pickup_spot in (
    'Texas Union', 'PCL (Perry-Castañeda Library)', 'Gregory Gym', 'Jester Center',
    'Speedway Plaza', 'West Campus (Guadalupe & 24th)'
  )),
  price_per_day numeric(8, 2) not null check (price_per_day >= 0),
  note text not null default '' check (char_length(note) <= 300),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
create index rental_proposals_rental_idx on public.rental_proposals (rental_id);
create unique index rental_proposals_one_open on public.rental_proposals (rental_id) where status = 'pending';

alter table public.rental_proposals enable row level security;

-- Only the two people in the borrow see its proposals. Changes go through the functions below.
create policy "rental proposals: read own" on public.rental_proposals for select to authenticated
  using (exists (
    select 1 from public.rentals r
    where r.id = rental_id and auth.uid() in (r.borrower_id, r.lender_id)
  ));

grant select on public.rental_proposals to authenticated;
alter publication supabase_realtime add table public.rental_proposals;

-- Checks a set of borrow terms the same way request_rental does. `by_lender` relaxes the rules the
-- lender controls: they can offer below their listed price and on days they blocked themselves.
create function public.assert_valid_rental_terms(
  rental public.rentals, start_on date, end_on date, spot text, pickup_at time, return_at time,
  per_day numeric, by_lender boolean
)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  listing public.listings;
begin
  select * into listing from public.listings where id = rental.listing_id and deleted_at is null;
  if listing.id is null then raise exception 'This listing no longer exists.'; end if;
  if not listing.rentable then raise exception 'This item is only for sale.'; end if;
  if cardinality(listing.pickup_spots) > 0 and not (spot = any(listing.pickup_spots)) then
    raise exception 'Pick one of the lender''s pickup spots.';
  end if;
  if start_on < public.austin_now()::date then raise exception 'Pick a pickup date from today on.'; end if;
  if pickup_at is not null and start_on + pickup_at <= public.austin_now() then
    raise exception 'Pick a pickup time that hasn''t passed yet.';
  end if;
  if end_on < start_on then raise exception 'The return date must be on or after the pickup date.'; end if;
  if pickup_at is not null and return_at is not null and end_on = start_on and return_at <= pickup_at then
    raise exception 'For a one-day borrow, the return time has to be after the pickup time.';
  end if;
  if end_on - start_on + 1 > 14 then raise exception 'Borrows can be at most 14 days.'; end if;
  if per_day < 0 then raise exception 'The price can''t be negative.'; end if;
  if not by_lender and per_day < listing.price_per_day then
    raise exception 'Offer at least the listed daily price.';
  end if;
  if exists (
    select 1 from public.rentals
    where id <> rental.id and listing_id = rental.listing_id and status in ('accepted', 'picked_up')
      and start_date <= end_on and start_on <= end_date
  ) then
    raise exception 'It''s already booked for some of those dates.';
  end if;
  if not by_lender and exists (select 1 from unnest(listing.blocked_dates) d where d between start_on and end_on) then
    raise exception 'The owner isn''t lending it on some of those dates.';
  end if;
end;
$$;

revoke execute on function public.assert_valid_rental_terms(public.rentals, date, date, text, time, time, numeric, boolean)
  from public, anon, authenticated;

-- The borrower edits their own waiting request, the lender counters it, or either person proposes a
-- change to a confirmed borrow. Returns the proposal, or null when the borrower edited directly.
create function public.propose_rental_change(
  target_id uuid, start_on date, end_on date, spot text, pickup_at time, return_at time,
  per_day numeric, message text default ''
)
returns public.rental_proposals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
  is_lender boolean;
  open_proposal public.rental_proposals;
  created public.rental_proposals;
begin
  perform public.assert_can_transact();
  if auth.uid() not in (rental.borrower_id, rental.lender_id) then
    raise exception 'Only the two people in this borrow can change it.';
  end if;
  if public.is_blocked_between(rental.borrower_id, rental.lender_id) then
    raise exception 'You can''t interact with this person.';
  end if;
  if rental.status not in ('requested', 'accepted') then
    raise exception 'This borrow can''t be changed anymore.';
  end if;
  is_lender := auth.uid() = rental.lender_id;
  -- On a confirmed borrow the price is settled; only the plans change.
  if rental.status = 'accepted' then
    per_day := coalesce(rental.offered_price_per_day, per_day);
  end if;
  perform public.assert_valid_rental_terms(rental, start_on, end_on, spot, pickup_at, return_at, per_day, is_lender);

  select * into open_proposal from public.rental_proposals where rental_id = rental.id and status = 'pending';
  if open_proposal.id is not null and open_proposal.proposer_id <> auth.uid() then
    raise exception 'Answer the change they proposed first.';
  end if;
  -- A new proposal replaces your own open one.
  update public.rental_proposals set status = 'withdrawn', responded_at = now()
    where rental_id = rental.id and status = 'pending';

  -- The lender hasn't agreed to anything yet, so the borrower can just edit their request.
  if rental.status = 'requested' and not is_lender then
    update public.rentals set
      start_date = start_on, end_date = end_on, pickup_spot = spot, pickup_time = pickup_at,
      return_time = return_at, offered_price_per_day = per_day
    where id = rental.id;
    return null;
  end if;

  insert into public.rental_proposals (
    rental_id, proposer_id, start_date, end_date, pickup_time, return_time, pickup_spot, price_per_day, note
  )
  values (rental.id, auth.uid(), start_on, end_on, pickup_at, return_at, spot, per_day, left(coalesce(message, ''), 300))
  returning * into created;
  return created;
end;
$$;

-- The other person accepts or declines an open proposal. Accepting a lender's counter-offer
-- confirms the borrow, the same as accept_rental.
create function public.respond_to_rental_proposal(target_id uuid, accept boolean)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  proposal public.rental_proposals;
  rental public.rentals;
begin
  select * into proposal from public.rental_proposals where id = target_id;
  if proposal.id is null then raise exception 'Proposal not found.'; end if;
  rental := public.rental_for_update(proposal.rental_id);
  perform public.assert_can_transact();
  if auth.uid() not in (rental.borrower_id, rental.lender_id) or auth.uid() = proposal.proposer_id then
    raise exception 'Only the other person can answer this.';
  end if;
  if proposal.status <> 'pending' then raise exception 'This proposal was already answered.'; end if;
  if rental.status not in ('requested', 'accepted') then raise exception 'This borrow can''t be changed anymore.'; end if;

  if not accept then
    update public.rental_proposals set status = 'declined', responded_at = now() where id = proposal.id;
    return rental;
  end if;

  -- Dates may have been taken since it was proposed.
  perform public.assert_valid_rental_terms(
    rental, proposal.start_date, proposal.end_date, proposal.pickup_spot, proposal.pickup_time,
    proposal.return_time, proposal.price_per_day, true
  );
  update public.rentals set
    start_date = proposal.start_date, end_date = proposal.end_date, pickup_spot = proposal.pickup_spot,
    pickup_time = proposal.pickup_time, return_time = proposal.return_time,
    offered_price_per_day = proposal.price_per_day
  where id = rental.id;
  update public.rental_proposals set status = 'accepted', responded_at = now() where id = proposal.id;

  if rental.status = 'requested' then
    insert into public.rental_codes (rental_id, kind, holder_id, code) values
      (rental.id, 'pickup', rental.lender_id, (1000 + floor(random() * 9000))::int::text),
      (rental.id, 'return', rental.borrower_id, (1000 + floor(random() * 9000))::int::text);
    update public.rentals set status = 'accepted' where id = rental.id;
  end if;
  select * into rental from public.rentals where id = rental.id;
  return rental;
end;
$$;

create function public.withdraw_rental_proposal(target_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.rental_proposals set status = 'withdrawn', responded_at = now()
  where id = target_id and proposer_id = auth.uid() and status = 'pending';
  if not found then raise exception 'There''s no open proposal of yours to withdraw.'; end if;
end;
$$;

-- Open proposals stop applying once a borrow is declined, cancelled, picked up or missed.
create function public.expire_rental_proposals()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.rental_proposals set status = 'expired', responded_at = now()
  where rental_id = new.id and status = 'pending';
  return new;
end;
$$;

revoke execute on function public.expire_rental_proposals() from public, anon, authenticated;

create trigger rentals_expire_proposals
  after update of status on public.rentals
  for each row
  when (new.status not in ('requested', 'accepted'))
  execute function public.expire_rental_proposals();

revoke execute on function
  public.propose_rental_change(uuid, date, date, text, time, time, numeric, text),
  public.respond_to_rental_proposal(uuid, boolean),
  public.withdraw_rental_proposal(uuid)
from public, anon;

grant execute on function
  public.propose_rental_change(uuid, date, date, text, time, time, numeric, text),
  public.respond_to_rental_proposal(uuid, boolean),
  public.withdraw_rental_proposal(uuid)
to authenticated;
