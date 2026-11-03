-- Lendr: demo brands and pickup spots for the test listings. Run once after the brand migration. Safe to re-run.

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
