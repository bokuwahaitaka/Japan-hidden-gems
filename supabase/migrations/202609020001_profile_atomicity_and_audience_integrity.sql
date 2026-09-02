-- Keep listener profile updates atomic and prevent cross-audience response writes.
begin;

create or replace function public.save_listener_profile(
  p_listener_group text,
  p_country_code text,
  p_age_band text,
  p_genre_ids smallint[]
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_distinct_genre_count integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_listener_group not in ('japan', 'overseas') then
    raise exception 'Invalid listener group.';
  end if;

  if p_country_code !~ '^[A-Z]{2}$'
     or (p_listener_group = 'japan' and p_country_code <> 'JP')
     or (p_listener_group = 'overseas' and p_country_code = 'JP') then
    raise exception 'Listener group and region do not match.';
  end if;

  if p_age_band not in (
    'under_18','18_24','25_34','35_44','45_54','55_64','65_plus','prefer_not_to_say'
  ) then
    raise exception 'Invalid age band.';
  end if;

  select count(distinct genre_id)
  into v_distinct_genre_count
  from unnest(coalesce(p_genre_ids, '{}'::smallint[])) as selected(genre_id);

  if v_distinct_genre_count < 1 or v_distinct_genre_count > 5 then
    raise exception 'Choose between 1 and 5 genres.';
  end if;

  if exists (
    select 1
    from unnest(p_genre_ids) as selected(genre_id)
    left join public.genres g on g.id = selected.genre_id and g.is_active
    where g.id is null
  ) then
    raise exception 'One or more genres are invalid.';
  end if;

  insert into public.listener_profiles (
    user_id, listener_group, country_code, age_band, updated_at
  ) values (
    v_user_id, p_listener_group, p_country_code, p_age_band, now()
  )
  on conflict (user_id) do update set
    listener_group = excluded.listener_group,
    country_code = excluded.country_code,
    age_band = excluded.age_band,
    updated_at = excluded.updated_at;

  -- A profile has one audience role at a time. Remove responses that belong to
  -- the previous role so they cannot re-enter aggregates after a later switch.
  if p_listener_group = 'japan' then
    delete from public.ratings where user_id = v_user_id;
  else
    delete from public.recommendations where user_id = v_user_id;
  end if;

  delete from public.listener_genre_preferences
  where user_id = v_user_id;

  insert into public.listener_genre_preferences (user_id, genre_id)
  select v_user_id, selected.genre_id
  from (
    select distinct genre_id
    from unnest(p_genre_ids) as requested(genre_id)
  ) selected;
end;
$$;

revoke all on function public.save_listener_profile(text,text,text,smallint[]) from public, anon;
grant execute on function public.save_listener_profile(text,text,text,smallint[]) to authenticated;

drop policy if exists "users insert own rating" on public.ratings;
drop policy if exists "users update own rating" on public.ratings;
drop policy if exists "users delete own rating" on public.ratings;

create policy "users delete own rating"
on public.ratings for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "overseas listeners insert own rating"
on public.ratings for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'overseas'
      and profile.country_code <> 'JP'
  )
);

create policy "overseas listeners update own rating"
on public.ratings for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'overseas'
      and profile.country_code <> 'JP'
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'overseas'
      and profile.country_code <> 'JP'
  )
);

drop policy if exists "users insert own recommendation" on public.recommendations;
drop policy if exists "users update own recommendation" on public.recommendations;
drop policy if exists "users delete own recommendation" on public.recommendations;

create policy "users delete own recommendation"
on public.recommendations for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "japan listeners insert own recommendation"
on public.recommendations for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'japan'
      and profile.country_code = 'JP'
  )
);

create policy "japan listeners update own recommendation"
on public.recommendations for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'japan'
      and profile.country_code = 'JP'
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.listener_profiles profile
    where profile.user_id = (select auth.uid())
      and profile.listener_group = 'japan'
      and profile.country_code = 'JP'
  )
);

commit;
