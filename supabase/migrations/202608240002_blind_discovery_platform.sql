-- JHG Blind Discovery: first-listen intent, aggregate insights and share tracking.
begin;

alter table public.ratings
  add column if not exists relisten_intent boolean,
  add column if not exists share_intent boolean,
  add column if not exists discovery_mode text,
  add column if not exists revealed_at timestamptz;

alter table public.ratings drop constraint if exists ratings_discovery_mode_check;
alter table public.ratings add constraint ratings_discovery_mode_check
  check (discovery_mode is null or discovery_mode in ('standard','blind','daily','entry'));

create unique index if not exists ratings_user_song_unique_idx
  on public.ratings(user_id,song_id);
create index if not exists ratings_song_intent_idx
  on public.ratings(song_id,heard_before,relisten_intent,share_intent);

create table if not exists public.discovery_share_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  share_type text not null check (share_type in ('native','download','copy')),
  created_at timestamptz not null default now()
);

create index if not exists discovery_share_events_user_idx
  on public.discovery_share_events(user_id,created_at desc);
create index if not exists discovery_share_events_song_idx
  on public.discovery_share_events(song_id,created_at desc);

alter table public.discovery_share_events enable row level security;
drop policy if exists discovery_share_events_read_own on public.discovery_share_events;
create policy discovery_share_events_read_own
  on public.discovery_share_events for select to authenticated
  using ((select auth.uid()) is not null and (select auth.uid())=user_id);

revoke all on public.discovery_share_events from anon,authenticated;
grant select on public.discovery_share_events to authenticated;

create or replace function public.get_discovery_insights(p_song_id bigint)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.songs s where s.id=p_song_id and not s.is_hidden) then
    raise exception 'Song not found';
  end if;

  with totals as (
    select
      count(*)::bigint responses,
      count(*) filter(where r.heard_before is true)::bigint known,
      count(*) filter(where r.heard_before is false and r.rating is not null)::bigint first_listens,
      avg(r.rating) filter(where r.heard_before is false and r.rating is not null)::numeric avg_rating,
      avg((r.relisten_intent is true)::int) filter(where r.heard_before is false and r.rating is not null)::numeric relisten_rate,
      avg((r.share_intent is true)::int) filter(where r.heard_before is false and r.rating is not null)::numeric share_rate
    from public.ratings r where r.song_id=p_song_id
  ), scored as (
    select *,
      case when responses=0 then null else known::numeric/responses end awareness_rate,
      case when responses<3 or avg_rating is null then null else round(
        100 * (avg_rating/5) * (1-known::numeric/responses) *
        (0.70 + 0.20*coalesce(relisten_rate,0) + 0.10*coalesce(share_rate,0)),1
      ) end jhg_score
    from totals
  ), regions as (
    select coalesce(p.country_code,'OT') region,
      count(*)::bigint responses,
      round(100*(1-avg((r.heard_before is true)::int)),1) discovery_rate,
      round(avg(r.rating) filter(where r.heard_before is false and r.rating is not null),2) avg_rating,
      round(100*avg((r.relisten_intent is true)::int) filter(where r.heard_before is false and r.rating is not null),1) relisten_rate
    from public.ratings r
    join public.listener_profiles p on p.user_id=r.user_id
    where r.song_id=p_song_id and p.listener_group='overseas'
    group by p.country_code
    having count(*)>=5
    order by count(*) desc
  )
  select jsonb_build_object(
    'song_id',p_song_id,
    'responses',s.responses,
    'first_listens',s.first_listens,
    'awareness_percent',case when s.awareness_rate is null then null else round(100*s.awareness_rate,1) end,
    'average_rating',case when s.avg_rating is null then null else round(s.avg_rating,2) end,
    'relisten_percent',case when s.relisten_rate is null then null else round(100*s.relisten_rate,1) end,
    'share_percent',case when s.share_rate is null then null else round(100*s.share_rate,1) end,
    'jhg_score',s.jhg_score,
    'provisional',s.responses<10 or s.first_listens<5,
    'regions',coalesce((select jsonb_agg(to_jsonb(regions)) from regions),'[]'::jsonb)
  ) into v_result from scored s;
  return v_result;
end;
$$;

