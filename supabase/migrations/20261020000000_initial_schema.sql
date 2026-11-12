-- Lendr: initial schema.
-- Mirrors src/lib/data/types.ts. Columns are snake_case; the data layer maps them to camelCase.
--
-- Security model:
--   * Every table has row-level security (RLS) on. Only signed-in users ("authenticated") get any
--     access, and only to the rows and columns the policies below allow. Signed-out ("anon") gets none.
--   * Rental status changes (accept, pickup, return, no-show...) are NOT direct updates. They will be
--     database functions that re-check the rules in src/lib/data/rentals.ts, added when rentals move over.

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). Email stays in auth.users so it's never public.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  role text check (role in ('admin')),
  created_at timestamptz not null default now()
);

-- Helper for policies. security definer so it can read profiles regardless of the caller's RLS.
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  title text not null,
  description text not null default '',
  category text not null check (category in (
    'Tops', 'Bottoms', 'Dresses', 'Suits & Blazers', 'Outerwear', 'Shoes', 'Accessories', 'Costumes'
  )),
  events text[] not null default '{}' check (events <@ array[
    'Game Day', 'Professional', 'Formal', 'Semi-Formal', 'Halloween', 'Themed Party',
    'Concert & Festival', 'Western', 'Graduation'
  ]),
  size text not null check (size in ('XS', 'S', 'M', 'L', 'XL', 'XXL')),
  price_per_day numeric(8, 2) not null check (price_per_day >= 0),
  image_uris text[] not null default '{}' check (cardinality(image_uris) <= 6),
  paused boolean not null default false,
  blocked_dates date[] not null default '{}',
  created_at timestamptz not null default now()
);
create index listings_owner_id_idx on public.listings (owner_id);
create index listings_created_at_idx on public.listings (created_at desc);

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  borrower_id uuid not null references public.profiles on delete cascade,
  owner_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, borrower_id),
  check (borrower_id <> owner_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations on delete cascade,
  sender_id uuid not null references public.profiles on delete cascade,
  text text not null check (char_length(text) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Rentals (borrows)
-- ---------------------------------------------------------------------------
create table public.rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings on delete cascade,
  borrower_id uuid not null references public.profiles on delete cascade,
  lender_id uuid not null references public.profiles on delete cascade,
  start_date date not null,
  end_date date not null,
  pickup_spot text not null check (pickup_spot in (
    'Texas Union', 'PCL (Perry-Castañeda Library)', 'Gregory Gym', 'Jester Center',
    'Speedway Plaza', 'West Campus (Guadalupe & 24th)'
  )),
  status text not null default 'requested' check (status in (
    'requested', 'accepted', 'declined', 'cancelled', 'picked_up', 'returned', 'no_show'
  )),
  created_at timestamptz not null default now(),
  picked_up_at timestamptz,
  returned_at timestamptz,
  returned_late boolean,
  condition_issue text,
  no_show_reported_by uuid references public.profiles,
  check (borrower_id <> lender_id),
  check (end_date >= start_date and end_date - start_date < 14)
);
create index rentals_listing_idx on public.rentals (listing_id);
create index rentals_borrower_idx on public.rentals (borrower_id);
create index rentals_lender_idx on public.rentals (lender_id);

-- Handoff codes live in their own table so each person can only read the code they show:
-- the lender holds the pickup code, the borrower holds the return code.
create table public.rental_codes (
  rental_id uuid not null references public.rentals on delete cascade,
  kind text not null check (kind in ('pickup', 'return')),
  holder_id uuid not null references public.profiles on delete cascade,
  code text not null,
  primary key (rental_id, kind)
);

-- Booked date ranges for a listing's availability calendar, without exposing who borrowed it.
create function public.booked_ranges(target_listing_id uuid)
returns table (start_date date, end_date date)
language sql stable security definer set search_path = ''
as $$
  select r.start_date, r.end_date
  from public.rentals r
  where r.listing_id = target_listing_id and r.status in ('accepted', 'picked_up');
$$;

-- ---------------------------------------------------------------------------
-- Reviews (double-blind)
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  rental_id uuid not null references public.rentals on delete cascade,
  reviewer_id uuid not null references public.profiles on delete cascade,
  reviewee_id uuid not null references public.profiles on delete cascade,
  reviewee_role text not null check (reviewee_role in ('lender', 'borrower')),
  rating smallint not null check (rating between 1 and 5),
  tags text[] not null default '{}',
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  reply_text text check (char_length(reply_text) <= 300),
  reply_created_at timestamptz,
  unique (rental_id, reviewer_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id);

-- Matches isReviewVisible in src/lib/data/reviews.ts: visible once the reviewee has reviewed the
-- same borrow, or 14 days after the return. security definer avoids RLS recursion on reviews.
create function public.is_review_visible(review_rental_id uuid, review_reviewee_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reviews r
    where r.rental_id = review_rental_id and r.reviewer_id = review_reviewee_id
  ) or exists (
    select 1 from public.rentals x
    where x.id = review_rental_id and x.returned_at + interval '14 days' < now()
  );
$$;

-- ---------------------------------------------------------------------------
-- Saves, reports, blocks
-- ---------------------------------------------------------------------------
create table public.saves (
  user_id uuid not null references public.profiles on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index saves_listing_idx on public.saves (listing_id);

-- Heart counts per listing, without revealing who saved what.
create function public.save_counts()
returns table (listing_id uuid, count bigint)
language sql stable security definer set search_path = ''
as $$
  select s.listing_id, count(*) from public.saves s group by s.listing_id;
$$;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles on delete cascade,
  reported_user_id uuid not null references public.profiles on delete cascade,
  reason text not null check (reason in (
    'No-show', 'Harassment or threats', 'Scam or payment issue', 'Inappropriate messages',
    'Item not as described', 'Damaged or kept an item', 'Something else'
  )),
  details text not null default '' check (char_length(details) <= 1000),
  conversation_id uuid references public.conversations on delete set null,
  rental_id uuid references public.rentals on delete set null,
  listing_id uuid references public.listings on delete set null,
  created_at timestamptz not null default now(),
  status text not null default 'open' check (status in ('open', 'upheld', 'dismissed')),
  reviewed_at timestamptz,
  check (reporter_id <> reported_user_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles on delete cascade,
  blocked_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_codes enable row level security;
alter table public.reviews enable row level security;
alter table public.saves enable row level security;
alter table public.reports enable row level security;
alter table public.blocks enable row level security;

-- Profiles: anyone signed in can view; you can edit your own name, bio, and photo (not role).
create policy "profiles: read" on public.profiles for select to authenticated using (true);
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Listings: paused ones are only visible to their owner. Owners manage their own.
create policy "listings: read" on public.listings for select to authenticated
  using (not paused or owner_id = auth.uid());
create policy "listings: insert own" on public.listings for insert to authenticated
  with check (owner_id = auth.uid());
create policy "listings: update own" on public.listings for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "listings: delete own" on public.listings for delete to authenticated
  using (owner_id = auth.uid());

-- Conversations: only the two people in them. The owner must really own the listing.
create policy "conversations: read own" on public.conversations for select to authenticated
  using (auth.uid() in (borrower_id, owner_id));
create policy "conversations: start" on public.conversations for insert to authenticated
  with check (
    auth.uid() in (borrower_id, owner_id)
    and exists (
      select 1 from public.listings l
      where l.id = conversations.listing_id and l.owner_id = conversations.owner_id
    )
  );

-- Messages: read and send only in your own conversations, as yourself.
create policy "messages: read own" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id and auth.uid() in (c.borrower_id, c.owner_id)
  ));
create policy "messages: send" on public.messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() in (c.borrower_id, c.owner_id)
    )
  );

