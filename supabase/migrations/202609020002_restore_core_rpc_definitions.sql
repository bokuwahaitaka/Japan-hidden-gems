-- Keep every RPC used by the browser reproducible from repository migrations.
begin;

create or replace function public.get_genre_directory()
returns table(id bigint,slug text,label_en text,label_ja text,song_count bigint)
language sql
stable
security invoker
set search_path=pg_catalog,public
as $$
  select t.id,t.slug,t.label_en,t.label_ja,count(distinct s.id)::bigint
  from public.song_tags t
  left join public.song_tag_assignments a on a.tag_id=t.id
  left join public.songs s on s.id=a.song_id and s.is_hidden=false
  where t.is_active=true and t.category='genre'
  group by t.id,t.slug,t.label_en,t.label_ja,t.sort_order
  order by case t.slug
    when 'vocaloid' then 1 when 'rock' then 2 when 'j-pop' then 3
    when 'idol-pop' then 4 when 'city-pop' then 5 when 'anime-game' then 6
    when 'hip-hop-rap' then 7 when 'r-and-b-soul' then 8
    when 'electronic-dance' then 9 else 100 end,
    count(distinct s.id) desc,t.sort_order;
$$;

create or replace function public.record_song_open(p_song_id bigint)
returns void
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.songs s where s.id=p_song_id and not s.is_hidden) then
    raise exception 'Song not found.';
  end if;
  insert into public.listening_history(user_id,song_id) values(auth.uid(),p_song_id)
  on conflict(user_id,song_id) do update set
    last_opened_at=now(),open_count=public.listening_history.open_count+1;
end;
$$;

