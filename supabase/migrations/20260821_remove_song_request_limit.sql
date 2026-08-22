-- Japan Hidden Gems: remove the per-user song request limit
begin;

create or replace function public.request_song(
  p_title text,
  p_artist text,
  p_youtube_url text,
  p_video_id text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_song_id bigint;
begin
  if v_user_id is null then
    raise exception 'Sign in anonymously before adding a song.';
  end if;

  if not exists (
    select 1
    from public.listener_profiles
    where user_id = v_user_id
      and listener_group = 'japan'
      and country_code = 'JP'
  ) then
    raise exception 'Only Japan-profile listeners can add songs.';
  end if;

  if p_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'Invalid YouTube video ID.';
  end if;

  if p_youtube_url <> 'https://www.youtube.com/watch?v=' || p_video_id then
    raise exception 'Invalid canonical YouTube URL.';
  end if;

  if length(trim(p_title)) < 1 or length(trim(p_title)) > 300 then
    raise exception 'Invalid video title.';
  end if;

  if length(trim(p_artist)) < 1 or length(trim(p_artist)) > 200 then
    raise exception 'Invalid channel name.';
  end if;

  if exists (
    select 1 from public.songs where youtube_video_id = p_video_id
  ) then
    raise exception 'This YouTube video is already in the ranking.';
  end if;

  insert into public.songs (
    title,
    artist,
    year,
    youtube_url,
    youtube_video_id,
    requested_by
  )
  values (
    trim(p_title),
    trim(p_artist),
    null,
    p_youtube_url,
    p_video_id,
    v_user_id
  )
  returning id into v_song_id;

  return v_song_id;
exception
  when unique_violation then
    raise exception 'This YouTube video is already in the ranking.';
end;
$$;

revoke all on function public.request_song(text,text,text,text) from public;
grant execute on function public.request_song(text,text,text,text) to authenticated;

commit;
