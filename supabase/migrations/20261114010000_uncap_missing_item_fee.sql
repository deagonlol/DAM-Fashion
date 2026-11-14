-- Lenders' missing-item fees no longer have a cap. It only has to be more than the daily rate.
-- Listings with no fee set (made before the fee existed) still default to 10x the daily rate.
-- Mirrors replacementValueFor and replacementValueError in src/lib/data/listings.ts.

alter table public.listings drop constraint listings_replacement_value_range;
alter table public.listings add constraint listings_replacement_value_range check (
  replacement_value is null or replacement_value > price_per_day
);

create or replace function public.replacement_value_for(listing public.listings)
returns numeric
language sql immutable
as $$
  select coalesce(listing.sale_price, listing.replacement_value, listing.price_per_day * 10);
$$;
