-- JHG retention suite: gentle streaks, themed leagues, taste blends,
-- achievement passport, notifications and non-monetary ranking predictions.
-- No wagering, prizes, payments or lyrics are stored by this schema.

create schema if not exists private;

create table public.user_retention_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_daily_date date,
  grace_days integer not null default 1 check (grace_days between 0 and 3),
  updated_at timestamptz not null default now()
);

create table public.music_leagues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 80),
  theme text not null check (char_length(btrim(theme)) between 3 and 240),
  invite_token uuid not null default gen_random_uuid() unique,
  status text not null default 'accepting' check (status in ('accepting','voting','revealed','archived')),
  submission_deadline timestamptz,
  voting_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_league_members (
  league_id uuid not null references public.music_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id,user_id)
);

create table public.music_league_entries (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.music_leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  comment text not null default '' check (char_length(comment)<=300),
  created_at timestamptz not null default now(),
  unique (league_id,user_id), unique (league_id,song_id)
);

create table public.music_league_votes (
  league_id uuid not null references public.music_leagues(id) on delete cascade,
  entry_id uuid not null references public.music_league_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  points smallint not null check (points between 1 and 3),
  created_at timestamptz not null default now(),
  primary key (league_id,entry_id,user_id)
);

create table public.taste_blends (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  invite_token uuid not null default gen_random_uuid() unique,
  created_at timestamptz not null default now()
);

create table public.taste_blend_members (
  blend_id uuid not null references public.taste_blends(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (blend_id,user_id)
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_key text not null check (achievement_key ~ '^[a-z0-9_]{2,50}$'),
  progress integer not null default 0 check (progress >= 0),
  target integer not null default 1 check (target > 0),
  unlocked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id,achievement_key)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly_digest boolean not null default true,
  followed_activity boolean not null default true,
  ranking_changes boolean not null default true,
  league_updates boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.ranking_predictions (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  song_id bigint not null references public.songs(id) on delete cascade,
  predicted_position smallint not null check (predicted_position between 1 and 3),
  result_position integer,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  primary key (user_id,week_start,predicted_position),
  unique (user_id,week_start,song_id)
);

create index music_leagues_status_idx on public.music_leagues(status,created_at desc);
create index music_league_members_user_idx on public.music_league_members(user_id,joined_at desc);
create index music_league_entries_league_idx on public.music_league_entries(league_id,created_at);
create index music_league_votes_entry_idx on public.music_league_votes(entry_id);
create index taste_blend_members_user_idx on public.taste_blend_members(user_id,joined_at desc);
create index ranking_predictions_week_idx on public.ranking_predictions(week_start desc,song_id);

alter table public.user_retention_state enable row level security;
alter table public.music_leagues enable row level security;
alter table public.music_league_members enable row level security;
alter table public.music_league_entries enable row level security;
alter table public.music_league_votes enable row level security;
alter table public.taste_blends enable row level security;
alter table public.taste_blend_members enable row level security;
alter table public.user_achievements enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.ranking_predictions enable row level security;

create or replace function private.is_league_member(p_league_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.music_league_members m where m.league_id=p_league_id and m.user_id=p_user_id)
    or exists(select 1 from public.music_leagues l where l.id=p_league_id and l.owner_id=p_user_id);
$$;
create or replace function private.is_blend_member(p_blend_id uuid,p_user_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.taste_blend_members m where m.blend_id=p_blend_id and m.user_id=p_user_id)
    or exists(select 1 from public.taste_blends b where b.id=p_blend_id and b.owner_id=p_user_id);
$$;
revoke all on function private.is_league_member(uuid,uuid),private.is_blend_member(uuid,uuid) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_league_member(uuid,uuid),private.is_blend_member(uuid,uuid) to authenticated;

create policy retention_own on public.user_retention_state for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy leagues_member_read on public.music_leagues for select to authenticated using (private.is_league_member(id,(select auth.uid())));
create policy leagues_create on public.music_leagues for insert to authenticated with check ((select auth.uid())=owner_id);
create policy leagues_owner_update on public.music_leagues for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
create policy league_members_read on public.music_league_members for select to authenticated using (private.is_league_member(league_id,(select auth.uid())));
create policy league_members_join on public.music_league_members for insert to authenticated with check (
 (select auth.uid())=user_id and exists(select 1 from public.music_leagues l where l.id=league_id and l.owner_id=(select auth.uid()))
);
create policy league_members_leave on public.music_league_members for delete to authenticated using ((select auth.uid())=user_id);
create policy league_entries_read on public.music_league_entries for select to authenticated using (private.is_league_member(league_id,(select auth.uid())));
create policy league_entries_create on public.music_league_entries for insert to authenticated with check ((select auth.uid())=user_id and private.is_league_member(league_id,(select auth.uid())));
create policy league_entries_update on public.music_league_entries for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy league_votes_read on public.music_league_votes for select to authenticated using (private.is_league_member(league_id,(select auth.uid())));
create policy league_votes_create on public.music_league_votes for insert to authenticated with check ((select auth.uid())=user_id and private.is_league_member(league_id,(select auth.uid())));
create policy league_votes_update on public.music_league_votes for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy blends_member_read on public.taste_blends for select to authenticated using (private.is_blend_member(id,(select auth.uid())));
create policy blends_create on public.taste_blends for insert to authenticated with check ((select auth.uid())=owner_id);
create policy blend_members_read on public.taste_blend_members for select to authenticated using (private.is_blend_member(blend_id,(select auth.uid())));
create policy blend_members_join on public.taste_blend_members for insert to authenticated with check (
 (select auth.uid())=user_id and exists(select 1 from public.taste_blends b where b.id=blend_id and b.owner_id=(select auth.uid()))
);
create policy achievements_own on public.user_achievements for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy notification_preferences_own on public.notification_preferences for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy predictions_own on public.ranking_predictions for all to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);

