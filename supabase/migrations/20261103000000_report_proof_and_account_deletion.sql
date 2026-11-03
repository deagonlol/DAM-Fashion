-- Reports can include photo proof and point at one chat message. People can delete their account.

-- ---------------------------------------------------------------------------
-- Report photos and message reports
-- ---------------------------------------------------------------------------
alter table public.reports
  add column photo_paths text[] not null default '{}',
  add column message_id uuid references public.messages on delete set null,
  add column message_text text,
  add constraint reports_photo_limit check (cardinality(photo_paths) <= 4);

grant insert (photo_paths, message_id) on public.reports to authenticated;

-- The reported message's text is copied from the chat, so the team sees exactly what was sent.
-- Photos must sit in the reporter's own folder of the report-photos bucket.
create function public.prepare_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  reported_message public.messages;
begin
  new.message_text := null;
  if new.message_id is not null then
    select m.* into reported_message
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = new.message_id
      and m.sender_id = new.reported_user_id
      and new.reporter_id in (c.borrower_id, c.owner_id);
    if reported_message.id is null then
      raise exception 'Message not found.';
    end if;
    new.message_text := reported_message.text;
    new.conversation_id := reported_message.conversation_id;
  end if;
  if exists (
    select 1 from unnest(new.photo_paths) path
    where split_part(path, '/', 1) <> new.reporter_id::text
  ) then
    raise exception 'Photos must be uploaded by the person reporting.';
  end if;
  return new;
end;
$$;

create trigger reports_prepare before insert on public.reports
  for each row execute function public.prepare_report();

-- Private bucket: reporters upload to their own folder, and only they and the team can view.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "report photos: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "report photos: reporter and team can view" on storage.objects for select to authenticated
  using (
    bucket_id = 'report-photos'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- Used when someone deletes their account (their reports are deleted with it).
create policy "report photos: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'report-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
-- Deleting the auth user cascades to the profile and everything that belongs to it. Photos in
-- storage are removed by the app first, since storage files can't be deleted from SQL.
create function public.delete_account()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.';
  end if;
  if exists (
    select 1 from public.rentals
    where auth.uid() in (borrower_id, lender_id) and status in ('accepted', 'picked_up')
  ) then
    raise exception 'You have an upcoming or active borrow. Finish or cancel it before deleting your account.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
