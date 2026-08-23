begin;

create table if not exists public.engagement_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  discovery_mode text not null default 'balanced' check (discovery_mode in ('familiar','balanced','adventurous')),
  preferred_moods text[] not null default '{}',
  excluded_song_ids bigint[] not null default '{}',
  quiet_mode boolean not null default false,
  weekly_digest boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.curator_action_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_key text not null check (action_key in (
    'recommend','share','discover','review','translate','tag','comment','mission','collection',
    'reaction_check','surprise','daily_prompt','follow','compare','recap','quality_fix'
  )),
  song_id bigint references public.songs(id) on delete cascade,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata)='object'),
  created_at timestamptz not null default now()
);

create table if not exists public.curator_notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  song_id bigint references public.songs(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 300),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  unique(user_id,notification_key,song_id)
);

create table if not exists public.curator_weekly_focus (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  focus_key text not null check (focus_key in ('recommend','translate','quality','reply','share','rediscover')),
  target_count integer not null default 3 check (target_count between 1 and 20),
  progress_count integer not null default 0 check (progress_count between 0 and 1000),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(user_id,week_start,focus_key)
);

create index if not exists curator_action_user_created_idx on public.curator_action_log(user_id,created_at desc);
create index if not exists curator_action_song_created_idx on public.curator_action_log(song_id,created_at desc) where song_id is not null;
create index if not exists curator_notifications_user_unread_idx on public.curator_notifications(user_id,is_read,created_at desc);
create index if not exists curator_focus_user_week_idx on public.curator_weekly_focus(user_id,week_start desc);

alter table public.engagement_preferences enable row level security;
alter table public.curator_action_log enable row level security;
alter table public.curator_notifications enable row level security;
alter table public.curator_weekly_focus enable row level security;

drop policy if exists engagement_preferences_own on public.engagement_preferences;
create policy engagement_preferences_own on public.engagement_preferences for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists curator_action_log_read_own on public.curator_action_log;
create policy curator_action_log_read_own on public.curator_action_log for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists curator_action_log_insert_own on public.curator_action_log;
create policy curator_action_log_insert_own on public.curator_action_log for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists curator_notifications_own on public.curator_notifications;
create policy curator_notifications_own on public.curator_notifications for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists curator_weekly_focus_own on public.curator_weekly_focus;
create policy curator_weekly_focus_own on public.curator_weekly_focus for all to authenticated
  using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

revoke all on public.engagement_preferences,public.curator_action_log,public.curator_notifications,public.curator_weekly_focus from public,anon;
grant select,insert,update,delete on public.engagement_preferences,public.curator_notifications,public.curator_weekly_focus to authenticated;
grant select,insert on public.curator_action_log to authenticated;
grant usage,select on sequence public.curator_action_log_id_seq,public.curator_notifications_id_seq to authenticated;