create or replace function public.get_discovery_feeds()
returns table(
  song_id bigint,added_at timestamptz,recommendations_7d bigint,ratings_7d bigint,
  opens_7d bigint,activity_7d bigint,trending_score numeric
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  with rec as (
    select r.song_id,count(*)::bigint count_7d from public.recommendations r
    where r.updated_at>=now()-interval '7 days' group by r.song_id
  ), rate as (
    select rt.song_id,count(*)::bigint count_7d from public.ratings rt
    where rt.updated_at>=now()-interval '7 days' group by rt.song_id
  ), opens as (
    select h.song_id,sum(h.open_count)::bigint count_7d from public.listening_history h
    where h.last_opened_at>=now()-interval '7 days' group by h.song_id
  )
  select s.id,s.created_at,
    coalesce(rec.count_7d,0),coalesce(rate.count_7d,0),coalesce(opens.count_7d,0),
    (coalesce(rec.count_7d,0)+coalesce(rate.count_7d,0)+coalesce(opens.count_7d,0))::bigint,
    (coalesce(rec.count_7d,0)*3+coalesce(rate.count_7d,0)*2+coalesce(opens.count_7d,0)
      +greatest(0,7-extract(epoch from (now()-s.created_at))/86400))::numeric
  from public.songs s
  left join rec on rec.song_id=s.id
  left join rate on rate.song_id=s.id
  left join opens on opens.song_id=s.id
  where not s.is_hidden
  order by 7 desc,2 desc;
$$;

create or replace function public.get_hidden_gem_data_segment_v2(
  p_country_code text default null,
  p_age_band text default null,
  p_tag_id bigint default null
)
returns table(
  id bigint,title text,artist text,year integer,youtube_url text,
  recommendation_total bigint,recommendation_count bigint,overseas_total bigint,
  known_count bigint,post_listen_rating_count bigint,average_rating numeric,
  my_recommended boolean,my_heard_before boolean,my_rating numeric,
  has_seed_metrics boolean,real_recommendation_total bigint,real_overseas_total bigint
)
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_is_filtered boolean := p_country_code is not null or p_age_band is not null;
  v_group_size bigint;
begin
  if p_country_code is not null and p_age_band is not null then
    raise exception 'Choose either country or age, not both.';
  end if;
  if p_tag_id is not null and not exists(
    select 1 from public.song_tags tag where tag.id=p_tag_id and tag.is_active
  ) then raise exception 'Invalid tag.'; end if;

  if p_country_code is not null then
    select count(distinct p.user_id) into v_group_size
    from public.listener_profiles p
    where p.country_code=p_country_code and p.listener_group='overseas'
      and exists(select 1 from public.ratings rt where rt.user_id=p.user_id);
    if v_group_size<10 then
      raise exception 'At least 10 respondents are required for this region.';
    end if;
  end if;
  if p_age_band is not null then
    select count(distinct p.user_id) into v_group_size
    from public.listener_profiles p
    where p.age_band=p_age_band and (
      exists(select 1 from public.ratings rt where rt.user_id=p.user_id)
      or exists(select 1 from public.recommendations r where r.user_id=p.user_id)
    );
    if v_group_size<10 then
      raise exception 'At least 10 respondents are required for this age band.';
    end if;
  end if;

  return query
  with recommendation_stats as (
    select r.song_id,count(*)::bigint total,
      count(*) filter(where r.recommended=true)::bigint positive
    from public.recommendations r
    join public.listener_profiles p on p.user_id=r.user_id
    where p.listener_group='japan' and (p_age_band is null or p.age_band=p_age_band)
    group by r.song_id
  ), rating_stats as (
    select rt.song_id,count(*)::bigint total,
      count(*) filter(where rt.heard_before=true)::bigint known,
      count(*) filter(where rt.heard_before=false and rt.rating is not null)::bigint rating_total,
      avg(rt.rating) filter(where rt.heard_before=false and rt.rating is not null)::numeric avg_rating
    from public.ratings rt
    join public.listener_profiles p on p.user_id=rt.user_id
    where p.listener_group='overseas'
      and (p_country_code is null or p.country_code=p_country_code)
      and (p_age_band is null or p.age_band=p_age_band)
    group by rt.song_id
  ), mine_rec as (
    select song_id,recommended from public.recommendations where user_id=(select auth.uid())
  ), mine_rating as (
    select song_id,heard_before,rating from public.ratings where user_id=(select auth.uid())
  )
  select
    s.id::bigint,s.title::text,s.artist::text,s.year::integer,s.youtube_url::text,
    (case when v_is_filtered and coalesce(rs.total,0)<10 then 0
      else coalesce(rs.total,0)+case when v_is_filtered then 0 else coalesce(sm.recommendation_total,0) end end)::bigint,
    (case when v_is_filtered and coalesce(rs.total,0)<10 then 0
      else coalesce(rs.positive,0)+case when v_is_filtered then 0 else coalesce(sm.recommendation_count,0) end end)::bigint,
    (case when v_is_filtered and coalesce(os.total,0)<10 then 0
      else coalesce(os.total,0)+case when v_is_filtered then 0 else coalesce(sm.overseas_total,0) end end)::bigint,
    (case when v_is_filtered and coalesce(os.total,0)<10 then 0
      else coalesce(os.known,0)+case when v_is_filtered then 0 else coalesce(sm.known_count,0) end end)::bigint,
    (case when v_is_filtered and coalesce(os.total,0)<10 then 0
      else coalesce(os.rating_total,0)+case when v_is_filtered then 0 else coalesce(sm.post_listen_rating_count,0) end end)::bigint,
    case
      when v_is_filtered and coalesce(os.total,0)<10 then null
      when coalesce(os.rating_total,0)+case when v_is_filtered then 0 else coalesce(sm.post_listen_rating_count,0) end=0 then null
      else (coalesce(os.avg_rating*os.rating_total,0)
        +case when v_is_filtered then 0 else coalesce(sm.average_rating*sm.post_listen_rating_count,0) end)
        /(coalesce(os.rating_total,0)+case when v_is_filtered then 0 else coalesce(sm.post_listen_rating_count,0) end)
    end::numeric,
    mr.recommended,mrt.heard_before,mrt.rating::numeric,
    (not v_is_filtered and sm.song_id is not null),
    coalesce(rs.total,0)::bigint,coalesce(os.total,0)::bigint
  from public.songs s
  left join recommendation_stats rs on rs.song_id=s.id
  left join rating_stats os on os.song_id=s.id
  left join mine_rec mr on mr.song_id=s.id
  left join mine_rating mrt on mrt.song_id=s.id
  left join public.song_seed_metrics sm on sm.song_id=s.id
  where not s.is_hidden
    and (p_tag_id is null or exists(
      select 1 from public.song_tag_assignments sta where sta.song_id=s.id and sta.tag_id=p_tag_id
    ))
  order by s.id;
end;
$$;

revoke all on function public.get_genre_directory() from public,anon;
revoke all on function public.record_song_open(bigint) from public,anon;
revoke all on function public.get_discovery_feeds() from public,anon;
revoke all on function public.get_hidden_gem_data_segment_v2(text,text,bigint) from public,anon;
grant execute on function public.get_genre_directory() to authenticated;
grant execute on function public.record_song_open(bigint) to authenticated;
grant execute on function public.get_discovery_feeds() to authenticated;
grant execute on function public.get_hidden_gem_data_segment_v2(text,text,bigint) to authenticated;

commit;
