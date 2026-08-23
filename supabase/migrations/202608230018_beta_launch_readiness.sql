begin;

create table if not exists public.beta_client_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  error_code text not null check(error_code ~ '^[a-z0-9_]{3,40}$'),
  message text not null check(char_length(message) between 1 and 500),
  page text not null default '' check(char_length(page)<=300),
  app_version text not null default '' check(char_length(app_version)<=80),
  created_at timestamptz not null default now()
);
create index if not exists beta_client_errors_created_idx on public.beta_client_errors(created_at desc);
create index if not exists beta_client_errors_user_created_idx on public.beta_client_errors(user_id,created_at desc);
alter table public.beta_client_errors enable row level security;
create policy beta_errors_admin_read on public.beta_client_errors for select to authenticated using(public.is_song_admin());
create policy beta_errors_own_read on public.beta_client_errors for select to authenticated using((select auth.uid())=user_id);
create policy beta_errors_own_insert on public.beta_client_errors for insert to authenticated with check((select auth.uid())=user_id);
revoke all on public.beta_client_errors from public,anon,authenticated;
grant select,insert on public.beta_client_errors to authenticated;
grant usage,select on sequence public.beta_client_errors_id_seq to authenticated;

create or replace function public.report_beta_client_error(p_error_code text,p_message text,p_page text default '',p_app_version text default '')
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(select auth.uid());v_id bigint;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  if p_error_code !~ '^[a-z0-9_]{3,40}$' then raise exception 'Invalid error code';end if;
  if (select count(*) from public.beta_client_errors e where e.user_id=v_user and e.created_at>now()-interval '1 hour')>=10 then return null;end if;
  insert into public.beta_client_errors(user_id,error_code,message,page,app_version)
  values(v_user,p_error_code,left(coalesce(nullif(btrim(p_message),''),'Unknown client error'),500),left(coalesce(p_page,''),300),left(coalesce(p_app_version,''),80))
  returning id into v_id;return v_id;
end;$$;

create or replace function public.get_beta_readiness_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if (select auth.uid()) is null or not public.is_song_admin() then raise exception 'Administrator access required';end if;
  select jsonb_build_object(
    'visible_songs',(select count(*) from public.songs s where not s.is_hidden),
    'reference_score_songs',(select count(distinct m.song_id) from public.song_seed_metrics m),
    'real_responses',(select (select count(*) from public.ratings)+(select count(*) from public.recommendations)),
    'unchecked_videos',(select count(*) from public.songs s where not s.is_hidden and coalesce(s.youtube_status,'unchecked')<>'valid'),
    'open_quality_reports',(select count(*) from public.song_quality_reports q where q.status='pending'),
    'open_tag_reports',(select count(*) from public.song_tag_reports t where t.status='open'),
    'open_feedback',(select count(*) from public.feedback_box f where f.status='pending'),
    'client_errors_24h',(select count(*) from public.beta_client_errors e where e.created_at>now()-interval '24 hours'),
    'launch_blockers',(select count(*) from public.song_quality_reports q where q.status='pending' and q.report_type in ('broken_video','wrong_video','duplicate'))
  ) into v_result;return v_result;
end;$$;

revoke all on function public.report_beta_client_error(text,text,text,text),public.get_beta_readiness_snapshot() from public,anon;
grant execute on function public.report_beta_client_error(text,text,text,text),public.get_beta_readiness_snapshot() to authenticated;
commit;
