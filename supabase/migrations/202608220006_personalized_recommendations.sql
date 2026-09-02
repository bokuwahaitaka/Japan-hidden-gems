-- Personalized song recommendations for anonymous listeners
begin;

create table if not exists public.personalization_feedback (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  feedback text not null check (feedback in ('not_interested')),
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

alter table public.personalization_feedback enable row level security;

drop policy if exists "users_read_own_personalization_feedback" on public.personalization_feedback;
create policy "users_read_own_personalization_feedback"
on public.personalization_feedback for select to authenticated
using (user_id = auth.uid());

revoke all on public.personalization_feedback from anon, authenticated;
grant select on public.personalization_feedback to authenticated;

create or replace function public.dismiss_personalized_song(p_song_id bigint)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $dismiss$
begin
  if auth.uid() is null then
    raise exception 'Sign-in required.';
  end if;

  if not exists (
    select 1 from public.songs s where s.id = p_song_id and s.is_hidden = false
  ) then
    raise exception 'Song not found.';
  end if;

  insert into public.personalization_feedback (user_id, song_id, feedback)
  values (auth.uid(), p_song_id, 'not_interested')
  on conflict (user_id, song_id)
  do update set feedback = excluded.feedback, created_at = now();
end;
$dismiss$;

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
as $recommend$
  with
  limits as (
    select least(greatest(coalesce(p_limit, 5), 1), 10) as result_limit
  ),
  preferred_genres as (
    select distinct lower(g.slug) as slug
    from public.listener_genre_preferences p
    join public.genres g on g.id = p.genre_id
    where p.user_id = auth.uid()
  ),
  preference_count as (
    select count(*)::numeric as total from preferred_genres
  ),
  positive_songs as (
    select r.song_id
    from public.recommendations r
    where r.user_id = auth.uid() and r.recommended = true
    union
    select rt.song_id
    from public.ratings rt
    where rt.user_id = auth.uid()
      and rt.heard_before = false
      and rt.rating >= 4
  ),
  learned_tags as (
    select a.tag_id, count(*)::numeric as weight
    from positive_songs p
    join public.song_tag_assignments a on a.song_id = p.song_id
    group by a.tag_id
  ),
  interaction as (
    select song_id
    from public.recommendations where user_id = auth.uid()
    union
    select song_id
    from public.ratings where user_id = auth.uid()
  ),
  hidden_scores as (
    select
      d.id as song_id,
      case
        when d.recommendation_total > 0
         and d.overseas_total > 0
         and d.average_rating is not null
        then least(
          100::numeric,
          100::numeric *
          (d.recommendation_count::numeric / d.recommendation_total::numeric) *
          (d.average_rating::numeric / 5::numeric) *
          (1::numeric - d.known_count::numeric / d.overseas_total::numeric)
        )
        else 0::numeric
      end as hidden_score
    from public.get_hidden_gem_data_segment(
      null::text, null::text, null::bigint
    ) d
  ),
  candidate_signals as (
    select
      s.id as song_id,
      count(distinct t.id) filter (
        where t.category = 'genre'
          and lower(t.slug) in (select slug from preferred_genres)
      )::numeric as preferred_matches,
      coalesce(sum(lt.weight), 0)::numeric as behavior_weight,
      coalesce(h.hidden_score, 0)::numeric as hidden_score,
      exists (select 1 from interaction i where i.song_id = s.id) as already_seen
    from public.songs s
    left join public.song_tag_assignments a on a.song_id = s.id
    left join public.song_tags t on t.id = a.tag_id and t.is_active
    left join learned_tags lt on lt.tag_id = a.tag_id
    left join hidden_scores h on h.song_id = s.id
    where s.is_hidden = false
      and not exists (
        select 1
        from public.personalization_feedback f
        where f.user_id = auth.uid()
          and f.song_id = s.id
          and f.feedback = 'not_interested'
      )
    group by s.id, h.hidden_score
  ),
  scored as (
    select
      c.song_id,
      (
        (
          45::numeric *
          case
            when pc.total > 0 then least(c.preferred_matches / pc.total, 1::numeric)
            else 0::numeric
          end
        ) +
        (35::numeric * least(c.behavior_weight / 3::numeric, 1::numeric)) +
        (20::numeric * c.hidden_score / 100::numeric)
      ) * case when c.already_seen then 0.35::numeric else 1::numeric end
      as recommendation_score
    from candidate_signals c
    cross join preference_count pc
  )
  select
    sc.song_id::bigint,
    round(sc.recommendation_score, 1)::numeric,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label_en', reasons.label_en,
          'label_ja', reasons.label_ja
        )
        order by reasons.signal desc, reasons.sort_order
      )
      from (
        select
          t.label_en,
          t.label_ja,
          t.sort_order,
          (
            case
              when t.category = 'genre'
               and lower(t.slug) in (select slug from preferred_genres)
              then 2 else 0
            end +
            case when lt.tag_id is not null then 1 else 0 end
          ) as signal
        from public.song_tag_assignments a
        join public.song_tags t on t.id = a.tag_id and t.is_active
        left join learned_tags lt on lt.tag_id = t.id
        where a.song_id = sc.song_id
          and (
            (t.category = 'genre' and lower(t.slug) in (select slug from preferred_genres))
            or lt.tag_id is not null
          )
        order by signal desc, t.sort_order
        limit 2
      ) reasons
    ), '[]'::jsonb) as reason_tags
  from scored sc
  order by sc.recommendation_score desc, sc.song_id
  limit (select result_limit from limits);
$recommend$;

revoke all on function public.dismiss_personalized_song(bigint) from public;
revoke all on function public.get_personalized_recommendations(integer) from public;

grant execute on function public.dismiss_personalized_song(bigint) to authenticated;
grant execute on function public.get_personalized_recommendations(integer) to authenticated;

commit;
