-- Fix personalized recommendation SQL by calculating Hidden Gem signals directly
begin;

create or replace function public.get_personalized_recommendations(p_limit integer default 5)
returns table (
  song_id bigint,
  recommendation_score numeric,
  reason_tags jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $recommend_fix$
  with
  limits as (
    select least(greatest(coalesce(p_limit, 5), 1), 10) as result_limit
  ),
  preferred_genres as (
    select distinct lower(g.slug) as slug
    from public.listener_genre_preferences pref
    join public.genres g on g.id = pref.genre_id
    where pref.user_id = auth.uid()
  ),
  preference_count as (
    select count(*)::numeric as total from preferred_genres
  ),
  positive_songs as (
    select rec.song_id
    from public.recommendations rec
    where rec.user_id = auth.uid() and rec.recommended = true
    union
    select rating.song_id
    from public.ratings rating
    where rating.user_id = auth.uid()
      and rating.heard_before = false
      and rating.rating >= 4
  ),
  learned_tags as (
    select assignment.tag_id, count(*)::numeric as weight
    from positive_songs positive
    join public.song_tag_assignments assignment
      on assignment.song_id = positive.song_id
    group by assignment.tag_id
  ),
  interactions as (
    select rec.song_id
    from public.recommendations rec
    where rec.user_id = auth.uid()
    union
    select rating.song_id
    from public.ratings rating
    where rating.user_id = auth.uid()
  ),
  recommendation_stats as (
    select
      rec.song_id,
      count(*)::numeric as total,
      count(*) filter (where rec.recommended = true)::numeric as positive
    from public.recommendations rec
    join public.listener_profiles profile on profile.user_id = rec.user_id
    where profile.listener_group = 'japan'
    group by rec.song_id
  ),
  rating_stats as (
    select
      rating.song_id,
      count(*)::numeric as total,
      count(*) filter (where rating.heard_before = true)::numeric as known,
      avg(rating.rating) filter (
        where rating.heard_before = false and rating.rating is not null
      )::numeric as average_rating
    from public.ratings rating
    join public.listener_profiles profile on profile.user_id = rating.user_id
    where profile.listener_group = 'overseas'
    group by rating.song_id
  ),
  hidden_scores as (
    select
      song.id as candidate_song_id,
      case
        when rec_stats.total > 0
         and rating_stats.total > 0
         and rating_stats.average_rating is not null
        then least(
          100::numeric,
          100::numeric *
          (rec_stats.positive / rec_stats.total) *
          (rating_stats.average_rating / 5::numeric) *
          (1::numeric - rating_stats.known / rating_stats.total)
        )
        else 0::numeric
      end as hidden_score
    from public.songs song
    left join recommendation_stats rec_stats on rec_stats.song_id = song.id
    left join rating_stats rating_stats on rating_stats.song_id = song.id
  ),
  candidate_signals as (
    select
      song.id as candidate_song_id,
      count(distinct tag.id) filter (
        where tag.category = 'genre'
          and lower(tag.slug) in (select preferred.slug from preferred_genres preferred)
      )::numeric as preferred_matches,
      coalesce(sum(learned.weight), 0)::numeric as behavior_weight,
      coalesce(hidden.hidden_score, 0)::numeric as hidden_score,
      exists (
        select 1
        from interactions seen
        where seen.song_id = song.id
      ) as already_seen
    from public.songs song
    left join public.song_tag_assignments assignment on assignment.song_id = song.id
    left join public.song_tags tag
      on tag.id = assignment.tag_id and tag.is_active
    left join learned_tags learned on learned.tag_id = assignment.tag_id
    left join hidden_scores hidden on hidden.candidate_song_id = song.id
    where song.is_hidden = false
      and not exists (
        select 1
        from public.personalization_feedback feedback
        where feedback.user_id = auth.uid()
          and feedback.song_id = song.id
          and feedback.feedback = 'not_interested'
      )
    group by song.id, hidden.hidden_score
  ),
  scored as (
    select
      candidate.candidate_song_id,
      (
        45::numeric *
        case
          when pref_count.total > 0
          then least(candidate.preferred_matches / pref_count.total, 1::numeric)
          else 0::numeric
        end +
        35::numeric * least(candidate.behavior_weight / 3::numeric, 1::numeric) +
        20::numeric * candidate.hidden_score / 100::numeric
      ) *
      case when candidate.already_seen then 0.35::numeric else 1::numeric end
      as score
    from candidate_signals candidate
    cross join preference_count pref_count
  )
  select
    scored_row.candidate_song_id::bigint,
    round(scored_row.score, 1)::numeric,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label_en', reason_rows.label_en,
          'label_ja', reason_rows.label_ja
        )
        order by reason_rows.signal desc, reason_rows.sort_order
      )
      from (
        select
          tag.label_en,
          tag.label_ja,
          tag.sort_order,
          (
            case
              when tag.category = 'genre'
               and lower(tag.slug) in (
                 select preferred.slug from preferred_genres preferred
               )
              then 2 else 0
            end +
            case when learned.tag_id is not null then 1 else 0 end
          ) as signal
        from public.song_tag_assignments assignment
        join public.song_tags tag
          on tag.id = assignment.tag_id and tag.is_active
        left join learned_tags learned on learned.tag_id = tag.id
        where assignment.song_id = scored_row.candidate_song_id
          and (
            (
              tag.category = 'genre'
              and lower(tag.slug) in (
                select preferred.slug from preferred_genres preferred
              )
            )
            or learned.tag_id is not null
          )
        order by signal desc, tag.sort_order
        limit 2
      ) reason_rows
    ), '[]'::jsonb)
  from scored scored_row
  order by scored_row.score desc, scored_row.candidate_song_id
  limit (select limits_row.result_limit from limits limits_row);
$recommend_fix$;

revoke all on function public.get_personalized_recommendations(integer) from public;
grant execute on function public.get_personalized_recommendations(integer) to authenticated;

commit;