create or replace function public.get_curator_command_center()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=(select auth.uid()); v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.listener_profiles p where p.user_id=v_user and p.listener_group='japan') then
    raise exception 'Japan listener profile required';
  end if;
  with mine as (
    select r.song_id,r.created_at,
      r.id=(select r2.id from public.recommendations r2 where r2.song_id=r.song_id and r2.recommended order by r2.created_at,r2.id limit 1) first_recommender
    from public.recommendations r where r.user_id=v_user and r.recommended
  ), song_stats as (
    select m.song_id,m.created_at,m.first_recommender,s.title,s.artist,s.title_en,s.artist_en,s.year,
      count(distinct rt.user_id) filter(where lp.listener_group='overseas') overseas_listeners,
      count(distinct rt.user_id) filter(where lp.listener_group='overseas' and not rt.heard_before) overseas_discoveries,
      round(avg(rt.rating) filter(where lp.listener_group='overseas' and rt.rating is not null),2) overseas_rating,
      count(distinct f.user_id) filter(where fp.listener_group='overseas') overseas_saves,
      count(distinct l.user_id) overseas_likes
    from mine m join public.songs s on s.id=m.song_id and not s.is_hidden
    left join public.ratings rt on rt.song_id=m.song_id left join public.listener_profiles lp on lp.user_id=rt.user_id
    left join public.favorite_songs f on f.song_id=m.song_id left join public.listener_profiles fp on fp.user_id=f.user_id
    left join public.song_likes l on l.song_id=m.song_id
    group by m.song_id,m.created_at,m.first_recommender,s.title,s.artist,s.title_en,s.artist_en,s.year
  ), actions as (
    select count(*) total,count(*) filter(where created_at>=date_trunc('week',now())) this_week
    from public.curator_action_log where user_id=v_user
  )
  select jsonb_build_object(
    'recommended_count',(select count(*) from song_stats),
    'first_recommender_count',(select count(*) from song_stats where first_recommender),
    'overseas_listeners',coalesce((select sum(overseas_listeners) from song_stats),0),
    'overseas_discoveries',coalesce((select sum(overseas_discoveries) from song_stats),0),
    'overseas_saves',coalesce((select sum(overseas_saves) from song_stats),0),
    'overseas_likes',coalesce((select sum(overseas_likes) from song_stats),0),
    'songs',coalesce((select jsonb_agg(to_jsonb(x) order by x.overseas_discoveries desc,x.created_at desc) from song_stats x),'[]'::jsonb),
    'actions_total',(select total from actions),'actions_this_week',(select this_week from actions),
    'streak',coalesce((select current_streak from public.user_retention_state where user_id=v_user),0),
    'badges',coalesce((select jsonb_agg(b.badge_key order by b.awarded_at) from public.user_badges b where b.user_id=v_user),'[]'::jsonb),
    'notifications',coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from (select id,notification_key,song_id,message,is_read,created_at from public.curator_notifications where user_id=v_user order by created_at desc limit 20)n),'[]'::jsonb),
    'preferences',coalesce((select to_jsonb(p)-'user_id' from public.engagement_preferences p where p.user_id=v_user),'{}'::jsonb),
    'weekly_focus',coalesce((select jsonb_agg(to_jsonb(w)-'user_id') from public.curator_weekly_focus w where w.user_id=v_user and w.week_start=date_trunc('week',current_date)::date),'[]'::jsonb)
  ) into v_result;
  return v_result;
end; $$;

create or replace function public.get_curator_world_feed(p_limit integer default 20)
returns table(song_id bigint,title text,artist text,title_en text,artist_en text,region text,event_type text,event_count bigint,last_event_at timestamptz)
language sql stable security definer set search_path='' as $$
  with events as (
    select r.song_id,coalesce(lp.country_code,'overseas') region,'discovery'::text event_type,count(*) event_count,max(r.created_at) last_event_at
    from public.ratings r join public.listener_profiles lp on lp.user_id=r.user_id
    where lp.listener_group='overseas' and not r.heard_before and r.created_at>=now()-interval '30 days'
    group by r.song_id,lp.country_code
    union all
    select f.song_id,coalesce(lp.country_code,'overseas'),'save',count(*),max(f.created_at)
    from public.favorite_songs f join public.listener_profiles lp on lp.user_id=f.user_id
    where lp.listener_group='overseas' and f.created_at>=now()-interval '30 days'
    group by f.song_id,lp.country_code
  )
  select s.id,s.title,s.artist,s.title_en,s.artist_en,e.region,e.event_type,e.event_count,e.last_event_at
  from events e join public.songs s on s.id=e.song_id and not s.is_hidden
  order by e.last_event_at desc,e.event_count desc limit greatest(1,least(coalesce(p_limit,20),50));
$$;

create or replace function public.record_curator_action(p_action_key text,p_song_id bigint default null,p_metadata jsonb default '{}'::jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare v_id bigint; v_user uuid:=(select auth.uid());
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  insert into public.curator_action_log(user_id,action_key,song_id,metadata)
  values(v_user,p_action_key,p_song_id,coalesce(p_metadata,'{}'::jsonb)) returning id into v_id;
  return v_id;
end; $$;

revoke all on function public.get_curator_command_center(),public.get_curator_world_feed(integer),public.record_curator_action(text,bigint,jsonb) from public;
revoke all on function public.get_curator_command_center(),public.get_curator_world_feed(integer),public.record_curator_action(text,bigint,jsonb) from anon;
grant execute on function public.get_curator_command_center(),public.get_curator_world_feed(integer),public.record_curator_action(text,bigint,jsonb) to authenticated;

commit;
