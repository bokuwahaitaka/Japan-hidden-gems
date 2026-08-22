-- Japan Hidden Gems: privacy-aware country and age ranking filters
begin;

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
