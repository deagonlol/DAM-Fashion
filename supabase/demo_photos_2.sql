-- Lendr: six more demo photos (cape, overalls, white shirt, lilac dress, cutoffs, bow tie).
-- Credits in supabase/photo_credits.md. Run in the SQL Editor. Safe to re-run.
update public.listings l
set image_uris = array[p.url]
from (values
    ('l8', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/Red_cloak_reproduction.jpg/500px-Red_cloak_reproduction.jpg'),
    ('l14', 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Bib-brace.jpg/500px-Bib-brace.jpg'),
    ('l20', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Camisade_pu%C3%B1o_doble.jpg/500px-Camisade_pu%C3%B1o_doble.jpg'),
    ('l22', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/New_Junon_evening_dress_%2851580%29.jpg/500px-New_Junon_evening_dress_%2851580%29.jpg'),
    ('l26', 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Jorts%2C_back_view.jpg/500px-Jorts%2C_back_view.jpg'),
    ('l29', 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Bow_tie.jpg/500px-Bow_tie.jpg')
) as p(short_name, url)
where l.id = md5('dam-seed-' || p.short_name)::uuid;
