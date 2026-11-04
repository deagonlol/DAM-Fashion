-- Lendr: real clothing photos for the test listings, from Wikimedia Commons.
-- Free licenses; credits are in supabase/photo_credits.md. Run in the SQL Editor. Safe to re-run.
-- Listings not listed here keep their placeholder photos.
update public.listings l
set image_uris = array[p.url]
from (values
    ('l1', 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Oranges_and_Reds_%283167719329%29.jpg/500px-Oranges_and_Reds_%283167719329%29.jpg'),
    ('l2', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Sequined_black_satin_and_lace_evening_gown.jpg/500px-Sequined_black_satin_and_lace_evening_gown.jpg'),
    ('l3', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Navy_blazer_jacket.jpg/500px-Navy_blazer_jacket.jpg'),
    ('l4', 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Botas_de_mulher_branco_na_cowboy_boots_portugal_%282%29.jpg/500px-Botas_de_mulher_branco_na_cowboy_boots_portugal_%282%29.jpg'),
    ('l5', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/45/Khaki_Cargo_Pants_Front.jpg/500px-Khaki_Cargo_Pants_Front.jpg'),
    ('l6', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/06/Jean_jacket.jpg/500px-Jean_jacket.jpg'),
    ('l7', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Gold_earrings_MET_DP257485-9515152153.jpg/500px-Gold_earrings_MET_DP257485-9515152153.jpg'),
    ('l9', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Grey_Double-Buttoned_Suit_Jacket.jpg/500px-Grey_Double-Buttoned_Suit_Jacket.jpg'),
    ('l10', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/1926-28_evening_dress%2C_Eugenie_et_Juliette%2C_Paris._Chinese_embroidered_green_silk_satin_01.jpg/500px-1926-28_evening_dress%2C_Eugenie_et_Juliette%2C_Paris._Chinese_embroidered_green_silk_satin_01.jpg'),
    ('l11', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/90/Seafoam_Green_Sequined_Skater_Skirt_with_Black_and_White_Flats_%2819090428198%29.jpg/500px-Seafoam_Green_Sequined_Skater_Skirt_with_Black_and_White_Flats_%2819090428198%29.jpg'),
    ('l13', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/59/Grey_and_navy_suit_on_mannequin.jpg/500px-Grey_and_navy_suit_on_mannequin.jpg'),
    ('l15', 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Dark_brown_Loake_Aldwych_oxfords.jpg/500px-Dark_brown_Loake_Aldwych_oxfords.jpg'),
    ('l16', 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Charles_James_red_velvet_and_satin_evening_gown%2C_1955_04.jpg/500px-Charles_James_red_velvet_and_satin_evening_gown%2C_1955_04.jpg'),
    ('l17', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/MAPElNorte099.JPG/500px-MAPElNorte099.JPG'),
    ('l18', 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Felthat.jpg/500px-Felthat.jpg'),
    ('l19', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Apollo_XIII_flight_suit_on_display_%28cropped%29.jpg/500px-Apollo_XIII_flight_suit_on_display_%28cropped%29.jpg'),
    ('l21', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Windbreaker_Jacket%2C_Hood_Outside_Transparency.png/500px-Windbreaker_Jacket%2C_Hood_Outside_Transparency.png'),
    ('l23', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/99/SANDF_-_TROUSERS_-_Men_-_SA_Army_-_Ceremonial_Guard_-_Black.png/500px-SANDF_-_TROUSERS_-_Men_-_SA_Army_-_Ceremonial_Guard_-_Black.png'),
    ('l24', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Lucite_shoes_plastic_lucite_rhinestone_leather_2007.037.jpg/500px-Lucite_shoes_plastic_lucite_rhinestone_leather_2007.037.jpg'),
    ('l25', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Angel_Costume_%28Unsplash%29.jpg/500px-Angel_Costume_%28Unsplash%29.jpg'),
    ('l27', 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fb/Amgueddfa_Cymru_-_crys_rygbi_-_rugby_jersey_-_95360.jpeg/500px-Amgueddfa_Cymru_-_crys_rygbi_-_rugby_jersey_-_95360.jpeg'),
    ('l28', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Epping_Foresters_Cricket_Club_Jersey_cable_knit_cricket_pullover.jpg/500px-Epping_Foresters_Cricket_Club_Jersey_cable_knit_cricket_pullover.jpg')
) as p(short_name, url)
where l.id = md5('dam-seed-' || p.short_name)::uuid;
