-- Lendr: 13 more test listings with a thrift / resale (Depop, Vinted) feel: vintage, Y2K and streetwear
-- pieces in a spread of colors. Photos are from Wikimedia Commons, credited in supabase/photo_credits.md.
-- Run in the SQL Editor after seed.sql. Safe to re-run.
-- With TinyCLIP photo search set up, the indexing trigger embeds these automatically; otherwise run
-- tinyclip-space/backfill.py.
insert into public.listings (id, owner_id, title, description, category, events, size, price_per_day, brand, sale_price, image_uris, created_at)
select md5('dam-seed-' || l.short_name)::uuid, md5('dam-seed-' || l.owner)::uuid, l.title, l.description, l.category, l.events,
       l.size, l.price, l.brand, l.sale_price, array[l.photo], now() - make_interval(days => l.age_days)
from (values
  ('l31', 'u9', 'Vintage varsity letterman jacket', 'Royal blue wool body, cream leather sleeves, chenille patches. 60s find, runs boxy.', 'Outerwear', array['Game Day', 'Themed Party'], 'L', 9, 'Vintage', 85, 'https://upload.wikimedia.org/wikipedia/commons/8/85/1963_Orange_State_College%28CSUF%29_Titans_Lettermen%27s_Jacket2.jpg', 1),
  ('l32', 'u6', 'Plaid pleated midi dress', 'Mustard and black plaid wool, pleated skirt, belted waist. Very dark academia.', 'Dresses', array['Professional', 'Semi-Formal'], 'S', 8, 'Vintage', 45, 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Claire_McCardell_day_dress%2C_yellow_and_black_plaid_wool%2C_c_1950.jpg/500px-Claire_McCardell_day_dress%2C_yellow_and_black_plaid_wool%2C_c_1950.jpg', 2),
  ('l33', 'u10', 'Color-block geometric sweater', 'Chunky knit in cream, red, navy and sky blue. Oversized fit.', 'Tops', array['Themed Party', 'Game Day'], 'M', 5, 'Zara', 30, 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Colorful_Zara_Sweater.jpg/500px-Colorful_Zara_Sweater.jpg', 1),
  ('l34', 'u3', 'Floral Doc Martens 1460s', 'Dark floral print, 8-eye. Broken in, so no blisters. Women''s 8.', 'Shoes', array['Concert & Festival', 'Themed Party'], 'M', 8, 'Dr. Martens', 90, 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Dr._Martens_boots_with_a_flower_patern_%28ivesabM74%29.jpg/500px-Dr._Martens_boots_with_a_flower_patern_%28ivesabM74%29.jpg', 3),
  ('l35', 'u3', 'Olive leather lace-up boots', 'Moss green smooth leather, chunky sole. Women''s 8.', 'Shoes', array['Concert & Festival', 'Western'], 'M', 7, 'Dr. Martens', null::numeric, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/60/Green_Dr._Martens_boots_-_Church_Monkey_Buckingham.jpeg/500px-Green_Dr._Martens_boots_-_Church_Monkey_Buckingham.jpeg', 4),
  ('l36', 'u9', 'Black graphic hoodie', 'Heavyweight, flame graphic across the chest, star sleeve prints.', 'Tops', array['Concert & Festival', 'Game Day'], 'L', 4, 'Thrifted', 25, 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/Hoodie_m7agar.jpg/500px-Hoodie_m7agar.jpg', 2),
  ('l37', 'u7', 'Brown distressed leather jacket', 'Real leather, moto collar, perfectly worn in. Fits a men''s L.', 'Outerwear', array['Concert & Festival', 'Themed Party'], 'L', 12, 'Wilsons Leather', 110, 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/Leather_jacket_golden_era.jpg/500px-Leather_jacket_golden_era.jpg', 3),
  ('l38', 'u10', 'Light wash mom jeans', 'High rise, tapered leg, 100% cotton denim. Waist 27.', 'Bottoms', array['Concert & Festival', 'Game Day'], 'S', 4, 'Levi''s', 35, 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Momjeans.jpg/500px-Momjeans.jpg', 0),
  ('l39', 'u8', 'Plaid wool bucket hat', 'Burgundy and black plaid, wool blend. Warm for cold games.', 'Accessories', array['Game Day', 'Concert & Festival'], 'M', 3, 'Polo Ralph Lauren', 20, 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Polo_Bucket_Hat.jpg/500px-Polo_Bucket_Hat.jpg', 5),
  ('l40', 'u2', 'Aztec print puffer jacket', 'Navy down puffer with a red and cream Aztec pattern. Very warm.', 'Outerwear', array['Game Day', 'Western'], 'XL', 8, 'Polo Ralph Lauren', 95, 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Polo_Ralph_Lauren_down_jacket_with_Aztec_style_print.jpg/500px-Polo_Ralph_Lauren_down_jacket_with_Aztec_style_print.jpg', 2),
  ('l41', 'u6', 'Red Converse high tops', 'Classic red canvas Chuck Taylors, white laces. Unisex 7.', 'Shoes', array['Game Day', 'Concert & Festival'], 'S', 4, 'Converse', 30, 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Red_Chuck.jpg/500px-Red_Chuck.jpg', 0),
  ('l42', 'u8', 'Mustard belted shirt dress', '70s shirt dress, long sleeves, brown leather belt included.', 'Dresses', array['Professional', 'Semi-Formal', 'Themed Party'], 'M', 7, 'Vintage', 40, 'https://upload.wikimedia.org/wikipedia/commons/2/26/Shirt_dress.jpg', 4),
  ('l43', 'u10', 'Yellow 60s trapeze dress', 'Butter yellow, mock neck, swingy A-line. Perfect for a decades party.', 'Dresses', array['Themed Party', 'Semi-Formal'], 'XS', 6, 'Vintage', null::numeric, 'https://upload.wikimedia.org/wikipedia/commons/2/25/Tent_dress.jpg', 1)
) as l(short_name, owner, title, description, category, events, size, price, brand, sale_price, photo, age_days)
on conflict (id) do nothing;

-- Same pickup spots as Maya's (u3) and Sofia's (u8) other listings.
update public.listings
set pickup_spots = array['Jester Center', 'PCL (Perry-Castañeda Library)']
where owner_id = md5('dam-seed-u3')::uuid and pickup_spots = '{}';

update public.listings
set pickup_spots = array['West Campus (Guadalupe & 24th)', 'Speedway Plaza']
where owner_id = md5('dam-seed-u8')::uuid and pickup_spots = '{}';