-- Rentals: the borrower and lender can see theirs. Borrowers can request an unpaused listing
-- from its real owner. No update policy: status changes go through database functions.
create policy "rentals: read own" on public.rentals for select to authenticated
  using (auth.uid() in (borrower_id, lender_id));
create policy "rentals: request" on public.rentals for insert to authenticated
  with check (
    borrower_id = auth.uid()
    and status = 'requested'
    and exists (
      select 1 from public.listings l
      where l.id = rentals.listing_id and l.owner_id = rentals.lender_id and not l.paused
    )
  );

-- Rental codes: you can only read a code you hold. Written by database functions only.
create policy "rental_codes: read held" on public.rental_codes for select to authenticated
  using (holder_id = auth.uid());

-- Reviews: you always see your own; others see them once they're visible. You can review the
-- other person on a returned borrow within 14 days, and reply once to a review about you.
create policy "reviews: read" on public.reviews for select to authenticated
  using (reviewer_id = auth.uid() or public.is_review_visible(rental_id, reviewee_id));
create policy "reviews: write" on public.reviews for insert to authenticated
  with check (
    reviewer_id = auth.uid()
    and exists (
      select 1 from public.rentals r
      where r.id = rental_id
        and r.status = 'returned'
        and r.returned_at + interval '14 days' > now()
        and (
          (r.borrower_id = auth.uid() and reviewee_id = r.lender_id and reviewee_role = 'lender')
          or (r.lender_id = auth.uid() and reviewee_id = r.borrower_id and reviewee_role = 'borrower')
        )
    )
  );