create or replace function public.submit_blind_discovery(
  p_song_id bigint,
  p_heard_before boolean,
  p_rating smallint default null,
  p_relisten boolean default null,
  p_share boolean default null,
  p_mode text default 'blind'
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.listener_profiles p where p.user_id=v_user and p.listener_group='overseas') then
    raise exception 'An outside-Japan listener profile is required';
  end if;
  if not exists(select 1 from public.songs s where s.id=p_song_id and not s.is_hidden and s.youtube_url is not null) then
    raise exception 'Preview-ready song not found';
  end if;
  if p_mode not in ('blind','daily','entry') then raise exception 'Invalid discovery mode'; end if;
  if p_heard_before is false and (p_rating is null or p_rating not between 1 and 5 or p_relisten is null or p_share is null) then
    raise exception 'Rating and intent answers are required for a first listen';
  end if;

  insert into public.ratings(user_id,song_id,heard_before,rating,relisten_intent,share_intent,discovery_mode,revealed_at,updated_at)
  values(v_user,p_song_id,p_heard_before,
    case when p_heard_before then null else p_rating end,
    case when p_heard_before then null else p_relisten end,
    case when p_heard_before then null else p_share end,
    p_mode,now(),now())
  on conflict(user_id,song_id) do update set
    heard_before=excluded.heard_before,
    rating=excluded.rating,
    relisten_intent=excluded.relisten_intent,
    share_intent=excluded.share_intent,
    discovery_mode=excluded.discovery_mode,
    revealed_at=excluded.revealed_at,
    updated_at=excluded.updated_at;

  perform public.record_club_action('listen',p_song_id);
  if p_heard_before is false then perform public.record_club_action('rate',p_song_id); end if;
  select public.get_discovery_insights(p_song_id) into v_result;
  return v_result;
end;
$$;

create or replace function public.get_discovery_scoreboard()
returns table(
  song_id bigint,
  responses bigint,
  first_listens bigint,
  awareness_percent numeric,
  average_rating numeric,
  relisten_percent numeric,
  share_percent numeric,
  jhg_score numeric,
  provisional boolean
)
language sql
stable
security definer
set search_path=''
as $$
  with totals as (
    select r.song_id,
      count(*)::bigint responses,
      count(*) filter(where r.heard_before is false and r.rating is not null)::bigint first_listens,
      avg((r.heard_before is true)::int)::numeric awareness_rate,
      avg(r.rating) filter(where r.heard_before is false and r.rating is not null)::numeric average_rating,
      avg((r.relisten_intent is true)::int) filter(where r.heard_before is false and r.rating is not null)::numeric relisten_rate,
      avg((r.share_intent is true)::int) filter(where r.heard_before is false and r.rating is not null)::numeric share_rate
    from public.ratings r group by r.song_id
  )
  select t.song_id,t.responses,t.first_listens,
    round(100*t.awareness_rate,1),round(t.average_rating,2),
    round(100*t.relisten_rate,1),round(100*t.share_rate,1),
    case when t.responses<3 or t.average_rating is null then null else round(
      100*(t.average_rating/5)*(1-t.awareness_rate)*
      (0.70+0.20*coalesce(t.relisten_rate,0)+0.10*coalesce(t.share_rate,0)),1
    ) end,
    (t.responses<10 or t.first_listens<5)
  from totals t;
$$;

create or replace function public.record_blind_discovery_share(p_song_id bigint,p_share_type text default 'native')
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_user uuid:=auth.uid();
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if p_share_type not in ('native','download','copy') then raise exception 'Invalid share type'; end if;
  if not exists(select 1 from public.ratings r where r.user_id=v_user and r.song_id=p_song_id) then
    raise exception 'Discover the song before sharing a result card';
  end if;
  insert into public.discovery_share_events(user_id,song_id,share_type) values(v_user,p_song_id,p_share_type);
  perform public.record_club_action('share',p_song_id);
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.get_discovery_insights(bigint) from public,anon;
revoke all on function public.get_discovery_scoreboard() from public,anon;
revoke all on function public.submit_blind_discovery(bigint,boolean,smallint,boolean,boolean,text) from public,anon;
revoke all on function public.record_blind_discovery_share(bigint,text) from public,anon;
grant execute on function public.get_discovery_insights(bigint) to authenticated;
grant execute on function public.get_discovery_scoreboard() to authenticated;
grant execute on function public.submit_blind_discovery(bigint,boolean,smallint,boolean,boolean,text) to authenticated;
grant execute on function public.record_blind_discovery_share(bigint,text) to authenticated;

commit;
