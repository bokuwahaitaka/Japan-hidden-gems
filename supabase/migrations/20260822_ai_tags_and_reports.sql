-- Automatic AI-created song tags and user correction reports
begin;

alter table public.song_tags
  add column if not exists ai_created boolean not null default false,
  add column if not exists created_by_model text,
  add column if not exists created_at timestamptz not null default now();

alter table public.song_tag_assignments
  add column if not exists source text not null default 'admin';

alter table public.song_tag_assignments
  drop constraint if exists song_tag_assignments_source_check;

alter table public.song_tag_assignments
  add constraint song_tag_assignments_source_check
  check (source in ('admin', 'ai'));

alter table public.songs
  add column if not exists ai_tag_status text not null default 'pending',
  add column if not exists ai_tagged_at timestamptz,
  add column if not exists ai_tag_error text;

alter table public.songs
  drop constraint if exists songs_ai_tag_status_check;

alter table public.songs
  add constraint songs_ai_tag_status_check
  check (ai_tag_status in ('pending', 'processing', 'completed', 'failed'));

create table if not exists public.song_tag_reports (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  report_type text not null check (report_type in ('wrong_tag', 'missing_tag', 'other')),
  message text not null check (char_length(message) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null
);

create unique index if not exists song_tag_reports_one_open_per_user_song
on public.song_tag_reports (song_id, user_id)
where status = 'open';

alter table public.song_tag_reports enable row level security;

drop policy if exists "users_read_own_tag_reports" on public.song_tag_reports;
create policy "users_read_own_tag_reports"
on public.song_tag_reports for select to authenticated
using (user_id = auth.uid());

revoke all on public.song_tag_reports from anon, authenticated;
grant select on public.song_tag_reports to authenticated;

create or replace function public.submit_song_tag_report(
  p_song_id bigint,
  p_report_type text,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Sign-in required.';
  end if;

  if not exists (
    select 1 from public.listener_profiles p where p.user_id = auth.uid()
  ) then
    raise exception 'Complete your listener profile first.';
  end if;

  if p_report_type not in ('wrong_tag', 'missing_tag', 'other') then
    raise exception 'Invalid report type.';
  end if;

  if char_length(trim(coalesce(p_message, ''))) not between 3 and 500 then
    raise exception 'Report must be between 3 and 500 characters.';
  end if;

  if not exists (
    select 1 from public.songs s where s.id = p_song_id and s.is_hidden = false
  ) then
    raise exception 'Song not found.';
  end if;

  insert into public.song_tag_reports (song_id, user_id, report_type, message)
  values (p_song_id, auth.uid(), p_report_type, trim(p_message))
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'You already have an open report for this song.';
end;
$$;

create or replace function public.save_ai_song_tags(
  p_song_id bigint,
  p_tags jsonb,
  p_model text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tag jsonb;
  v_tag_id bigint;
  v_category text;
  v_slug text;
  v_label_en text;
  v_label_ja text;
  v_sort_order integer;
  v_saved integer := 0;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  if not exists (select 1 from public.songs where id = p_song_id) then
    raise exception 'Song not found.';
  end if;

  if jsonb_typeof(p_tags) <> 'array' or jsonb_array_length(p_tags) < 1 then
    raise exception 'At least one tag is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext('jhg_song_tags'));

  update public.songs
  set ai_tag_status = 'processing', ai_tag_error = null
  where id = p_song_id;

  delete from public.song_tag_assignments
  where song_id = p_song_id and source = 'ai';

  for v_tag in
    select value from jsonb_array_elements(p_tags) with ordinality
    where ordinality <= 12
  loop
    v_category := lower(trim(v_tag->>'category'));
    v_slug := lower(trim(v_tag->>'slug'));
    v_slug := regexp_replace(v_slug, '[^a-z0-9-]+', '-', 'g');
    v_slug := trim(both '-' from v_slug);
    v_label_en := trim(v_tag->>'label_en');
    v_label_ja := trim(v_tag->>'label_ja');

    if v_category not in ('genre', 'era', 'mood', 'feature')
       or v_slug !~ '^[a-z0-9-]{2,60}$'
       or char_length(v_label_en) not between 1 and 80
       or char_length(v_label_ja) not between 1 and 80 then
      continue;
    end if;

    select id into v_tag_id
    from public.song_tags
    where slug = v_slug;

    if v_tag_id is null then
      select coalesce(max(sort_order), 0) + 10 into v_sort_order
      from public.song_tags;

      insert into public.song_tags (
        category, slug, label_en, label_ja, sort_order,
        ai_created, created_by_model
      )
      values (
        v_category, v_slug, v_label_en, v_label_ja, v_sort_order,
        true, left(p_model, 100)
      )
      returning id into v_tag_id;
    end if;

    insert into public.song_tag_assignments (
      song_id, tag_id, assigned_by, source
    )
    values (p_song_id, v_tag_id, null, 'ai')
    on conflict (song_id, tag_id) do nothing;

    v_saved := v_saved + 1;
  end loop;

  if v_saved = 0 then
    raise exception 'AI returned no valid tags.';
  end if;

  update public.songs
  set ai_tag_status = 'completed',
      ai_tagged_at = now(),
      ai_tag_error = null
  where id = p_song_id;

  return v_saved;
end;
$$;

create or replace function public.mark_ai_tag_failure(
  p_song_id bigint,
  p_error text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required.';
  end if;

  update public.songs
  set ai_tag_status = 'failed',
      ai_tag_error = left(coalesce(p_error, 'Unknown error'), 500)
  where id = p_song_id;
end;
$$;

create or replace function public.admin_list_tag_reports()
returns table (
  id bigint,
  song_id bigint,
  song_title text,
  song_artist text,
  report_type text,
  message text,
  status text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    r.id, r.song_id, s.title::text, s.artist::text,
    r.report_type, r.message, r.status, r.created_at
  from public.song_tag_reports r
  join public.songs s on s.id = r.song_id
  order by (r.status = 'open') desc, r.created_at desc;
end;
$$;

create or replace function public.admin_set_tag_report_status(
  p_report_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Invalid status.';
  end if;

  update public.song_tag_reports
  set status = p_status, resolved_at = now(), resolved_by = auth.uid()
  where id = p_report_id;

  if not found then
    raise exception 'Report not found.';
  end if;
end;
$$;

revoke all on function public.submit_song_tag_report(bigint, text, text) from public;
revoke all on function public.save_ai_song_tags(bigint, jsonb, text) from public;
revoke all on function public.mark_ai_tag_failure(bigint, text) from public;
revoke all on function public.admin_list_tag_reports() from public;
revoke all on function public.admin_set_tag_report_status(bigint, text) from public;

grant execute on function public.submit_song_tag_report(bigint, text, text) to authenticated;
grant execute on function public.save_ai_song_tags(bigint, jsonb, text) to service_role;
grant execute on function public.mark_ai_tag_failure(bigint, text) to service_role;
grant execute on function public.admin_list_tag_reports() to authenticated;
grant execute on function public.admin_set_tag_report_status(bigint, text) to authenticated;

commit;