create policy "reviews: reply once" on public.reviews for update to authenticated
  using (
    reviewee_id = auth.uid()
    and reply_text is null
    and public.is_review_visible(rental_id, reviewee_id)
  )
  with check (reviewee_id = auth.uid());

-- Saves: private to you. Heart counts come from save_counts().
create policy "saves: read own" on public.saves for select to authenticated
  using (user_id = auth.uid());
create policy "saves: add own" on public.saves for insert to authenticated
  with check (user_id = auth.uid());
create policy "saves: remove own" on public.saves for delete to authenticated
  using (user_id = auth.uid());

-- Reports: file as yourself; you see your own; the team sees and resolves all.
create policy "reports: file" on public.reports for insert to authenticated
  with check (reporter_id = auth.uid() and status = 'open');
create policy "reports: read" on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy "reports: resolve" on public.reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Blocks: yours only.
create policy "blocks: read own" on public.blocks for select to authenticated
  using (blocker_id = auth.uid());
create policy "blocks: add own" on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid());
create policy "blocks: remove own" on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Grants. Start from nothing, then allow only what the app uses. Column lists keep people
-- from editing fields like profiles.role or a review's rating after the fact.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, public;

grant select on public.profiles to authenticated;
grant update (name, bio, avatar_url) on public.profiles to authenticated;

grant select, delete on public.listings to authenticated;
grant insert (owner_id, title, description, category, events, size, price_per_day, image_uris)
  on public.listings to authenticated;
grant update (title, description, category, events, size, price_per_day, image_uris, paused, blocked_dates)
  on public.listings to authenticated;

grant select on public.conversations to authenticated;
grant insert (listing_id, borrower_id, owner_id) on public.conversations to authenticated;

grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, text) on public.messages to authenticated;

grant select on public.rentals to authenticated;
grant insert (listing_id, borrower_id, lender_id, start_date, end_date, pickup_spot)
  on public.rentals to authenticated;

grant select on public.rental_codes to authenticated;

grant select on public.reviews to authenticated;
grant insert (rental_id, reviewer_id, reviewee_id, reviewee_role, rating, tags, comment)
  on public.reviews to authenticated;
grant update (reply_text, reply_created_at) on public.reviews to authenticated;

grant select, insert, delete on public.saves to authenticated;

grant select on public.reports to authenticated;
grant insert (reporter_id, reported_user_id, reason, details, conversation_id, rental_id, listing_id)
  on public.reports to authenticated;
grant update (status, reviewed_at) on public.reports to authenticated;

grant select, insert, delete on public.blocks to authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.booked_ranges(uuid) to authenticated;
grant execute on function public.is_review_visible(uuid, uuid) to authenticated;
grant execute on function public.save_counts() to authenticated;

-- Live chat: stream new messages to the app (RLS still applies).
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- Step 5: sign-up rules. Runs after Supabase creates the auth user, in the same transaction,
-- so raising an exception cancels the sign-up. Matches isUtexasEmail in src/lib/data/auth.ts.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.email, '') !~* '^[^\s@]+@utexas\.edu$' then
    raise exception 'DAM Fashion is only for UT students. Use your @utexas.edu email.';
  end if;

  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
