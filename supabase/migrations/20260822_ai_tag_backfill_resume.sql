begin;

create or replace function public.admin_list_songs_v3()
returns table (
  id bigint,
  title text,
  artist text,
  year integer,
  youtube_url text,
  youtube_video_id text,
  is_hidden boolean,
  created_at timestamptz,
  recommendation_count bigint,
  rating_count bigint,
  tag_ids jsonb,
  ai_tag_status text,
  ai_tag_error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_song_admin() then
    raise exception 'Administrator access required.';
  end if;

  return query
  select
    s.id,
    s.title,
    s.artist,
    s.year::integer,
    s.youtube_url,
    s.youtube_video_id,
    s.is_hidden,
    s.created_at,
    (select count(*) from public.recommendations r where r.song_id = s.id),
    (select count(*) from public.ratings rt where rt.song_id = s.id),
    coalesce(
      (
        select jsonb_agg(a.tag_id order by a.tag_id)
        from public.song_tag_assignments a
        where a.song_id = s.id
      ),
      '[]'::jsonb
    ),
    s.ai_tag_status,
    s.ai_tag_error
  from public.songs s
  order by s.is_hidden desc, s.id desc;
end;
$$;

revoke all on function public.admin_list_songs_v3() from public;
revoke all on function public.admin_list_songs_v3() from anon;
grant execute on function public.admin_list_songs_v3() to authenticated;

commit;
