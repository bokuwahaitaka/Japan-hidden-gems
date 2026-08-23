-- JHG Discovery Club: missions, reactions, early discovery, badges and live activity.
begin;

create table if not exists public.song_reactions (
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('first_time','deserves_more','want_context','would_travel')),
  created_at timestamptz not null default now(),
  primary key (song_id,user_id,reaction)
);

create table if not exists public.discovery_club_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint references public.songs(id) on delete cascade,
  action text not null check (action in ('listen','react','favorite','recommend','rate','share','playlist')),
  action_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id,song_id,action,action_date)
);

create table if not exists public.early_discoveries (
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_number integer not null check (discovery_number between 1 and 25),
  discovered_at timestamptz not null default now(),
  primary key (song_id,user_id),
  unique (song_id,discovery_number)
);

create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null check (badge_key in ('first_find','listener_10','reaction_10','early_5','week_streak','ambassador')),
  awarded_at timestamptz not null default now(),
  primary key (user_id,badge_key)
);

create table if not exists public.community_activity (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  song_id bigint references public.songs(id) on delete cascade,
  event_type text not null check (event_type in ('discovered','reacted','badge','weekly','region')),
  message_key text not null check (char_length(message_key) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_discovery_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  title_ja text not null,
  title_en text not null,
  theme text not null check (theme in ('era','tag','artist','random')),
  theme_value text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  check (ends_at > starts_at)
);

create index if not exists discovery_club_actions_user_date_idx on public.discovery_club_actions(user_id,action_date desc);
create index if not exists discovery_club_actions_song_idx on public.discovery_club_actions(song_id,created_at desc);
create index if not exists early_discoveries_user_idx on public.early_discoveries(user_id,discovered_at desc);
create index if not exists community_activity_created_idx on public.community_activity(created_at desc);
create index if not exists community_activity_user_idx on public.community_activity(user_id,created_at desc);
create index if not exists community_activity_song_idx on public.community_activity(song_id,created_at desc);
create index if not exists song_reactions_song_idx on public.song_reactions(song_id,reaction);

alter table public.song_reactions enable row level security;
alter table public.discovery_club_actions enable row level security;
alter table public.early_discoveries enable row level security;
alter table public.user_badges enable row level security;
alter table public.community_activity enable row level security;
alter table public.weekly_discovery_events enable row level security;

create policy song_reactions_read_own on public.song_reactions for select to authenticated using ((select auth.uid())=user_id);
create policy song_reactions_insert_own on public.song_reactions for insert to authenticated with check ((select auth.uid())=user_id);
create policy song_reactions_delete_own on public.song_reactions for delete to authenticated using ((select auth.uid())=user_id);
create policy club_actions_read_own on public.discovery_club_actions for select to authenticated using ((select auth.uid())=user_id);
create policy early_discoveries_read_own on public.early_discoveries for select to authenticated using ((select auth.uid())=user_id);
create policy user_badges_read_own on public.user_badges for select to authenticated using ((select auth.uid())=user_id);
create policy community_activity_no_direct_read on public.community_activity for select to authenticated using (false);
create policy weekly_events_read on public.weekly_discovery_events for select to anon,authenticated using (is_active);

revoke all on public.song_reactions,public.discovery_club_actions,public.early_discoveries,public.user_badges,public.community_activity,public.weekly_discovery_events from public;
grant select on public.weekly_discovery_events to anon,authenticated;
grant select,insert,delete on public.song_reactions to authenticated;
grant select on public.early_discoveries,public.user_badges to authenticated;
grant select on public.discovery_club_actions to authenticated;

create or replace function public.record_club_action(p_action text,p_song_id bigint default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_number integer;v_badges integer;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  if p_action not in ('listen','react','favorite','recommend','rate','share','playlist') then raise exception 'Invalid action';end if;
  if p_song_id is not null and not exists(select 1 from public.songs s where s.id=p_song_id and not s.is_hidden) then raise exception 'Song not found';end if;
  insert into public.discovery_club_actions(user_id,song_id,action) values(v_user,p_song_id,p_action) on conflict do nothing;
  if p_song_id is not null and p_action in ('favorite','recommend','rate','react') and not exists(select 1 from public.early_discoveries e where e.song_id=p_song_id and e.user_id=v_user) then
    select count(*)::integer+1 into v_number from public.early_discoveries e where e.song_id=p_song_id;
    if v_number<=25 then
      insert into public.early_discoveries(song_id,user_id,discovery_number) values(p_song_id,v_user,v_number) on conflict do nothing;
      insert into public.community_activity(user_id,song_id,event_type,message_key) values(v_user,p_song_id,'discovered','early_discovery');
    end if;
  end if;
  insert into public.user_badges(user_id,badge_key)
  select v_user,b.badge_key from (values
    ('first_find',1,(select count(*) from public.early_discoveries e where e.user_id=v_user)),
    ('listener_10',10,(select count(*) from public.discovery_club_actions a where a.user_id=v_user and a.action='listen')),
    ('reaction_10',10,(select count(*) from public.song_reactions r where r.user_id=v_user)),
    ('early_5',5,(select count(*) from public.early_discoveries e where e.user_id=v_user)),
    ('ambassador',10,(select count(*) from public.discovery_club_actions a where a.user_id=v_user and a.action='share'))
  ) as b(badge_key,target,progress) where b.progress>=b.target on conflict do nothing;
  get diagnostics v_badges=row_count;
  return jsonb_build_object('ok',true,'new_badges',v_badges,'early_number',v_number);
end;$$;

create or replace function public.set_song_reaction(p_song_id bigint,p_reaction text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required';end if;
  if p_reaction not in ('first_time','deserves_more','want_context','would_travel') then raise exception 'Invalid reaction';end if;
  insert into public.song_reactions(song_id,user_id,reaction) values(p_song_id,v_user,p_reaction) on conflict do nothing;
  select public.record_club_action('react',p_song_id) into v_result;
  insert into public.community_activity(user_id,song_id,event_type,message_key) values(v_user,p_song_id,'reacted',p_reaction);
  return v_result;
end;$$;

create or replace function public.get_discovery_club_feed(p_limit integer default 30)
returns table(activity_id bigint,event_type text,message_key text,song_id bigint,handle text,display_name text,created_at timestamptz)
language sql stable security definer set search_path='' as $$
  select a.id,a.event_type,a.message_key,a.song_id,p.handle,p.display_name,a.created_at
  from public.community_activity a left join public.public_profiles p on p.user_id=a.user_id and p.is_public
  where a.created_at>=now()-interval '30 days'
  order by a.created_at desc limit greatest(1,least(coalesce(p_limit,30),100));
$$;

create or replace function public.get_song_reaction_summary(p_song_id bigint)
returns table(reaction text,reaction_count bigint,my_reacted boolean)
language sql stable security definer set search_path='' as $$
  select r.reaction,count(*)::bigint,bool_or(r.user_id=auth.uid())
  from public.song_reactions r where r.song_id=p_song_id group by r.reaction order by r.reaction;
$$;

create or replace function public.get_discovery_club_leaderboard(p_limit integer default 20)
returns table(user_id uuid,handle text,display_name text,points bigint,early_count bigint,reaction_count bigint,badge_count bigint)
language sql stable security definer set search_path='' as $$
  select p.user_id,p.handle,p.display_name,
    ((select count(*) from public.early_discoveries e where e.user_id=p.user_id)*5+
     (select count(*) from public.song_reactions r where r.user_id=p.user_id)*2+
     (select count(*) from public.discovery_club_actions a where a.user_id=p.user_id)+
     (select count(*) from public.user_badges b where b.user_id=p.user_id)*10)::bigint,
    (select count(*) from public.early_discoveries e where e.user_id=p.user_id),
    (select count(*) from public.song_reactions r where r.user_id=p.user_id),
    (select count(*) from public.user_badges b where b.user_id=p.user_id)
  from public.public_profiles p where p.is_public
  order by 4 desc,p.created_at asc limit greatest(1,least(coalesce(p_limit,20),50));
$$;

create or replace function public.get_region_discovery_challenge()
returns table(region text,discovery_count bigint,reaction_count bigint,points bigint)
language sql stable security definer set search_path='' as $$
  select case
    when p.country_code='JP' then 'JP'
    when p.country_code in ('KR','CN','TW','HK','MO','MN') then 'EA'
    when p.country_code in ('US','CA','MX') then 'NA'
    when p.country_code in ('SG','MY','TH','VN','PH','ID','BN','KH','LA','MM','TL') then 'SE'
    when p.country_code in ('SA','AE','QA','KW','BH','OM','IL','JO','LB','TR','IR','IQ','YE') then 'ME'
    when p.country_code in ('IN','PK','BD','LK','NP','BT','MV','AF') then 'SA'
    when p.country_code in ('AU','NZ','FJ','PG') then 'OC'
    when p.country_code in ('BR','AR','CL','CO','PE','VE','UY','PY','BO','EC') then 'LA'
    when p.country_code in ('ZA','NG','EG','KE','MA','GH','TZ','ET') then 'AF'
    else 'EU' end,
    count(distinct e.song_id),count(distinct r.song_id),
    (count(distinct e.song_id)*3+count(distinct r.song_id))::bigint
  from public.listener_profiles p
  left join public.early_discoveries e on e.user_id=p.user_id and e.discovered_at>=date_trunc('week',now())
  left join public.song_reactions r on r.user_id=p.user_id and r.created_at>=date_trunc('week',now())
  group by 1 order by 4 desc limit 20;
$$;

revoke all on function public.record_club_action(text,bigint),public.set_song_reaction(bigint,text),public.get_discovery_club_feed(integer),public.get_song_reaction_summary(bigint),public.get_discovery_club_leaderboard(integer),public.get_region_discovery_challenge() from public;
grant execute on function public.record_club_action(text,bigint),public.set_song_reaction(bigint,text) to authenticated;
grant execute on function public.get_discovery_club_feed(integer),public.get_song_reaction_summary(bigint),public.get_discovery_club_leaderboard(integer),public.get_region_discovery_challenge() to authenticated;

insert into public.weekly_discovery_events(event_key,title_ja,title_en,theme,theme_value,starts_at,ends_at)
values('launch-hidden-80s','80年代の隠れた名曲週間','Hidden 80s Week','era','1980',date_trunc('week',now()),date_trunc('week',now())+interval '7 days')
on conflict(event_key) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at,is_active=true;

commit;
