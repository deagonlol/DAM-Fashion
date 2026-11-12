-- Photos in chat, and condition photos at pickup and return. Both live in private buckets:
-- only the two people involved (and the moderation team) can see them.

-- ---------------------------------------------------------------------------
-- Photos in chat
-- ---------------------------------------------------------------------------
-- A message can be a photo, with or without text. The photo sits at
-- chat-photos/<conversation id>/<sender id>/<file>.
alter table public.messages
  add column image_path text,
  drop constraint messages_text_check,
  add constraint messages_text_check check (char_length(text) <= 2000),
  add constraint messages_not_empty check (char_length(text) > 0 or image_path is not null);

grant insert (image_path) on public.messages to authenticated;

create function public.check_message_photo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.image_path is not null
    and (split_part(new.image_path, '/', 1) <> new.conversation_id::text
      or split_part(new.image_path, '/', 2) <> new.sender_id::text) then
    raise exception 'That photo doesn''t belong to this chat.';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_message_photo() from public, anon, authenticated;

create trigger messages_check_photo before insert on public.messages
  for each row execute function public.check_message_photo();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-photos', 'chat-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function public.is_conversation_member(conversation_text text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversations c
    where c.id::text = conversation_text and auth.uid() in (c.borrower_id, c.owner_id)
  );
$$;

create policy "chat photos: members upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-photos'
    and public.is_conversation_member((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "chat photos: members and team can view" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-photos'
    and (public.is_conversation_member((storage.foldername(name))[1]) or public.is_admin())
  );

create policy "chat photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-photos' and (storage.foldername(name))[2] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Condition photos at pickup and return
-- ---------------------------------------------------------------------------
-- Either person can add up to 4 photos at each handoff, at
-- rental-photos/<rental id>/<uploader id>/<file>.
create table public.rental_photos (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals on delete cascade,
  uploader_id uuid not null references public.profiles on delete cascade,
  stage text not null check (stage in ('pickup', 'return')),
  path text not null,
  created_at timestamptz not null default now()
);
create index rental_photos_rental_idx on public.rental_photos (rental_id);

alter table public.rental_photos enable row level security;

create function public.is_rental_member(rental_text text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.rentals r
    where r.id::text = rental_text and auth.uid() in (r.borrower_id, r.lender_id)
  );
$$;

create policy "rental photos: members and team can view" on public.rental_photos for select to authenticated
  using (public.is_rental_member(rental_id::text) or public.is_admin());

create policy "rental photos: members add their own" on public.rental_photos for insert to authenticated
  with check (uploader_id = auth.uid() and public.is_rental_member(rental_id::text));

grant select on public.rental_photos to authenticated;
alter publication supabase_realtime add table public.rental_photos;
grant insert (rental_id, uploader_id, stage, path) on public.rental_photos to authenticated;

-- Pickup photos while the handoff is happening or just after; return photos likewise. Four each.
create function public.check_rental_photo()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rental public.rentals;
begin
  select * into rental from public.rentals where id = new.rental_id;
  if new.stage = 'pickup' and rental.status not in ('accepted', 'picked_up') then
    raise exception 'Pickup photos can be added around pickup.';
  end if;
  if new.stage = 'return' and rental.status not in ('picked_up', 'returned') then
    raise exception 'Return photos can be added around the return.';
  end if;
  if split_part(new.path, '/', 1) <> new.rental_id::text or split_part(new.path, '/', 2) <> new.uploader_id::text then
    raise exception 'That photo doesn''t belong to this borrow.';
  end if;
  if (
    select count(*) from public.rental_photos
    where rental_id = new.rental_id and uploader_id = new.uploader_id and stage = new.stage
  ) >= 4 then
    raise exception 'You can add up to 4 photos at each handoff.';
  end if;
  return new;
end;
$$;

revoke execute on function public.check_rental_photo() from public, anon, authenticated;

create trigger rental_photos_check before insert on public.rental_photos
  for each row execute function public.check_rental_photo();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-photos', 'rental-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "rental photos: members upload to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rental-photos'
    and public.is_rental_member((storage.foldername(name))[1])
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "rental photos: members and team can view files" on storage.objects for select to authenticated
  using (
    bucket_id = 'rental-photos'
    and (public.is_rental_member((storage.foldername(name))[1]) or public.is_admin())
  );

create policy "rental photos: delete own files" on storage.objects for delete to authenticated
  using (bucket_id = 'rental-photos' and (storage.foldername(name))[2] = auth.uid()::text);

revoke execute on function public.is_conversation_member(text), public.is_rental_member(text) from public, anon;
grant execute on function public.is_conversation_member(text), public.is_rental_member(text) to authenticated;
