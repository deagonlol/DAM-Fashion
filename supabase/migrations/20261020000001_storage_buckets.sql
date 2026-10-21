-- DAM Fashion: photo storage.
-- Two public buckets: anyone can view a photo by its URL (needed to show listings and avatars),
-- but signed-in users can only upload, replace, or delete files inside their own folder:
--   listing-photos/<user id>/<listing id>/<file>
--   avatars/<user id>/<file>
-- Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-photos', 'listing-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
  ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "photos: read own folder" on storage.objects;
drop policy if exists "photos: upload to own folder" on storage.objects;
drop policy if exists "photos: replace in own folder" on storage.objects;
drop policy if exists "photos: delete from own folder" on storage.objects;

-- Public URLs work without a read policy. This one lets the app list and overwrite its own files.
create policy "photos: read own folder" on storage.objects for select to authenticated
  using (
    bucket_id in ('listing-photos', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('listing-photos', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: replace in own folder" on storage.objects for update to authenticated
  using (
    bucket_id in ('listing-photos', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id in ('listing-photos', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "photos: delete from own folder" on storage.objects for delete to authenticated
  using (
    bucket_id in ('listing-photos', 'avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
