-- A request can't be accepted once its pickup day has passed (Austin time). The lender can send
-- a counter-offer with new dates instead, and the borrower can edit the request.
-- Same as accept_rental in 20261020000002_app_functions.sql, plus that check.
create or replace function public.accept_rental(target_id uuid)
returns public.rentals
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals := public.rental_for_update(target_id);
begin
  perform public.assert_can_transact();
  if auth.uid() <> rental.lender_id then raise exception 'Only the lender can accept.'; end if;
  if rental.status <> 'requested' then raise exception 'This request is no longer waiting for a response.'; end if;
  if rental.start_date < public.austin_now()::date then
    raise exception 'This request expired: its pickup day has passed. Send a counter-offer with new dates instead.';
  end if;
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
