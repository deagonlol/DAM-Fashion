-- Let UT subdomain emails sign up too (my.utexas.edu, eid.utexas.edu, cs.utexas.edu, ...).
-- Same as handle_new_user in 20261020000000_initial_schema.sql, with the wider email rule and
-- the app's current name in the error. Matches isUtexasEmail in src/lib/data/auth.ts.

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(new.email, '') !~* '^[^\s@]+@([a-z0-9-]+\.)*utexas\.edu$' then
    raise exception 'Lendr is only for UT students. Use your UT email (ending in utexas.edu).';
  end if;

  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