revoke all on public.user_retention_state,public.music_leagues,public.music_league_members,public.music_league_entries,
 public.music_league_votes,public.taste_blends,public.taste_blend_members,public.user_achievements,
 public.notification_preferences,public.ranking_predictions from public,anon;
grant select,insert,update on public.user_retention_state,public.music_leagues,public.music_league_entries,
 public.music_league_votes,public.user_achievements,public.notification_preferences,public.ranking_predictions to authenticated;
grant delete on public.ranking_predictions to authenticated;
grant select,insert,delete on public.music_league_members,public.taste_blend_members to authenticated;
grant select,insert on public.taste_blends to authenticated;

create or replace function public.claim_daily_completion()
returns table(current_streak integer,longest_streak integer,last_daily_date date)
language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=auth.uid();v_today date:=current_date;v_previous date;v_current integer;v_longest integer;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if not exists(select 1 from public.daily_discovery_sessions s where s.user_id=v_user and s.challenge_date=v_today and s.completed_at is not null) then raise exception 'Complete today''s discovery first';end if;
 insert into public.user_retention_state(user_id,current_streak,longest_streak,last_daily_date)
 values(v_user,1,1,v_today) on conflict(user_id) do nothing;
 select r.last_daily_date,r.current_streak,r.longest_streak into v_previous,v_current,v_longest from public.user_retention_state r where r.user_id=v_user for update;
 if v_previous is distinct from v_today then
   v_current:=case when v_previous>=v_today-2 then v_current+1 else 1 end;
   v_longest:=greatest(v_longest,v_current);
   update public.user_retention_state r set current_streak=v_current,longest_streak=v_longest,last_daily_date=v_today,updated_at=now() where r.user_id=v_user;
 end if;
 return query select v_current,v_longest,v_today;
end;$$;

create or replace function public.join_music_league(p_invite_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;
begin if v_user is null then raise exception 'Authentication required';end if;
 select l.id into v_id from public.music_leagues l where l.invite_token=p_invite_token and l.status<>'archived';
 if v_id is null then raise exception 'League not found';end if;
 insert into public.music_league_members(league_id,user_id) values(v_id,v_user) on conflict do nothing;return v_id;
end;$$;

create or replace function public.join_taste_blend(p_invite_token uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid();v_id uuid;
begin if v_user is null then raise exception 'Authentication required';end if;
 select b.id into v_id from public.taste_blends b where b.invite_token=p_invite_token;
 if v_id is null then raise exception 'Blend not found';end if;
 if (select count(*) from public.taste_blend_members m where m.blend_id=v_id)>=10 then raise exception 'Blend is full';end if;
 insert into public.taste_blend_members(blend_id,user_id) values(v_id,v_user) on conflict do nothing;return v_id;
end;$$;

create or replace function public.get_blend_mix(p_blend_id uuid,p_limit integer default 20)
returns table(song_id bigint,blend_score numeric,member_likes bigint)
language plpgsql stable security definer set search_path='' as $$
declare v_user uuid:=auth.uid();
begin
 if v_user is null or not private.is_blend_member(p_blend_id,v_user) then raise exception 'Blend access required';end if;
 return query with members as(select m.user_id from public.taste_blend_members m where m.blend_id=p_blend_id),likes as(
  select f.song_id,f.user_id,2::numeric weight from public.favorite_songs f join members m using(user_id)
  union all select r.song_id,r.user_id,greatest(r.rating-2,1)::numeric from public.ratings r join members m using(user_id) where r.rating>=4
 ) select l.song_id,sum(l.weight),count(distinct l.user_id) from likes l group by l.song_id
 order by count(distinct l.user_id) desc,sum(l.weight) desc,l.song_id limit greatest(1,least(coalesce(p_limit,20),50));
end;$$;

revoke all on function public.claim_daily_completion(),public.join_music_league(uuid),public.join_taste_blend(uuid),public.get_blend_mix(uuid,integer) from public,anon;
grant execute on function public.claim_daily_completion(),public.join_music_league(uuid),public.join_taste_blend(uuid),public.get_blend_mix(uuid,integer) to authenticated;
