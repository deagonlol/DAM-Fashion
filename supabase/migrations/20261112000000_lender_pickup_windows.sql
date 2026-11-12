-- When a lender is usually free to meet: for each weekday, mornings (9-11), afternoons (12-4)
-- and/or evenings (5-9). The request and change-plans forms only offer those times.
-- Empty means any time. Values look like 'mon-morning'.
alter table public.profiles
  add column pickup_windows text[] not null default '{}' check (
    pickup_windows <@ array[
      'mon-morning', 'mon-afternoon', 'mon-evening', 'tue-morning', 'tue-afternoon', 'tue-evening',
      'wed-morning', 'wed-afternoon', 'wed-evening', 'thu-morning', 'thu-afternoon', 'thu-evening',
      'fri-morning', 'fri-afternoon', 'fri-evening', 'sat-morning', 'sat-afternoon', 'sat-evening',
      'sun-morning', 'sun-afternoon', 'sun-evening'
    ]::text[]
  );

grant update (pickup_windows) on public.profiles to authenticated;
