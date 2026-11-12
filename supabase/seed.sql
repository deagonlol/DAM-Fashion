-- Lendr: test data. Run after the migrations, in the SQL Editor. Safe to re-run.
--
-- Every test account signs in with the password: damfashion
--   alex.damtest@utexas.edu    sample user with activity in every state
--   ronit.damtest@utexas.edu   gameday lender
--   maya.damtest@utexas.edu    trusted lender (formals, boots)
--   jordan.damtest@utexas.edu  two recent no-shows, so soft-banned
--   admin.damtest@utexas.edu   Lendr team: reviews reports
--   priya / marcus / sofia / ethan / chloe .damtest@utexas.edu
--
-- Delete these accounts before launch (Authentication > Users), since the password is public.
--
-- Ids are derived from short names (u1, l1, r1...) so rows can refer to each other.

create function pg_temp.sid(short_name text) returns uuid
language sql immutable as $$ select md5('dam-seed-' || short_name)::uuid $$;

create function pg_temp.img(seed text) returns text
language sql immutable as $$ select 'https://picsum.photos/seed/' || seed || '/600/800' $$;

-- ---------------------------------------------------------------------------
-- Accounts. Inserting into auth.users fires handle_new_user, which creates each profile.
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', pg_temp.sid(u.short_name), 'authenticated', 'authenticated',
  u.email, extensions.crypt('damfashion', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('name', u.name), now(), now(),
  '', '', '', ''
from (values
  ('u1', 'Alex Kim', 'alex.damtest@utexas.edu'),
  ('u2', 'Ronit S.', 'ronit.damtest@utexas.edu'),
  ('u3', 'Maya L.', 'maya.damtest@utexas.edu'),
  ('u4', 'Jordan P.', 'jordan.damtest@utexas.edu'),
  ('u5', 'Lendr Team', 'admin.damtest@utexas.edu'),
  ('u6', 'Priya Patel', 'priya.damtest@utexas.edu'),
  ('u7', 'Marcus J.', 'marcus.damtest@utexas.edu'),
  ('u8', 'Sofia Hernandez', 'sofia.damtest@utexas.edu'),
  ('u9', 'Ethan Nguyen', 'ethan.damtest@utexas.edu'),
  ('u10', 'Chloe D.', 'chloe.damtest@utexas.edu')
) as u(short_name, name, email)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%.damtest@utexas.edu'
on conflict (provider_id, provider) do nothing;

update public.profiles p set
  bio = v.bio,
  avatar_url = v.avatar_url,
  role = v.role,
  created_at = v.joined::timestamptz
from (values
  ('u1', 'Business junior. Mostly professional stuff and the occasional costume.', null, null, '2026-08-20'),
  ('u2', 'Never miss a home game. Happy to lend gameday fits.', 'https://i.pravatar.cc/200?img=12', null, '2026-01-15'),
  ('u3', 'Formals, festivals, and boots. Pickups near Jester.', 'https://i.pravatar.cc/200?img=47', null, '2025-09-02'),
  ('u4', '', null, null, '2026-07-01'),
  ('u5', 'The Lendr team.', null, 'admin', '2025-08-01'),
  ('u6', 'Plan II sophomore. Dresses and little accessories.', 'https://i.pravatar.cc/200?img=45', null, '2026-02-10'),
  ('u7', 'McCombs senior. Suits for every career fair.', 'https://i.pravatar.cc/200?img=53', null, '2025-10-05'),
  ('u8', 'Gowns and western wear. West Campus pickups.', 'https://i.pravatar.cc/200?img=32', null, '2025-11-20'),
  ('u9', 'Costume guy. If it''s themed, I have it.', 'https://i.pravatar.cc/200?img=59', null, '2026-03-03'),
  ('u10', 'Graduating in May! Clearing out my closet one borrow at a time.', 'https://i.pravatar.cc/200?img=25', null, '2025-08-28')
) as v(short_name, bio, avatar_url, role, joined)
where p.id = pg_temp.sid(v.short_name);

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------
insert into public.listings (id, owner_id, title, description, category, events, size, price_per_day, image_uris, paused, created_at)
select pg_temp.sid(l.short_name), pg_temp.sid(l.owner), l.title, l.description, l.category, l.events, l.size, l.price,
       array[pg_temp.img(l.photo), pg_temp.img(l.photo || '-back'), pg_temp.img(l.photo || '-detail')],
       l.paused, now() - make_interval(days => l.age_days)
from (values
  ('l1', 'u2', 'Burnt orange gameday polo', 'Worn twice. Perfect for a home game at DKR.', 'Tops', array['Game Day'], 'M', 5, 'polo', false, 19),
  ('l2', 'u3', 'Black satin formal dress', 'Floor length, great for formals and galas.', 'Dresses', array['Formal', 'Semi-Formal'], 'S', 15, 'dress', false, 18),
  ('l3', 'u2', 'Navy blazer', 'Slim fit. Good for career fair or interviews.', 'Suits & Blazers', array['Professional', 'Formal'], 'L', 10, 'blazer', false, 17),
  ('l4', 'u3', 'White cowboy boots', 'Size 8 women''s. Western-themed events, ACL, rodeo.', 'Shoes', array['Western', 'Concert & Festival'], 'M', 8, 'boots', false, 16),
  ('l5', 'u1', 'Khaki chinos', 'Business casual staple.', 'Bottoms', array['Professional'], 'M', 4, 'chinos', false, 15),
  ('l6', 'u2', 'Longhorns denim jacket', 'Embroidered back patch.', 'Outerwear', array['Game Day', 'Concert & Festival'], 'XL', 7, 'denim', false, 14),
  ('l7', 'u3', 'Gold statement earrings', 'Lightweight, pairs with anything formal.', 'Accessories', array['Formal', 'Semi-Formal', 'Graduation'], 'M', 3, 'earrings', false, 13),
  ('l8', 'u1', 'Halloween costume cape', 'Red velvet cape, one size fits most.', 'Costumes', array['Halloween', 'Themed Party'], 'L', 6, 'cape', false, 12),
  ('l9', 'u4', 'Grey suit jacket', 'Two-button, good for interviews.', 'Suits & Blazers', array['Professional'], 'M', 9, 'suit', false, 11),
  ('l10', 'u6', 'Emerald silk slip dress', 'Bias cut, hits mid-calf. Dry clean only.', 'Dresses', array['Semi-Formal', 'Formal'], 'XS', 14, 'emerald', false, 10),
  ('l11', 'u6', 'Silver sequin mini skirt', 'Catches every light at a party.', 'Bottoms', array['Themed Party', 'Concert & Festival'], 'S', 6, 'sequin', false, 9),
  ('l12', 'u6', 'Pearl hair clip set', 'Set of four. Cute for grad photos.', 'Accessories', array['Graduation', 'Semi-Formal'], 'M', 2, 'pearls', false, 9),
  ('l13', 'u7', 'Charcoal two-piece suit', '40R jacket, 32x32 pants. Tailored last spring.', 'Suits & Blazers', array['Professional', 'Formal', 'Graduation'], 'L', 18, 'charcoal', false, 8),
  ('l14', 'u7', 'Burnt orange overalls', 'Loud, comfy, and very gameday.', 'Bottoms', array['Game Day'], 'L', 6, 'overalls', false, 8),
  ('l15', 'u7', 'Brown leather dress shoes', 'Men''s size 10. Polished and ready.', 'Shoes', array['Professional', 'Formal'], 'L', 7, 'oxfords', false, 7),
  ('l16', 'u8', 'Red off-shoulder gown', 'Floor length with a slit. Showstopper for formals.', 'Dresses', array['Formal'], 'M', 20, 'gown', false, 7),
  ('l17', 'u8', 'Fringe suede jacket', 'Tan suede with long fringe. ACL essential.', 'Outerwear', array['Western', 'Concert & Festival'], 'S', 9, 'fringe', false, 6),
  ('l18', 'u8', 'Cowgirl hat', 'Cream felt, adjustable band.', 'Accessories', array['Western', 'Concert & Festival', 'Game Day'], 'M', 4, 'hat', false, 6),
  ('l19', 'u9', 'Flight suit costume', 'Aviators and name patch included.', 'Costumes', array['Halloween', 'Themed Party'], 'L', 10, 'flightsuit', false, 5),
  ('l20', 'u9', 'White oxford button-down', 'Crisp, ironed, interview-ready.', 'Tops', array['Professional', 'Graduation'], 'M', 3, 'oxford', false, 5),
  ('l21', 'u9', 'Longhorns windbreaker', 'Vintage 90s pullover. Great for rainy games.', 'Outerwear', array['Game Day'], 'XL', 5, 'windbreaker', false, 4),
  ('l22', 'u10', 'Lilac satin midi dress', 'Square neck, adjustable straps.', 'Dresses', array['Semi-Formal', 'Graduation'], 'S', 12, 'lilac', false, 4),
  ('l23', 'u10', 'Black tailored trousers', 'High waisted, wide leg. Works for any interview.', 'Bottoms', array['Professional'], 'S', 5, 'trousers', false, 3),
  ('l24', 'u10', 'Rhinestone heels', 'Women''s size 7. Block heel, easy to dance in.', 'Shoes', array['Formal', 'Semi-Formal'], 'S', 8, 'heels', false, 3),
  ('l25', 'u10', 'Angel wings costume', 'Feathered wings plus halo headband.', 'Costumes', array['Halloween', 'Themed Party'], 'M', 7, 'wings', false, 2),
  ('l26', 'u3', 'Denim cutoff shorts', 'High rise, light wash.', 'Bottoms', array['Concert & Festival', 'Game Day'], 'S', 3, 'cutoffs', false, 2),
  ('l27', 'u2', 'Orange and white rugby shirt', 'Heavy cotton, striped. Classic gameday.', 'Tops', array['Game Day'], 'L', 5, 'rugby', false, 1),
  ('l28', 'u6', 'Cream cable-knit sweater', 'Paused while I''m wearing it this month.', 'Tops', array['Themed Party'], 'M', 4, 'sweater', true, 1),
  ('l29', 'u1', 'Black bow tie and pocket square', 'Silk. Elevates any suit.', 'Accessories', array['Formal', 'Graduation'], 'M', 2, 'bowtie', false, 1),
  ('l30', 'u8', 'Burgundy velvet blazer', 'Statement piece for formals and themed parties.', 'Suits & Blazers', array['Formal', 'Themed Party'], 'M', 11, 'velvet', false, 0)
) as l(short_name, owner, title, description, category, events, size, price, photo, paused, age_days)
on conflict (id) do nothing;

-- Alex's cape can be bought as well as borrowed. Higher than the $6 daily rate.
update public.listings l
set sale_price = p.price
from (values ('l8', 40), ('l16', 120), ('l13', 150)) as p(short_name, price)
where l.id = pg_temp.sid(p.short_name);

-- Brands, and the pickup spots Maya (near Jester) and Sofia (West Campus) prefer.
-- Needs 20261103120000_brand_and_pickup_spots.sql. Only fills in listings that don't have them yet.
update public.listings l
set brand = b.brand
from (values
    ('l1', 'Nike'),
    ('l2', 'Lulus'),
    ('l3', 'J.Crew'),
    ('l4', 'Ariat'),
    ('l5', 'Dockers'),
    ('l6', 'Levi''s'),
    ('l7', 'BaubleBar'),
    ('l8', 'Party City'),
    ('l9', 'Banana Republic'),
    ('l10', 'Reformation'),
    ('l11', 'Free People'),
    ('l12', 'Kitsch'),
    ('l13', 'Suitsupply'),
    ('l14', 'Dickies'),
    ('l15', 'Cole Haan'),
    ('l16', 'Windsor'),
    ('l17', 'Urban Outfitters'),
    ('l18', 'Stetson'),
    ('l19', 'Spirit Halloween'),
    ('l20', 'Brooks Brothers'),
    ('l21', 'Champion'),
    ('l22', 'Abercrombie'),
    ('l23', 'Zara'),
    ('l24', 'Steve Madden'),
    ('l25', 'Spirit Halloween'),
    ('l26', 'Levi''s'),
    ('l27', 'Barbarian'),
    ('l28', 'Madewell'),
    ('l29', 'The Tie Bar'),
    ('l30', 'H&M')
) as b(short_name, brand)
where l.id = md5('dam-seed-' || b.short_name)::uuid and l.brand = '';

update public.listings
set pickup_spots = array['Jester Center', 'PCL (Perry-Castañeda Library)']
where owner_id = md5('dam-seed-u3')::uuid and pickup_spots = '{}';

update public.listings
set pickup_spots = array['West Campus (Guadalupe & 24th)', 'Speedway Plaza']
where owner_id = md5('dam-seed-u8')::uuid and pickup_spots = '{}';

-- ---------------------------------------------------------------------------
-- Borrows. start/end are days from today; picked/returned are days from now.
-- ---------------------------------------------------------------------------
insert into public.rentals (
  id, listing_id, borrower_id, lender_id, start_date, end_date, pickup_spot, status,
  created_at, picked_up_at, returned_at, returned_late, no_show_reported_by, offered_price_per_day
)
select pg_temp.sid(r.short_name), pg_temp.sid(r.listing), pg_temp.sid(r.borrower), pg_temp.sid(r.lender),
       -- Austin's date, not the database's (UTC), which is a day ahead in the evening.
       public.austin_now()::date + r.start_day, public.austin_now()::date + r.end_day, r.spot, r.status,
       -- Requested a few days before pickup, but never in the future.
       now() + make_interval(days => least(r.start_day - 4, 0)) - interval '2 hours',
       case when r.picked_day is not null then now() + make_interval(days => r.picked_day) end,
       case when r.returned_day is not null then now() + make_interval(days => r.returned_day) end,
       case when r.status = 'returned' then false end,
       case when r.no_show_by is not null then pg_temp.sid(r.no_show_by) end,
       l.price_per_day
from public.listings l
join (values
  -- Alex (u1): finished borrows, a recent one waiting on reviews, one overdue, one upcoming, requests both ways.
  ('r1', 'l1', 'u1', 'u2', -38, -37, 'Jester Center', 'returned', -38, -37, null),
  ('r2', 'l3', 'u1', 'u2', -26, -25, 'Texas Union', 'returned', -26, -25, null),
  ('r4', 'l5', 'u3', 'u1', -20, -19, 'PCL (Perry-Castañeda Library)', 'returned', -20, -19, null),
  ('r3', 'l4', 'u1', 'u3', -12, -11, 'Jester Center', 'returned', -12, -10, null),
  ('r5', 'l1', 'u1', 'u2', -5, -4, 'Speedway Plaza', 'returned', -5, -4, null),
  ('r9', 'l7', 'u1', 'u3', -3, -1, 'Jester Center', 'picked_up', -3, null, null),
  ('r7', 'l6', 'u1', 'u2', 2, 3, 'Texas Union', 'accepted', null, null, null),
  ('r6', 'l8', 'u2', 'u1', 3, 4, 'Gregory Gym', 'requested', null, null, null),
  ('r10', 'l2', 'u1', 'u3', 5, 6, 'Jester Center', 'requested', null, null, null),
  ('r37', 'l13', 'u1', 'u7', -60, -59, 'Texas Union', 'returned', -60, -59, null),
  -- Maya (u3): long lending history, so she has the Trusted lender badge.
  ('r8', 'l2', 'u2', 'u3', -190, -189, 'Jester Center', 'returned', -190, -189, null),
  ('r11', 'l4', 'u2', 'u3', -230, -229, 'Jester Center', 'returned', -230, -229, null),
  ('r12', 'l7', 'u2', 'u3', -170, -170, 'Jester Center', 'returned', -170, -170, null),
  ('r13', 'l2', 'u1', 'u3', -45, -44, 'Jester Center', 'returned', -45, -44, null),
  -- Jordan (u4): two no-shows, so currently soft-banned.
  ('r20', 'l1', 'u4', 'u2', -30, -29, 'Gregory Gym', 'no_show', null, null, 'u2'),
  ('r21', 'l2', 'u4', 'u3', -3, -2, 'Jester Center', 'no_show', null, null, 'u3'),
  -- Everyone else.
  ('r30', 'l13', 'u6', 'u7', -20, -19, 'Texas Union', 'returned', -20, -19, null),
  ('r31', 'l16', 'u10', 'u8', -30, -29, 'West Campus (Guadalupe & 24th)', 'returned', -30, -29, null),
  ('r32', 'l22', 'u8', 'u10', -50, -49, 'Speedway Plaza', 'returned', -50, -49, null),
  ('r33', 'l13', 'u9', 'u7', -15, -14, 'Texas Union', 'returned', -15, -14, null),
  ('r34', 'l24', 'u6', 'u10', -1, 2, 'Speedway Plaza', 'picked_up', -1, null, null),
  ('r35', 'l19', 'u10', 'u9', 8, 10, 'Gregory Gym', 'accepted', null, null, null),
  ('r36', 'l3', 'u7', 'u2', 4, 5, 'Texas Union', 'requested', null, null, null),
  ('r38', 'l5', 'u9', 'u1', -25, -24, 'PCL (Perry-Castañeda Library)', 'returned', -25, -24, null),
  ('r39', 'l1', 'u8', 'u2', 6, 6, 'Gregory Gym', 'declined', null, null, null),
  ('r40', 'l8', 'u6', 'u1', 9, 10, 'Jester Center', 'cancelled', null, null, null),
  ('r41', 'l17', 'u2', 'u8', -70, -69, 'West Campus (Guadalupe & 24th)', 'returned', -70, -69, null),
  ('r42', 'l20', 'u3', 'u9', -45, -45, 'Texas Union', 'returned', -45, -45, null),
  -- A second open offer on Alex's cape, so the lender sees a choice. Price is raised just below.
  ('r43', 'l8', 'u6', 'u1', 3, 4, 'Texas Union', 'requested', null, null, null)
) as r(short_name, listing, borrower, lender, start_day, end_day, spot, status, picked_day, returned_day, no_show_by)
where l.id = pg_temp.sid(r.listing)
on conflict (id) do nothing;

update public.rentals
set offered_price_per_day = 9
where id = pg_temp.sid('r43');

-- Priya also wants to buy the cape, so Alex can accept a borrow or a sale.
insert into public.sales (id, listing_id, buyer_id, seller_id, price, status, created_at)
select pg_temp.sid('s1'), pg_temp.sid('l8'), pg_temp.sid('u6'), pg_temp.sid('u1'), 40, 'requested', now() - interval '1 hour'
where exists (select 1 from public.listings where id = pg_temp.sid('l8'))
on conflict (id) do nothing;

-- Handoff codes for accepted and in-progress borrows.
insert into public.rental_codes (rental_id, kind, holder_id, code)
select pg_temp.sid(c.rental), c.kind, pg_temp.sid(c.holder), c.code
from (values
  ('r9', 'pickup', 'u3', '5310'), ('r9', 'return', 'u1', '7724'),
  ('r7', 'pickup', 'u2', '4821'), ('r7', 'return', 'u1', '1937'),
  ('r34', 'pickup', 'u10', '6402'), ('r34', 'return', 'u6', '3158'),
  ('r35', 'pickup', 'u9', '8846'), ('r35', 'return', 'u10', '2290')
) as c(rental, kind, holder, code)
on conflict (rental_id, kind) do nothing;

-- ---------------------------------------------------------------------------
-- Reviews. Days are from now. r3 has only Maya's review, so it stays hidden until Alex reviews.
-- ---------------------------------------------------------------------------
insert into public.reviews (
  id, rental_id, reviewer_id, reviewee_id, reviewee_role, rating, tags, comment, created_at, reply_text, reply_created_at
)
select pg_temp.sid(v.short_name), pg_temp.sid(v.rental), pg_temp.sid(v.reviewer), pg_temp.sid(v.reviewee), v.role,
       v.rating, v.tags, v.comment, now() + make_interval(days => v.day),
       v.reply, case when v.reply is not null then now() + make_interval(days => v.day + 1) end
from (values
  ('rv1', 'r1', 'u1', 'u2', 'lender', 5, array['As described', 'Easy pickup'], 'Polo was perfect for the game!', -36, null),
  ('rv2', 'r1', 'u2', 'u1', 'borrower', 5, array['On time', 'Took good care'], 'Returned it washed. Would lend again.', -36, null),
  ('rv3', 'r2', 'u1', 'u2', 'lender', 4, array['Quick replies'], 'Blazer fit great, it was a little wrinkled though.', -24, 'Thanks! I''ll steam it before the next pickup.'),
  ('rv4', 'r2', 'u2', 'u1', 'borrower', 5, array['On time'], '', -24, null),
  ('rv5', 'r3', 'u3', 'u1', 'borrower', 4, array['Took good care'], 'Boots came back in great shape.', -9, null),
  ('rv6', 'r4', 'u3', 'u1', 'lender', 5, array['As described', 'Clean'], 'Chinos were spotless.', -18, null),
  ('rv7', 'r4', 'u1', 'u3', 'borrower', 5, array['On time'], 'Easy as it gets.', -18, null),
  ('rv8', 'r8', 'u2', 'u3', 'lender', 5, array['As described'], 'Gorgeous dress, got so many compliments.', -188, null),
  ('rv9', 'r8', 'u3', 'u2', 'borrower', 5, array['On time', 'Took good care'], '', -188, null),
  ('rv10', 'r11', 'u2', 'u3', 'lender', 5, array['Easy pickup', 'Quick replies'], 'Boots were broken in and comfy.', -228, null),
  ('rv11', 'r12', 'u2', 'u3', 'lender', 5, array['As described'], '', -168, null),
  ('rv12', 'r13', 'u1', 'u3', 'lender', 5, array['Clean', 'As described'], 'Felt like a brand new dress.', -43, null),
  ('rv13', 'r13', 'u3', 'u1', 'borrower', 5, array['On time'], '', -43, null),
  ('rv14', 'r37', 'u1', 'u7', 'lender', 5, array['As described', 'Quick replies'], 'Suit fit perfectly for my interview.', -58, null),
  ('rv15', 'r37', 'u7', 'u1', 'borrower', 5, array['Took good care'], 'Came back pressed. Thanks Alex!', -58, null),
  ('rv16', 'r30', 'u6', 'u7', 'lender', 5, array['Easy pickup'], 'Marcus even brought a garment bag.', -18, null),
  ('rv17', 'r30', 'u7', 'u6', 'borrower', 4, array['On time'], '', -18, null),
  ('rv18', 'r31', 'u10', 'u8', 'lender', 5, array['As described', 'Clean'], 'The gown was stunning.', -28, 'So glad it worked out!'),
  ('rv19', 'r31', 'u8', 'u10', 'borrower', 5, array['On time', 'Took good care'], '', -28, null),
  ('rv20', 'r32', 'u8', 'u10', 'lender', 4, array['Quick replies'], 'Cute dress, straps were a bit loose.', -48, null),
  ('rv21', 'r32', 'u10', 'u8', 'borrower', 5, array['On time'], 'Sofia is the best.', -48, null),
  ('rv22', 'r33', 'u9', 'u7', 'lender', 5, array['As described'], '', -13, null),
  ('rv23', 'r33', 'u7', 'u9', 'borrower', 5, array['On time', 'Easy pickup'], 'Smooth handoff.', -13, null),
  ('rv24', 'r38', 'u9', 'u1', 'lender', 4, array['Easy pickup'], 'Chinos were good, a little long on me.', -23, null),
  ('rv25', 'r41', 'u2', 'u8', 'lender', 5, array['As described', 'Easy pickup'], 'Wore it to ACL, got stopped five times.', -68, null),
  ('rv26', 'r41', 'u8', 'u2', 'borrower', 5, array['On time'], '', -68, null),
  ('rv27', 'r42', 'u3', 'u9', 'lender', 5, array['Clean'], 'Freshly ironed!', -44, null),
  ('rv28', 'r42', 'u9', 'u3', 'borrower', 5, array['On time', 'Quick replies'], '', -44, null)
) as v(short_name, rental, reviewer, reviewee, role, rating, tags, comment, day, reply)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Chats. Minutes are from now.
-- ---------------------------------------------------------------------------
insert into public.conversations (id, listing_id, borrower_id, owner_id, created_at)
select pg_temp.sid(c.short_name), pg_temp.sid(c.listing), pg_temp.sid(c.borrower), pg_temp.sid(c.owner),
       now() + make_interval(mins => c.minute)
from (values
  ('c1', 'l1', 'u1', 'u2', -60 * 24 * 40),
  ('c2', 'l5', 'u3', 'u1', -60 * 24 * 22),
  ('c3', 'l3', 'u7', 'u2', -60 * 5),
  ('c4', 'l24', 'u6', 'u10', -60 * 24 * 6),
  ('c5', 'l19', 'u10', 'u9', -60 * 24 * 2),
  ('c6', 'l2', 'u1', 'u3', -60 * 12),
  ('c7', 'l6', 'u1', 'u2', -60 * 24 * 2)
) as c(short_name, listing, borrower, owner, minute)
on conflict (id) do nothing;

insert into public.messages (id, conversation_id, sender_id, text, created_at)
select pg_temp.sid(m.short_name), pg_temp.sid(m.conversation), pg_temp.sid(m.sender), m.text,
       now() + make_interval(mins => m.minute)
from (values
  ('m1', 'c1', 'u1', 'Hey! Could I borrow the polo for Saturday''s game?', -60 * 24 * 40),
  ('m2', 'c1', 'u2', 'For sure. Want to pick it up Friday near Jester?', -60 * 24 * 40 + 12),
  ('m3', 'c1', 'u1', 'Perfect, see you then!', -60 * 24 * 40 + 20),
  ('m4', 'c2', 'u3', 'Are the chinos still available for next week?', -60 * 24 * 22),
  ('m5', 'c2', 'u1', 'Yep! PCL works for me.', -60 * 24 * 22 + 30),
  ('m6', 'c3', 'u7', 'Requested to borrow the navy blazer for career fair. Is the PCL ok?', -60 * 5),
  ('m7', 'c3', 'u2', 'Let me check my schedule and get back to you tonight.', -60 * 4),
  ('m8', 'c4', 'u6', 'Love these heels! Can I grab them Monday?', -60 * 24 * 6),
  ('m9', 'c4', 'u10', 'Yes! I''ll be at Speedway around noon.', -60 * 24 * 6 + 45),
  ('m10', 'c4', 'u6', 'Got them, thank you!!', -60 * 24),
  ('m11', 'c5', 'u10', 'Is the flight suit free for Halloween weekend?', -60 * 24 * 2),
  ('m12', 'c5', 'u9', 'It is. Accepted your request, aviators included.', -60 * 24 * 2 + 60),
  ('m13', 'c6', 'u1', 'Requested to borrow the formal dress. Does Jester still work?', -60 * 12),
  ('m14', 'c7', 'u1', 'Thanks for accepting! See you at the Union.', -60 * 24),
  ('m15', 'c7', 'u2', 'See you there. I''ll have the jacket in a bag.', -60 * 23)
) as m(short_name, conversation, sender, text, minute)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Saves (hearts)
-- ---------------------------------------------------------------------------
insert into public.saves (user_id, listing_id, created_at)
select pg_temp.sid(s.user_name), pg_temp.sid(s.listing), now() - make_interval(hours => s.hours_ago)
from (values
  ('u1', 'l2', 10), ('u1', 'l7', 30), ('u1', 'l13', 50), ('u1', 'l30', 2),
  ('u2', 'l2', 20), ('u2', 'l8', 5), ('u2', 'l17', 70),
  ('u3', 'l1', 40), ('u3', 'l6', 41), ('u3', 'l2', 42), ('u3', 'l22', 12),
  ('u6', 'l16', 15), ('u6', 'l24', 150), ('u6', 'l10', 3),
  ('u7', 'l3', 6), ('u7', 'l15', 90),
  ('u8', 'l22', 60), ('u8', 'l18', 25),
  ('u9', 'l14', 33), ('u9', 'l21', 8), ('u9', 'l19', 100),
  ('u10', 'l16', 18), ('u10', 'l19', 55), ('u10', 'l2', 7), ('u10', 'l11', 4)
) as s(user_name, listing, hours_ago)
on conflict (user_id, listing_id) do nothing;

-- ---------------------------------------------------------------------------
-- Open reports for the team to review (sign in as admin.damtest@utexas.edu).
-- ---------------------------------------------------------------------------
insert into public.reports (id, reporter_id, reported_user_id, reason, details, rental_id, created_at, status)
select pg_temp.sid(p.short_name), pg_temp.sid(p.reporter), pg_temp.sid(p.reported), p.reason, p.details,
       case when p.rental is not null then pg_temp.sid(p.rental) end, now() + make_interval(days => p.day), 'open'
from (values
  ('rp1', 'u3', 'u4', 'No-show', 'Confirmed pickup at Jester at 6pm, waited 30 minutes, no reply.', 'r21', -2),
  ('rp2', 'u2', 'u4', 'Inappropriate messages', 'Got rude after I asked them to reschedule.', null, -1)
) as p(short_name, reporter, reported, reason, details, rental, day)
on conflict (id) do nothing;
