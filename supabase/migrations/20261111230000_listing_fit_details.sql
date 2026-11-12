-- Optional fit details on listings: measurements (e.g. "Waist 28 in, length 40 in") and a short
-- note on how it fits (e.g. "Runs small, fits like an XS").
alter table public.listings
  add column measurements text not null default '' check (char_length(measurements) <= 120),
  add column fit_note text not null default '' check (char_length(fit_note) <= 120);

grant insert (measurements, fit_note) on public.listings to authenticated;
grant update (measurements, fit_note) on public.listings to authenticated;
