begin;

create policy "active song tag assignments readable"
on public.song_tag_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.song_tags st
    where st.id = song_tag_assignments.tag_id
      and st.is_active = true
  )
);

grant select on public.song_tag_assignments to authenticated;

create index if not exists song_tag_assignments_tag_song_idx
  on public.song_tag_assignments(tag_id, song_id);

create or replace function public.get_similar_songs(
  p_song_id bigint,
  p_limit integer default 6
)
returns table (
  song_id bigint,
  title text,
  artist text,
  year smallint,
  youtube_url text,
  similarity_score numeric,
  shared_tags jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  with source_song as (
    select s.id, s.artist, s.year
    from public.songs s
    where s.id = p_song_id
      and not coalesce(s.is_hidden, false)
  ),
  source_tags as (
    select sta.tag_id
    from public.song_tag_assignments sta
    join public.song_tags st
      on st.id = sta.tag_id
     and st.is_active = true
    where sta.song_id = p_song_id
  ),
  shared as (
    select
      sta.song_id,
      count(*)::integer as shared_count,
      jsonb_agg(
        jsonb_build_object(
          'id', st.id,
          'label_en', st.label_en,
          'label_ja', st.label_ja
        )
        order by st.category, st.sort_order, st.id
      ) as shared_tags
    from public.song_tag_assignments sta
    join source_tags src on src.tag_id = sta.tag_id
    join public.song_tags st
      on st.id = sta.tag_id
     and st.is_active = true
    where sta.song_id <> p_song_id
    group by sta.song_id
  )
  select
    candidate.id as song_id,
    candidate.title,
    candidate.artist,
    candidate.year,
    candidate.youtube_url,
    (
      coalesce(shared.shared_count, 0) * 30
      + case
          when lower(candidate.artist) = lower(source_song.artist) then 12
          else 0
        end
      + case
          when candidate.year is not null and source_song.year is not null
            then greatest(0, 10 - abs(candidate.year::integer - source_song.year::integer))
          else 0
        end
    )::numeric as similarity_score,
    coalesce(shared.shared_tags, '[]'::jsonb) as shared_tags
  from source_song
  join public.songs candidate
    on candidate.id <> source_song.id
   and not coalesce(candidate.is_hidden, false)
  left join shared on shared.song_id = candidate.id
  order by
    similarity_score desc,
    candidate.id asc
  limit greatest(1, least(coalesce(p_limit, 6), 12));
$$;

revoke all on function public.get_similar_songs(bigint, integer) from public;
revoke all on function public.get_similar_songs(bigint, integer) from anon;
grant execute on function public.get_similar_songs(bigint, integer) to authenticated;

commit;
