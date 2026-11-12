-- Fix: filing a report failed with 'record "new" has no field "level"', because the AI review
-- trigger read an appeals-only field on reports too. Same as request_ai_review in
-- 20261112020000_appeals_and_ai_review.sql, with the appeal check nested.
create or replace function public.request_ai_review()
returns trigger
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  service_url text;
  review_secret text;
  kind text;
begin
  -- Second appeals are for people only. (Nested so reports, which have no level, never read it.)
  if tg_table_name = 'appeals' then
    if new.level <> 1 then
      return new;
    end if;
  end if;
  select decrypted_secret into service_url from vault.decrypted_secrets where name = 'ai_review_url';
  select decrypted_secret into review_secret from vault.decrypted_secrets where name = 'ai_review_secret';
  if service_url is null or review_secret is null then
    return new;
  end if;
  kind := case when tg_table_name = 'appeals' then 'appeal' else 'report' end;
  -- kind and id go in the address too, in case the body doesn't arrive as JSON.
  perform net.http_post(
    url := service_url || '?kind=' || kind || '&id=' || new.id::text,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-review-secret', review_secret),
    body := jsonb_build_object('kind', kind, 'id', new.id::text),
    timeout_milliseconds := 60000
  );
  return new;
end;
$$;
