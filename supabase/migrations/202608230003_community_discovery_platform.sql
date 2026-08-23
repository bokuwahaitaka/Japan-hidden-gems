-- Community discovery platform: public profiles, social discovery, editorial guides,
-- collaborative metadata, trending charts and privacy-preserving taste matching.
-- No copyrighted lyrics are stored by this schema.

begin;

create table if not exists public.public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 240),
  locale text not null default 'en' check (locale in ('ja','en','ko','zh','ru','es','fr')),
  is_public boolean not null default true,
  is_curator boolean not null default false,
  avatar_seed text not null default substr(md5(gen_random_uuid()::text),1,12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profile_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_user_id),
  check (follower_id <> followed_user_id)
);

create table if not exists public.artist_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_key text not null check (char_length(artist_key) between 1 and 160),
  artist_name text not null check (char_length(artist_name) between 1 and 160),
  created_at timestamptz not null default now(),
  primary key (user_id, artist_key)
);

create table if not exists public.tag_follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  tag_id bigint not null references public.song_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);

create table if not exists public.song_recommendation_notes (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  locale text not null default 'ja' check (locale in ('ja','en','ko','zh','ru','es','fr')),
  body text not null check (char_length(btrim(body)) between 20 and 800),
  status text not null default 'published' check (status in ('draft','published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, user_id)
);

create table if not exists public.recommendation_note_helpful (
  note_id bigint not null references public.song_recommendation_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (note_id, user_id)
);

create table if not exists public.song_guides (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  locale text not null default 'ja' check (locale in ('ja','en','ko','zh','ru','es','fr')),
  summary text not null default '' check (char_length(summary) <= 1000),
  theme text not null default '' check (char_length(theme) <= 1200),
  cultural_context text not null default '' check (char_length(cultural_context) <= 1600),
  title_meaning text not null default '' check (char_length(title_meaning) <= 800),
  listening_notes text not null default '' check (char_length(listening_notes) <= 1200),
  mv_notes text not null default '' check (char_length(mv_notes) <= 1000),
  spoiler_warning boolean not null default false,
  ai_generated boolean not null default false,
  status text not null default 'draft' check (status in ('draft','review','published','archived')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, locale)
);

create table if not exists public.song_data_suggestions (
  id bigint generated always as identity primary key,
  song_id bigint not null references public.songs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  field_name text not null check (field_name in ('title','title_en','artist','artist_en','year','youtube_url','artist_image_url','tag','guide')),
  proposed_value text not null check (char_length(btrim(proposed_value)) between 1 and 2000),
  reason text not null default '' check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected','duplicate')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.artist_profiles (
  artist_key text primary key check (char_length(artist_key) between 1 and 160),
  artist_name text not null check (char_length(artist_name) between 1 and 160),
  owner_user_id uuid references auth.users(id) on delete set null,
  bio text not null default '' check (char_length(bio) <= 2000),
  official_url text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.weekly_wrap_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  public_token uuid not null default gen_random_uuid() unique,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create index if not exists public_profiles_public_created_idx on public.public_profiles(is_public, created_at desc);
create index if not exists profile_follows_followed_idx on public.profile_follows(followed_user_id, created_at desc);
create index if not exists artist_follows_artist_idx on public.artist_follows(artist_key, created_at desc);
create index if not exists tag_follows_tag_idx on public.tag_follows(tag_id, created_at desc);
create index if not exists recommendation_notes_song_status_idx on public.song_recommendation_notes(song_id, status, created_at desc);
create index if not exists recommendation_notes_user_created_idx on public.song_recommendation_notes(user_id, created_at desc);
create index if not exists recommendation_helpful_note_idx on public.recommendation_note_helpful(note_id);
create index if not exists song_guides_song_locale_status_idx on public.song_guides(song_id, locale, status);
create index if not exists data_suggestions_status_created_idx on public.song_data_suggestions(status, created_at desc);
create index if not exists weekly_wrap_user_week_idx on public.weekly_wrap_shares(user_id, week_start desc);

alter table public.public_profiles enable row level security;
alter table public.profile_follows enable row level security;
alter table public.artist_follows enable row level security;
alter table public.tag_follows enable row level security;
alter table public.song_recommendation_notes enable row level security;
alter table public.recommendation_note_helpful enable row level security;
alter table public.song_guides enable row level security;
alter table public.song_data_suggestions enable row level security;
alter table public.artist_profiles enable row level security;
alter table public.weekly_wrap_shares enable row level security;

create or replace function public.protect_community_managed_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'public_profiles' and new.is_curator is distinct from old.is_curator
     and not public.is_song_admin() then
    raise exception 'Only administrators can change curator status';
  end if;
  if tg_table_name = 'artist_profiles'
     and (new.is_verified is distinct from old.is_verified or new.owner_user_id is distinct from old.owner_user_id)
     and not public.is_song_admin() then
    raise exception 'Only administrators can change verification or ownership';
  end if;
  return new;
end;
$$;

create trigger protect_public_profile_managed_fields before update on public.public_profiles
for each row execute function public.protect_community_managed_fields();
create trigger protect_artist_profile_managed_fields before update on public.artist_profiles
for each row execute function public.protect_community_managed_fields();
revoke all on function public.protect_community_managed_fields() from public, anon, authenticated;

create policy public_profiles_read_visible on public.public_profiles for select to anon, authenticated
  using (is_public or (select auth.uid()) = user_id or public.is_song_admin());
create policy public_profiles_insert_own on public.public_profiles for insert to authenticated
  with check ((select auth.uid()) = user_id and not is_curator);
create policy public_profiles_update_own on public.public_profiles for update to authenticated
  using ((select auth.uid()) = user_id or public.is_song_admin())
  with check ((select auth.uid()) = user_id or public.is_song_admin());

create policy profile_follows_read on public.profile_follows for select to authenticated
  using ((select auth.uid()) = follower_id or (select auth.uid()) = followed_user_id);
create policy profile_follows_insert_own on public.profile_follows for insert to authenticated
  with check ((select auth.uid()) = follower_id);
create policy profile_follows_delete_own on public.profile_follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

create policy artist_follows_read_own on public.artist_follows for select to authenticated using ((select auth.uid()) = user_id);
create policy artist_follows_insert_own on public.artist_follows for insert to authenticated with check ((select auth.uid()) = user_id);
create policy artist_follows_delete_own on public.artist_follows for delete to authenticated using ((select auth.uid()) = user_id);
create policy tag_follows_read_own on public.tag_follows for select to authenticated using ((select auth.uid()) = user_id);
create policy tag_follows_insert_own on public.tag_follows for insert to authenticated with check ((select auth.uid()) = user_id);
create policy tag_follows_delete_own on public.tag_follows for delete to authenticated using ((select auth.uid()) = user_id);

create policy recommendation_notes_read on public.song_recommendation_notes for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = user_id or public.is_song_admin());
create policy recommendation_notes_insert_own on public.song_recommendation_notes for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy recommendation_notes_update_own on public.song_recommendation_notes for update to authenticated
  using ((select auth.uid()) = user_id or public.is_song_admin())
  with check ((select auth.uid()) = user_id or public.is_song_admin());
create policy recommendation_notes_delete_own on public.song_recommendation_notes for delete to authenticated
  using ((select auth.uid()) = user_id or public.is_song_admin());

create policy helpful_read on public.recommendation_note_helpful for select to anon, authenticated using (true);
create policy helpful_insert_own on public.recommendation_note_helpful for insert to authenticated with check ((select auth.uid()) = user_id);
create policy helpful_delete_own on public.recommendation_note_helpful for delete to authenticated using ((select auth.uid()) = user_id);

create policy song_guides_read_published on public.song_guides for select to anon, authenticated
  using (status = 'published' or public.is_song_admin());
create policy song_guides_admin_insert on public.song_guides for insert to authenticated with check (public.is_song_admin());
create policy song_guides_admin_update on public.song_guides for update to authenticated
  using (public.is_song_admin()) with check (public.is_song_admin());
create policy song_guides_admin_delete on public.song_guides for delete to authenticated using (public.is_song_admin());

create policy suggestions_read_own_admin on public.song_data_suggestions for select to authenticated
  using ((select auth.uid()) = user_id or public.is_song_admin());
create policy suggestions_insert_own on public.song_data_suggestions for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy suggestions_admin_update on public.song_data_suggestions for update to authenticated
  using (public.is_song_admin()) with check (public.is_song_admin());

create policy artist_profiles_read on public.artist_profiles for select to anon, authenticated using (true);
create policy artist_profiles_admin_insert on public.artist_profiles for insert to authenticated with check (public.is_song_admin());
create policy artist_profiles_owner_update on public.artist_profiles for update to authenticated
  using ((select auth.uid()) = owner_user_id or public.is_song_admin())
  with check ((select auth.uid()) = owner_user_id or public.is_song_admin());

create policy weekly_wrap_read_own on public.weekly_wrap_shares for select to authenticated using ((select auth.uid()) = user_id);
create policy weekly_wrap_insert_own on public.weekly_wrap_shares for insert to authenticated with check ((select auth.uid()) = user_id);
create policy weekly_wrap_update_own on public.weekly_wrap_shares for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.public_profiles, public.profile_follows, public.artist_follows, public.tag_follows,
  public.song_recommendation_notes, public.recommendation_note_helpful, public.song_guides,
  public.song_data_suggestions, public.artist_profiles, public.weekly_wrap_shares from public;
grant select on public.public_profiles, public.song_recommendation_notes, public.recommendation_note_helpful,
  public.song_guides, public.artist_profiles to anon;
grant select, insert, update on public.public_profiles to authenticated;
grant select, insert, delete on public.profile_follows, public.artist_follows, public.tag_follows to authenticated;
grant select, insert, update, delete on public.song_recommendation_notes to authenticated;
grant select, insert, delete on public.recommendation_note_helpful to authenticated;
grant select, insert, update, delete on public.song_guides to authenticated;
grant select, insert, update on public.song_data_suggestions to authenticated;
grant select, insert, update on public.artist_profiles to authenticated;
grant select, insert, update on public.weekly_wrap_shares to authenticated;
grant usage, select on sequence public.song_recommendation_notes_id_seq,
  public.song_guides_id_seq, public.song_data_suggestions_id_seq to authenticated;

create or replace function public.get_weekly_hidden_gems(p_limit integer default 20)
returns table(song_id bigint, activity_score numeric, new_ratings bigint, new_recommendations bigint, cup_wins bigint, favorite_adds bigint)
language sql stable security definer set search_path = ''
as $$
  with recent as (
    select s.id,
      (select count(*) from public.ratings r where r.song_id=s.id and r.created_at >= now()-interval '7 days') new_ratings,
      (select count(*) from public.recommendations x where x.song_id=s.id and x.recommended and x.created_at >= now()-interval '7 days') new_recommendations,
      (select count(*) from public.tournament_runs tr where tr.champion_song_id=s.id and tr.status='completed' and tr.completed_at >= now()-interval '7 days') cup_wins,
      (select count(*) from public.favorite_songs f where f.song_id=s.id and f.created_at >= now()-interval '7 days') favorite_adds
    from public.songs s where not s.is_hidden
  )
  select r.id, (r.new_ratings*2 + r.new_recommendations*3 + r.cup_wins*4 + r.favorite_adds*2)::numeric,
    r.new_ratings, r.new_recommendations, r.cup_wins, r.favorite_adds
  from recent r
  order by 2 desc, r.id desc
  limit greatest(1,least(coalesce(p_limit,20),100));
$$;

create or replace function public.get_public_profile(p_handle text)
returns table(user_id uuid, handle text, display_name text, bio text, locale text, is_curator boolean,
  follower_count bigint, following_count bigint, recommendation_count bigint, playlist_count bigint)
language sql stable security definer set search_path = ''
as $$
  select p.user_id,p.handle,p.display_name,p.bio,p.locale,p.is_curator,
    (select count(*) from public.profile_follows f where f.followed_user_id=p.user_id),
    (select count(*) from public.profile_follows f where f.follower_id=p.user_id),
    (select count(*) from public.song_recommendation_notes n where n.user_id=p.user_id and n.status='published'),
    (select count(*) from public.playlists pl where pl.user_id=p.user_id)
  from public.public_profiles p where p.handle=lower(p_handle) and p.is_public;
$$;

create or replace function public.get_taste_match(p_target_user uuid)
returns table(match_percent integer, shared_favorites bigint[], shared_high_ratings bigint[])
language plpgsql stable security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.public_profiles p where p.user_id=p_target_user and p.is_public) then
    raise exception 'Public profile not found';
  end if;
  return query
  with my_likes as (
    select f.song_id from public.favorite_songs f where f.user_id=v_me
    union select r.song_id from public.ratings r where r.user_id=v_me and r.rating>=4
  ), their_likes as (
    select f.song_id from public.favorite_songs f where f.user_id=p_target_user
    union select r.song_id from public.ratings r where r.user_id=p_target_user and r.rating>=4
  ), totals as (
    select (select count(*) from my_likes) a,(select count(*) from their_likes) b,
      (select count(*) from my_likes m join their_likes t using(song_id)) shared_count
  )
  select case when greatest(a,b)=0 then 0 else round(100.0*shared_count/greatest(a,b))::integer end,
    coalesce((select array_agg(m.song_id order by m.song_id) from my_likes m join their_likes t using(song_id)),'{}'::bigint[]),
    coalesce((select array_agg(r1.song_id order by r1.song_id) from public.ratings r1 join public.ratings r2 using(song_id)
      where r1.user_id=v_me and r2.user_id=p_target_user and r1.rating>=4 and r2.rating>=4),'{}'::bigint[])
  from totals;
end;
$$;

create or replace function public.get_artist_insights(p_artist_key text)
returns table(song_count bigint, rating_count bigint, recommendation_count bigint, favorite_count bigint,
  average_rating numeric, top_regions jsonb, top_age_bands jsonb)
language plpgsql stable security definer set search_path = ''
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or not exists(
    select 1 from public.artist_profiles ap
    where ap.artist_key=p_artist_key and (ap.owner_user_id=v_me or public.is_song_admin())
  ) then raise exception 'Verified artist access required'; end if;
  return query
  with artist_songs as (
    select s.id from public.songs s where coalesce(s.normalized_artist,lower(btrim(s.artist)))=p_artist_key and not s.is_hidden
  ), region_counts as (
    select lp.country_code key,count(*) value from public.ratings r join artist_songs a on a.id=r.song_id
    join public.listener_profiles lp on lp.user_id=r.user_id group by lp.country_code order by count(*) desc limit 8
  ), age_counts as (
    select lp.age_band key,count(*) value from public.ratings r join artist_songs a on a.id=r.song_id
    join public.listener_profiles lp on lp.user_id=r.user_id group by lp.age_band order by count(*) desc limit 8
  )
  select (select count(*) from artist_songs),
    (select count(*) from public.ratings r join artist_songs a on a.id=r.song_id),
    (select count(*) from public.recommendations x join artist_songs a on a.id=x.song_id where x.recommended),
    (select count(*) from public.favorite_songs f join artist_songs a on a.id=f.song_id),
    (select round(avg(r.rating)::numeric,2) from public.ratings r join artist_songs a on a.id=r.song_id),
    coalesce((select jsonb_object_agg(key,value) from region_counts),'{}'::jsonb),
    coalesce((select jsonb_object_agg(key,value) from age_counts),'{}'::jsonb);
end;
$$;

create or replace function public.get_community_feed(p_limit integer default 30)
returns table(note_id bigint, song_id bigint, author_handle text, author_name text, author_curator boolean,
  locale text, body text, helpful_count bigint, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select n.id,n.song_id,p.handle,p.display_name,p.is_curator,n.locale,n.body,
    (select count(*) from public.recommendation_note_helpful h where h.note_id=n.id),n.created_at
  from public.song_recommendation_notes n join public.public_profiles p on p.user_id=n.user_id
  where n.status='published' and p.is_public
    and (auth.uid() is null or not exists(select 1 from public.profile_follows f where f.follower_id=auth.uid())
      or n.user_id in (select f.followed_user_id from public.profile_follows f where f.follower_id=auth.uid()))
  order by n.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),100));
$$;

revoke all on function public.get_weekly_hidden_gems(integer) from public;
revoke all on function public.get_public_profile(text) from public;
revoke all on function public.get_taste_match(uuid) from public;
revoke all on function public.get_artist_insights(text) from public;
revoke all on function public.get_community_feed(integer) from public;
grant execute on function public.get_weekly_hidden_gems(integer) to anon, authenticated;
grant execute on function public.get_public_profile(text) to anon, authenticated;
grant execute on function public.get_taste_match(uuid) to authenticated;
grant execute on function public.get_artist_insights(text) to authenticated;
grant execute on function public.get_community_feed(integer) to anon, authenticated;

commit;
