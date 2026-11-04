-- Lendr: move the test data forward so it looks like it was seeded today.
-- seed.sql writes dates relative to the day it ran, so they drift as time passes. Run this in the
-- SQL Editor before a demo. Safe to re-run: it works out how far behind the data is each time.
-- Only touches rows that belong to the .damtest@utexas.edu test accounts.

do $$
declare
  -- In seed.sql, Alex's first borrow (r1) starts 38 days before seeding.
  shift integer := public.austin_now()::date - (
    select start_date + 38 from public.rentals where id = md5('dam-seed-r1')::uuid
  );
  days interval;
begin
  if shift is null then
    raise exception 'Seed data not found. Run seed.sql first.';
  end if;
  -- The test admin's bio still has the old name.
  update public.profiles set bio = 'The Lendr team.' where bio = 'The DAM Fashion team.';

  if shift = 0 then
    raise notice 'Demo dates are already current.';
    return;
  end if;
  days := make_interval(days => shift);

  create temp table demo_users on commit drop as
    select id from auth.users where email like '%.damtest@utexas.edu';

  update public.rentals
  set start_date = start_date + shift,
      end_date = end_date + shift,
      created_at = created_at + days,
      picked_up_at = picked_up_at + days,
      returned_at = returned_at + days
  where borrower_id in (select id from demo_users) and lender_id in (select id from demo_users);

  update public.listings
  set created_at = created_at + days,
      blocked_dates = array(select d + shift from unnest(blocked_dates) d)
  where owner_id in (select id from demo_users);

  update public.sales set created_at = created_at + days
  where buyer_id in (select id from demo_users) and seller_id in (select id from demo_users);

  update public.conversations set created_at = created_at + days
  where borrower_id in (select id from demo_users) and owner_id in (select id from demo_users);

  update public.messages set created_at = created_at + days
  where sender_id in (select id from demo_users);

  update public.reviews
  set created_at = created_at + days,
      reply_created_at = reply_created_at + days
  where reviewer_id in (select id from demo_users);

  update public.saves set created_at = created_at + days
  where user_id in (select id from demo_users);

  update public.reports
  set created_at = created_at + days,
      reviewed_at = reviewed_at + days
  where reporter_id in (select id from demo_users);

  raise notice 'Moved demo dates forward % days.', shift;
end;
$$;
