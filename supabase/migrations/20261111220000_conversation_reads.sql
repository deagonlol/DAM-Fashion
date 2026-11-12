-- Unread messages: when each person last read each chat. Messages from the other person after
-- that time count as unread (a dot on the chat and a count on the Inbox tab).

create table public.conversation_reads (
  user_id uuid not null references public.profiles on delete cascade,
  conversation_id uuid not null references public.conversations on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.conversation_reads enable row level security;

create policy "conversation reads: read own" on public.conversation_reads for select to authenticated
  using (user_id = auth.uid());
create policy "conversation reads: add own" on public.conversation_reads for insert to authenticated
  with check (user_id = auth.uid() and public.is_conversation_member(conversation_id::text));
create policy "conversation reads: update own" on public.conversation_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select on public.conversation_reads to authenticated;
grant insert (user_id, conversation_id, last_read_at) on public.conversation_reads to authenticated;
grant update (last_read_at) on public.conversation_reads to authenticated;

-- Existing chats start out read, so nobody sees their old history as new.
insert into public.conversation_reads (user_id, conversation_id, last_read_at)
select member.id, c.id, now()
from public.conversations c
cross join lateral (values (c.borrower_id), (c.owner_id)) as member(id)
on conflict do nothing;
