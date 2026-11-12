-- Appeals, and AI review of reports and appeals.
--
-- Anyone with a strike can appeal it. An approved appeal removes the strike everywhere: strikes_for
-- skips it, so penalties and badges update. A first appeal is reviewed by the AI service
-- (supabase/functions/ai-review); if it's denied, the person can ask for a second, human review.
--
-- New reports and first appeals are sent to the AI service. It decides clear cases on its own and
-- leaves the rest for the team with its notes. Safety reports (threats, harassment) and anything
-- that would ban someone outright always go to the team.
--
-- To turn on AI review, deploy supabase/functions/ai-review and store its address and shared
-- secret in Vault (SQL Editor; replace the values):
--   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/ai-review', 'ai_review_url');
--   select vault.create_secret('<long random string, same as AI_REVIEW_SECRET on the function>', 'ai_review_secret');
-- Without them, nothing is sent and the team reviews everything, as before.

-- ---------------------------------------------------------------------------
-- Who decided a report, and the AI's notes
-- ---------------------------------------------------------------------------
alter table public.reports
  add column decided_by text check (decided_by in ('team', 'ai')),
  add column ai_note text check (char_length(ai_note) <= 1000);

-- ---------------------------------------------------------------------------
-- Appeals
-- ---------------------------------------------------------------------------
create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles on delete cascade,
  source text not null check (source in ('no_show', 'late_return', 'report')),
  ref_id uuid not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  level smallint not null default 1 check (level in (1, 2)),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by text check (decided_by in ('team', 'ai')),
  decision_note text check (char_length(decision_note) <= 1000),
  ai_note text check (char_length(ai_note) <= 1000),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (user_id, source, ref_id, level)
);
create index appeals_status_idx on public.appeals (status);

alter table public.appeals enable row level security;

create policy "appeals: own and team can read" on public.appeals for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.appeals to authenticated;
alter publication supabase_realtime add table public.appeals;

-- Strikes overturned on appeal, for everyone: badges and penalties are computed in the app too.
create function public.overturned_strikes()
returns table (user_id uuid, source text, ref_id uuid)
language sql stable security definer set search_path = ''
as $$
  select a.user_id, a.source, a.ref_id from public.appeals a where a.status = 'approved';
$$;

-- Same as strikes_for in 20261020000002_app_functions.sql, minus strikes overturned on appeal.
create or replace function public.strikes_for(target uuid)
returns table (source text, ref_id uuid, at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with rental_strikes as (
    select 'no_show'::text as source, r.id as ref_id,
           ((r.start_date + time '12:00') at time zone 'America/Chicago') as at
    from public.rentals r
    where r.status = 'no_show'
      and r.no_show_reported_by is not null
      and target = case when r.no_show_reported_by = r.lender_id then r.borrower_id else r.lender_id end
    union all
    select 'late_return', r.id,
           case when r.status = 'returned' then r.returned_at
                else ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days' end
    from public.rentals r
    where r.borrower_id = target
      and (
        (r.status = 'returned'
          and r.returned_at > ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days')
        or (r.status = 'picked_up'
          and now() > ((r.end_date + time '23:59:59') at time zone 'America/Chicago') + interval '3 days')
      )
  ),
  report_strikes as (
    select 'report'::text, p.id, coalesce(p.reviewed_at, p.created_at)
    from public.reports p
    where p.reported_user_id = target
      and p.status = 'upheld'
      and (p.rental_id is null or p.rental_id not in (select rs.ref_id from rental_strikes rs))
  ),
  all_strikes as (
    select * from rental_strikes
    union all
    select * from report_strikes
  )
  select s.source, s.ref_id, s.at
  from all_strikes s
  where s.at >= now() - interval '180 days' and s.at <= now()
    and not exists (
      select 1 from public.appeals a
      where a.user_id = target and a.source = s.source and a.ref_id = s.ref_id and a.status = 'approved'
    )
  order by s.at;
$$;

-- Appeal one of your own strikes. A second appeal (a human review) needs the first to be denied.
create function public.file_appeal(strike_source text, strike_ref uuid, why text)
returns public.appeals
language plpgsql security definer set search_path = ''
as $$
declare
  previous public.appeals;
  created public.appeals;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if not exists (
    select 1 from public.strikes_for(auth.uid()) s where s.source = strike_source and s.ref_id = strike_ref
  ) then
    raise exception 'That strike isn''t on your account.';
  end if;
  select * into previous from public.appeals
    where user_id = auth.uid() and source = strike_source and ref_id = strike_ref
    order by level desc limit 1;
  if previous.id is not null and previous.status = 'pending' then
    raise exception 'Your appeal for this strike is still being reviewed.';
  end if;
  if previous.id is not null and previous.level = 2 then
    raise exception 'This strike has already had a final review.';
  end if;
  insert into public.appeals (user_id, source, ref_id, reason, level)
  values (auth.uid(), strike_source, strike_ref, trim(why), case when previous.id is null then 1 else 2 end)
  returning * into created;
  return created;
end;
$$;

-- The team approves or denies an appeal.
create function public.decide_appeal(target_id uuid, approve boolean, note text default '')
returns public.appeals
language plpgsql security definer set search_path = ''
as $$
declare
  decided public.appeals;
begin
  if not public.is_admin() then raise exception 'Only the Lendr team can decide appeals.'; end if;
  update public.appeals set
    status = case when approve then 'approved' else 'denied' end,
    decided_by = 'team', decision_note = nullif(left(trim(coalesce(note, '')), 1000), ''), decided_at = now()
  where id = target_id and status = 'pending'
  returning * into decided;
  if decided.id is null then raise exception 'This appeal was already decided.'; end if;
  return decided;
end;
$$;

revoke execute on function
  public.overturned_strikes(), public.file_appeal(text, uuid, text), public.decide_appeal(uuid, boolean, text)
from public, anon;
grant execute on function
  public.overturned_strikes(), public.file_appeal(text, uuid, text), public.decide_appeal(uuid, boolean, text)
to authenticated;

-- Reports decided by the team are marked as such.
create function public.mark_team_decision()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.status <> old.status and auth.uid() is not null and public.is_admin() then
    new.decided_by := 'team';
  end if;
  return new;
end;
$$;

revoke execute on function public.mark_team_decision() from public, anon, authenticated;

create trigger reports_mark_team_decision before update of status on public.reports
  for each row execute function public.mark_team_decision();

-- ---------------------------------------------------------------------------
-- Send new reports and first appeals to the AI service
-- ---------------------------------------------------------------------------
create function public.request_ai_review()
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

revoke execute on function public.request_ai_review() from public, anon, authenticated;

create trigger reports_request_ai_review after insert on public.reports
  for each row execute function public.request_ai_review();
create trigger appeals_request_ai_review after insert on public.appeals
  for each row execute function public.request_ai_review();
