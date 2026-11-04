-- Lendr: buy prices and a buy request for the test data. seed.sql sets these too, but only if
-- the sale_price migration ran first. Run in the SQL Editor. Safe to re-run.

-- Alex's cape, plus two items Alex can buy from other people.
update public.listings l
set sale_price = p.price
from (values ('l8', 40), ('l16', 120), ('l13', 150)) as p(short_name, price)
where l.id = md5('dam-seed-' || p.short_name)::uuid and l.sale_price is null and l.sold_at is null;

-- Priya wants to buy Alex's cape, so Alex can accept a borrow or a sale.
insert into public.sales (id, listing_id, buyer_id, seller_id, price, status, created_at)
select md5('dam-seed-s1')::uuid, md5('dam-seed-l8')::uuid, md5('dam-seed-u6')::uuid, md5('dam-seed-u1')::uuid,
       40, 'requested', now() - interval '1 hour'
where exists (select 1 from public.listings where id = md5('dam-seed-l8')::uuid)
on conflict (id) do nothing;
