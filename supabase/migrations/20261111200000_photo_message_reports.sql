-- Reporting a photo-only chat message: the report shows "[Photo]" instead of an empty quote, and
-- the team opens the chat to see the photo. Same as prepare_report in
-- 20261103000000_report_proof_and_account_deletion.sql, plus that fallback.
create or replace function public.prepare_report()
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
    new.message_text := case
      when reported_message.image_path is not null and reported_message.text = '' then '[Photo]'
      when reported_message.image_path is not null then '[Photo] ' || reported_message.text
      else reported_message.text
    end;
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
