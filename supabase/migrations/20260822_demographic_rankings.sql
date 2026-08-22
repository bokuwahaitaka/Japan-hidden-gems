-- Japan Hidden Gems: privacy-aware country and age ranking filters
begin;

create table if not exists public.song_tags (
  id bigint generated always as identity primary key,
  category text not null check (category in ('genre','era','mood','feature')),
  slug text not null unique check (slug ~ '^[a-z0-9-]+
create or replace function public.get_demographic_filter_options()
returns table (
  filter_type text,
  value text,
  label text,
  label_en text,
  label_ja text,
  respondent_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_respondents as (
    select distinct p.user_id, p.country_code, p.age_band
    from public.listener_profiles p
    where exists (
      select 1 from public.recommendations r where r.user_id = p.user_id
    )
    or exists (
      select 1 from public.ratings rt where rt.user_id = p.user_id
    )
  ),
  country_options as (
    select
      'country'::text as filter_type,
      country_code::text as value,
      country_code::text as label,
      country_code::text as label_en,
      country_code::text as label_ja,
      count(*)::bigint as respondent_count
    from active_respondents
    where country_code <> 'JP'
    group by country_code
    having count(*) >= 10
  ),
  age_options as (
    select
      'age'::text as filter_type,
      age_band::text as value,
      age_band::text as label,
      case age_band
        when 'under_18' then 'Under 18'
        when '18_24' then '18–24'
        when '25_34' then '25–34'
        when '35_44' then '35–44'
        when '45_54' then '45–54'
        when '55_64' then '55–64'
        when '65_plus' then '65+'
        else 'Prefer not to say'
      end::text as label_en,
      case age_band
        when 'under_18' then '18歳未満'
        when '18_24' then '18〜24歳'
        when '25_34' then '25〜34歳'
        when '35_44' then '35〜44歳'
        when '45_54' then '45〜54歳'
        when '55_64' then '55〜64歳'
        when '65_plus' then '65歳以上'
        else '回答しない'
      end::text as label_ja,
      count(*)::bigint as respondent_count
    from active_respondents
    group by age_band
    having count(*) >= 10
  )
  select * from country_options
  union all
  select * from age_options
  order by filter_type, value;
$$;

revoke all on function public.get_demographic_filter_options() from public;
grant execute on function public.get_demographic_filter_options() to authenticated;

create or replace function public.get_hidden_gem_data_segment(
  p_country_code text default null,
  p_age_band text default null,
  p_tag_id bigint default null
)
returns table (
  id bigint,
  title text,
  artist text,
  year integer,
  youtube_url text,
  recommendation_total bigint,
  recommendation_count bigint,
  overseas_total bigint,
  known_count bigint,
  post_listen_rating_count bigint,
  average_rating numeric,
  my_recommended boolean,
  my_heard_before boolean,
  my_rating numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_filtered boolean := p_country_code is not null or p_age_band is not null;
  v_group_size bigint;
begin
  if p_country_code is not null and p_age_band is not null then
    raise exception 'Choose either country or age, not both.';
  end if;

  if p_country_code is not null then
    select count(distinct p.user_id)
    into v_group_size
    from public.listener_profiles p
    where p.country_code = p_country_code
      and p.listener_group = 'overseas'
      and exists (
        select 1 from public.ratings rt where rt.user_id = p.user_id
      );

    if v_group_size < 10 then
      raise exception 'At least 10 respondents are required for this country.';
    end if;
  end if;

  if p_age_band is not null then
    select count(distinct p.user_id)
    into v_group_size
    from public.listener_profiles p
    where p.age_band = p_age_band
      and (
        exists (select 1 from public.ratings rt where rt.user_id = p.user_id)
        or exists (select 1 from public.recommendations r where r.user_id = p.user_id)
      );

    if v_group_size < 10 then
      raise exception 'At least 10 respondents are required for this age band.';
    end if;
  end if;

  return query
  with recommendation_stats as (
    select
      r.song_id,
      count(*)::bigint as total,
      count(*) filter (where r.recommended = true)::bigint as positive
    from public.recommendations r
    join public.listener_profiles p on p.user_id = r.user_id
    where p.listener_group = 'japan'
      and (p_age_band is null or p.age_band = p_age_band)
    group by r.song_id
  ),
  rating_stats as (
    select
      rt.song_id,
      count(*)::bigint as total,
      count(*) filter (where rt.heard_before = true)::bigint as known,
      count(*) filter (
        where rt.heard_before = false and rt.rating is not null
      )::bigint as rating_total,
      avg(rt.rating) filter (
        where rt.heard_before = false and rt.rating is not null
      )::numeric as avg_rating
    from public.ratings rt
    join public.listener_profiles p on p.user_id = rt.user_id
    where p.listener_group = 'overseas'
      and (p_country_code is null or p.country_code = p_country_code)
      and (p_age_band is null or p.age_band = p_age_band)
    group by rt.song_id
  ),
  mine_rec as (
    select song_id, recommended
    from public.recommendations
    where user_id = auth.uid()
  ),
  mine_rating as (
    select song_id, heard_before, rating
    from public.ratings
    where user_id = auth.uid()
  )
  select
    s.id::bigint,
    s.title::text,
    s.artist::text,
    s.year::integer,
    s.youtube_url::text,
    case when v_is_filtered and coalesce(rs.total,0) < 10 then 0 else coalesce(rs.total,0) end,
    case when v_is_filtered and coalesce(rs.total,0) < 10 then 0 else coalesce(rs.positive,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.total,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.known,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.rating_total,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then null else os.avg_rating end,
    mr.recommended,
    mrt.heard_before,
    mrt.rating::numeric
  from public.songs s
  left join recommendation_stats rs on rs.song_id = s.id
  left join rating_stats os on os.song_id = s.id
  left join mine_rec mr on mr.song_id = s.id
  left join mine_rating mrt on mrt.song_id = s.id
  where p_tag_id is null or exists (
    select 1 from public.song_tag_assignments sta
    where sta.song_id = s.id and sta.tag_id = p_tag_id
  )
  order by s.id;
end;
$$;

revoke all on function public.get_hidden_gem_data_segment(text,text,bigint) from public;
grant execute on function public.get_hidden_gem_data_segment(text,text) to authenticated;

commit;
),
  label_en text not null,
  label_ja text not null,
  sort_order integer not null unique,
  is_active boolean not null default true
);

create table if not exists public.song_tag_assignments (
  song_id bigint not null references public.songs(id) on delete cascade,
  tag_id bigint not null references public.song_tags(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (song_id, tag_id)
);

insert into public.song_tags (category,slug,label_en,label_ja,sort_order) values
('genre','j-pop','J-Pop','J-POP',10),
('genre','city-pop','City Pop','シティポップ',20),
('genre','rock','Rock','ロック',30),
('genre','indie-alternative','Indie / Alternative','インディー／オルタナティブ',40),
('genre','hip-hop-rap','Hip-hop / Rap','ヒップホップ／ラップ',50),
('genre','r-and-b-soul','R&B / Soul','R&B／ソウル',60),
('genre','electronic-dance','Electronic / Dance','エレクトロニック／ダンス',70),
('genre','vocaloid','Vocaloid','ボーカロイド',80),
('genre','anime-game','Anime / Game','アニメ／ゲーム',90),
('genre','jazz','Jazz','ジャズ',100),
('genre','classical','Classical','クラシック',110),
('genre','folk-traditional','Folk / Traditional','民謡／伝統音楽',120),
('genre','metal','Metal','メタル',130),
('genre','punk','Punk','パンク',140),
('genre','ballad','Ballad','バラード',150),
('era','1970s','1970s','1970年代',210),
('era','1980s','1980s','1980年代',220),
('era','1990s','1990s','1990年代',230),
('era','2000s','2000s','2000年代',240),
('era','2010s','2010s','2010年代',250),
('era','2020s','2020s','2020年代',260),
('mood','upbeat','Upbeat','明るい',310),
('mood','calm','Calm','落ち着いた',320),
('mood','emotional','Emotional','エモーショナル',330),
('mood','melancholic','Melancholic','切ない',340),
('mood','energetic','Energetic','エネルギッシュ',350),
('mood','dreamy','Dreamy','幻想的',360),
('feature','female-vocal','Female Vocal','女性ボーカル',410),
('feature','male-vocal','Male Vocal','男性ボーカル',420),
('feature','group-vocal','Group Vocal','グループボーカル',430),
('feature','instrumental','Instrumental','インストゥルメンタル',440),
('feature','traditional-instruments','Traditional Instruments','和楽器',450),
('feature','acoustic','Acoustic','アコースティック',460),
('feature','experimental','Experimental','実験的',470)
on conflict (slug) do update set
category=excluded.category,label_en=excluded.label_en,label_ja=excluded.label_ja,sort_order=excluded.sort_order;

alter table public.song_tags enable row level security;
alter table public.song_tag_assignments enable row level security;

drop policy if exists "active_song_tags_public_read" on public.song_tags;
create policy "active_song_tags_public_read" on public.song_tags
for select to anon, authenticated using (is_active = true);

grant select on public.song_tags to anon, authenticated;

create or replace function public.get_song_filter_tags()
returns table (
  id bigint,
  category text,
  category_en text,
  category_ja text,
  label_en text,
  label_ja text,
  song_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $
  select
    t.id,
    t.category,
    case t.category when 'genre' then 'Genre' when 'era' then 'Era' when 'mood' then 'Mood' else 'Feature' end,
    case t.category when 'genre' then 'ジャンル' when 'era' then '年代' when 'mood' then '雰囲気' else '特徴' end,
    t.label_en,
    t.label_ja,
    count(a.song_id)::bigint
  from public.song_tags t
  join public.song_tag_assignments a on a.tag_id = t.id
  join public.songs s on s.id = a.song_id and s.is_hidden = false
  where t.is_active = true
  group by t.id,t.category,t.label_en,t.label_ja,t.sort_order
  order by t.sort_order;
$;

revoke all on function public.get_song_filter_tags() from public;
grant execute on function public.get_song_filter_tags() to authenticated;

create or replace function public.admin_list_song_tags()
returns table (id bigint, category text, category_ja text, label_en text, label_ja text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $
begin
  if not public.is_song_admin() then raise exception 'Administrator access required.'; end if;
  return query
  select t.id,t.category,
    case t.category when 'genre' then 'ジャンル' when 'era' then '年代' when 'mood' then '雰囲気' else '特徴' end,
    t.label_en,t.label_ja
  from public.song_tags t where t.is_active order by t.sort_order;
end;
$;

create or replace function public.admin_list_songs_v2()
returns table (
  id bigint,title text,artist text,year integer,youtube_url text,is_hidden boolean,
  created_at timestamptz,recommendation_count bigint,rating_count bigint,tag_ids jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $
begin
  if not public.is_song_admin() then raise exception 'Administrator access required.'; end if;
  return query
  select s.id::bigint,s.title::text,s.artist::text,s.year::integer,s.youtube_url::text,
    s.is_hidden,s.created_at,
    (select count(*) from public.recommendations r where r.song_id=s.id),
    (select count(*) from public.ratings rt where rt.song_id=s.id),
    coalesce((select jsonb_agg(a.tag_id order by a.tag_id) from public.song_tag_assignments a where a.song_id=s.id),'[]'::jsonb)
  from public.songs s order by s.is_hidden desc,s.id desc;
end;
$;

create or replace function public.admin_set_song_tags(p_song_id bigint,p_tag_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $
begin
  if not public.is_song_admin() then raise exception 'Administrator access required.'; end if;
  if not exists(select 1 from public.songs where id=p_song_id) then raise exception 'Song not found.'; end if;
  if exists(select 1 from unnest(coalesce(p_tag_ids,'{}'::bigint[])) x
    where not exists(select 1 from public.song_tags t where t.id=x and t.is_active)) then
    raise exception 'Invalid tag.';
  end if;
  delete from public.song_tag_assignments where song_id=p_song_id;
  insert into public.song_tag_assignments(song_id,tag_id,assigned_by)
  select p_song_id,x,auth.uid() from unnest(coalesce(p_tag_ids,'{}'::bigint[])) x;
end;
$;

revoke all on function public.admin_list_song_tags() from public;
revoke all on function public.admin_list_songs_v2() from public;
revoke all on function public.admin_set_song_tags(bigint,bigint[]) from public;
grant execute on function public.admin_list_song_tags() to authenticated;
grant execute on function public.admin_list_songs_v2() to authenticated;
grant execute on function public.admin_set_song_tags(bigint,bigint[]) to authenticated;


create or replace function public.get_demographic_filter_options()
returns table (
  filter_type text,
  value text,
  label text,
  label_en text,
  label_ja text,
  respondent_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with active_respondents as (
    select distinct p.user_id, p.country_code, p.age_band
    from public.listener_profiles p
    where exists (
      select 1 from public.recommendations r where r.user_id = p.user_id
    )
    or exists (
      select 1 from public.ratings rt where rt.user_id = p.user_id
    )
  ),
  country_options as (
    select
      'country'::text as filter_type,
      country_code::text as value,
      country_code::text as label,
      country_code::text as label_en,
      country_code::text as label_ja,
      count(*)::bigint as respondent_count
    from active_respondents
    where country_code <> 'JP'
    group by country_code
    having count(*) >= 10
  ),
  age_options as (
    select
      'age'::text as filter_type,
      age_band::text as value,
      age_band::text as label,
      case age_band
        when 'under_18' then 'Under 18'
        when '18_24' then '18–24'
        when '25_34' then '25–34'
        when '35_44' then '35–44'
        when '45_54' then '45–54'
        when '55_64' then '55–64'
        when '65_plus' then '65+'
        else 'Prefer not to say'
      end::text as label_en,
      case age_band
        when 'under_18' then '18歳未満'
        when '18_24' then '18〜24歳'
        when '25_34' then '25〜34歳'
        when '35_44' then '35〜44歳'
        when '45_54' then '45〜54歳'
        when '55_64' then '55〜64歳'
        when '65_plus' then '65歳以上'
        else '回答しない'
      end::text as label_ja,
      count(*)::bigint as respondent_count
    from active_respondents
    group by age_band
    having count(*) >= 10
  )
  select * from country_options
  union all
  select * from age_options
  order by filter_type, value;
$$;

revoke all on function public.get_demographic_filter_options() from public;
grant execute on function public.get_demographic_filter_options() to authenticated;

create or replace function public.get_hidden_gem_data_segment(
  p_country_code text default null,
  p_age_band text default null
)
returns table (
  id bigint,
  title text,
  artist text,
  year integer,
  youtube_url text,
  recommendation_total bigint,
  recommendation_count bigint,
  overseas_total bigint,
  known_count bigint,
  post_listen_rating_count bigint,
  average_rating numeric,
  my_recommended boolean,
  my_heard_before boolean,
  my_rating numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_filtered boolean := p_country_code is not null or p_age_band is not null;
  v_group_size bigint;
begin
  if p_country_code is not null and p_age_band is not null then
    raise exception 'Choose either country or age, not both.';
  end if;

  if p_country_code is not null then
    select count(distinct p.user_id)
    into v_group_size
    from public.listener_profiles p
    where p.country_code = p_country_code
      and p.listener_group = 'overseas'
      and exists (
        select 1 from public.ratings rt where rt.user_id = p.user_id
      );

    if v_group_size < 10 then
      raise exception 'At least 10 respondents are required for this country.';
    end if;
  end if;

  if p_age_band is not null then
    select count(distinct p.user_id)
    into v_group_size
    from public.listener_profiles p
    where p.age_band = p_age_band
      and (
        exists (select 1 from public.ratings rt where rt.user_id = p.user_id)
        or exists (select 1 from public.recommendations r where r.user_id = p.user_id)
      );

    if v_group_size < 10 then
      raise exception 'At least 10 respondents are required for this age band.';
    end if;
  end if;

  return query
  with recommendation_stats as (
    select
      r.song_id,
      count(*)::bigint as total,
      count(*) filter (where r.recommended = true)::bigint as positive
    from public.recommendations r
    join public.listener_profiles p on p.user_id = r.user_id
    where p.listener_group = 'japan'
      and (p_age_band is null or p.age_band = p_age_band)
    group by r.song_id
  ),
  rating_stats as (
    select
      rt.song_id,
      count(*)::bigint as total,
      count(*) filter (where rt.heard_before = true)::bigint as known,
      count(*) filter (
        where rt.heard_before = false and rt.rating is not null
      )::bigint as rating_total,
      avg(rt.rating) filter (
        where rt.heard_before = false and rt.rating is not null
      )::numeric as avg_rating
    from public.ratings rt
    join public.listener_profiles p on p.user_id = rt.user_id
    where p.listener_group = 'overseas'
      and (p_country_code is null or p.country_code = p_country_code)
      and (p_age_band is null or p.age_band = p_age_band)
    group by rt.song_id
  ),
  mine_rec as (
    select song_id, recommended
    from public.recommendations
    where user_id = auth.uid()
  ),
  mine_rating as (
    select song_id, heard_before, rating
    from public.ratings
    where user_id = auth.uid()
  )
  select
    s.id::bigint,
    s.title::text,
    s.artist::text,
    s.year::integer,
    s.youtube_url::text,
    case when v_is_filtered and coalesce(rs.total,0) < 10 then 0 else coalesce(rs.total,0) end,
    case when v_is_filtered and coalesce(rs.total,0) < 10 then 0 else coalesce(rs.positive,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.total,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.known,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then 0 else coalesce(os.rating_total,0) end,
    case when v_is_filtered and coalesce(os.total,0) < 10 then null else os.avg_rating end,
    mr.recommended,
    mrt.heard_before,
    mrt.rating::numeric
  from public.songs s
  left join recommendation_stats rs on rs.song_id = s.id
  left join rating_stats os on os.song_id = s.id
  left join mine_rec mr on mr.song_id = s.id
  left join mine_rating mrt on mrt.song_id = s.id
  order by s.id;
end;
$$;

revoke all on function public.get_hidden_gem_data_segment(text,text) from public;
grant execute on function public.get_hidden_gem_data_segment(text,text) to authenticated;

commit;
