-- Fix ambiguous song tag ID in the ranking function
begin;

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

  if p_tag_id is not null and not exists (
    select 1
    from public.song_tags tag
    where tag.id = p_tag_id and tag.is_active
  ) then
    raise exception 'Invalid tag.';
  end if;

  if p_country_code is not null then
    select count(distinct p.user_id)
    into v_group_size
    from public.listener_profiles p
    where p.country_code = p_country_code
      and p.listener_group = 'overseas'
      and exists (select 1 from public.ratings rt where rt.user_id = p.user_id);

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
    case when v_is_filtered and coalesce(rs.total, 0) < 10 then 0 else coalesce(rs.total, 0) end,
    case when v_is_filtered and coalesce(rs.total, 0) < 10 then 0 else coalesce(rs.positive, 0) end,
    case when v_is_filtered and coalesce(os.total, 0) < 10 then 0 else coalesce(os.total, 0) end,
    case when v_is_filtered and coalesce(os.total, 0) < 10 then 0 else coalesce(os.known, 0) end,
    case when v_is_filtered and coalesce(os.total, 0) < 10 then 0 else coalesce(os.rating_total, 0) end,
    case when v_is_filtered and coalesce(os.total, 0) < 10 then null else os.avg_rating end,
    mr.recommended,
    mrt.heard_before,
    mrt.rating::numeric
  from public.songs s
  left join recommendation_stats rs on rs.song_id = s.id
  left join rating_stats os on os.song_id = s.id
  left join mine_rec mr on mr.song_id = s.id
  left join mine_rating mrt on mrt.song_id = s.id
  where p_tag_id is null or exists (
    select 1
    from public.song_tag_assignments sta
    where sta.song_id = s.id and sta.tag_id = p_tag_id
  )
  order by s.id;
end;
$$;

revoke all on function public.get_hidden_gem_data_segment(text, text, bigint) from public;
grant execute on function public.get_hidden_gem_data_segment(text, text, bigint) to authenticated;

commit;
