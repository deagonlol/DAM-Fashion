-- Lendr: photo search with TinyCLIP.
-- Every listing photo gets a TinyCLIP image embedding (see tinyclip-space/). Photo search embeds the
-- user's photo and finds the closest listings here. Only the TinyCLIP service (service role) reads or
-- writes these tables; the app talks to the service, never to this table directly.
--
-- After running this, store the service's address and shared secret in Vault so new and edited listings
-- get indexed automatically (SQL Editor; replace the values):
--   select vault.create_secret('https://<service>.onrender.com', 'tinyclip_url');
--   select vault.create_secret('<long random string, same as INDEX_SECRET on the service>', 'tinyclip_index_secret');
-- Without them the trigger does nothing, and tinyclip-space/backfill.py can index listings instead.

create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.listing_photo_embeddings (
  listing_id uuid not null references public.listings on delete cascade,
  image_uri text not null,
  embedding extensions.vector(512) not null,
  model text not null,
  updated_at timestamptz not null default now(),
  primary key (listing_id, image_uri)
);

create index if not exists listing_photo_embeddings_embedding_idx
  on public.listing_photo_embeddings using hnsw (embedding extensions.vector_cosine_ops);

-- No policies: clients can't read or write it. The service role bypasses RLS.
alter table public.listing_photo_embeddings enable row level security;

-- Closest listings to a photo. A listing can have up to six photos; its best photo counts.
-- Leaves out paused, sold and deleted listings. The app also hides blocked and restricted owners.
create or replace function public.match_listing_photos(query_embedding extensions.vector(512), match_count int default 30)
returns table (listing_id uuid, similarity double precision)
language sql stable
set search_path = public, extensions
as $$
  select e.listing_id, max(1 - (e.embedding <=> query_embedding)) as similarity
  from public.listing_photo_embeddings e
  join public.listings l on l.id = e.listing_id
  where not l.paused and l.sold_at is null and l.deleted_at is null
  group by e.listing_id
  order by similarity desc
  limit least(greatest(match_count, 1), 100);
$$;

revoke execute on function public.match_listing_photos(extensions.vector, int) from public, anon, authenticated;
grant execute on function public.match_listing_photos(extensions.vector, int) to service_role;

-- Asks the TinyCLIP service to (re)index a listing whenever its photos change.
create or replace function public.request_listing_photo_index()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  service_url text;
  index_secret text;
begin
  select decrypted_secret into service_url from vault.decrypted_secrets where name = 'tinyclip_url';
  select decrypted_secret into index_secret from vault.decrypted_secrets where name = 'tinyclip_index_secret';
  if service_url is null or index_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := rtrim(service_url, '/') || '/index/' || new.id,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-index-secret', index_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  return new;
end;
$$;

revoke execute on function public.request_listing_photo_index() from public, anon, authenticated;

drop trigger if exists listings_request_photo_index on public.listings;
create trigger listings_request_photo_index
  after insert or update of image_uris on public.listings
  for each row
  when (cardinality(new.image_uris) > 0)
  execute function public.request_listing_photo_index();
