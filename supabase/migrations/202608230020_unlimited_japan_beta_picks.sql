begin;

create table if not exists public.japan_beta_picks (
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id bigint not null references public.songs(id) on delete cascade,
  recommendation_id bigint references public.recommendations(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, song_id)
);

alter table public.japan_beta_picks enable row level security;
create policy "users read own japan beta picks" on public.japan_beta_picks for select to authenticated using ((select auth.uid())=user_id);
grant select on public.japan_beta_picks to authenticated;
revoke all on public.japan_beta_picks from anon;

create or replace function public.set_japan_beta_pick(p_song_id bigint,p_selected boolean) returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_owned_recommendation bigint; v_existing_recommendation bigint;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.listener_profiles where user_id=v_user and listener_group='japan' and country_code='JP') then raise exception 'Only Japan-profile listeners can join.'; end if;
  if not exists(select 1 from public.songs where id=p_song_id and not is_hidden) then raise exception 'Song is unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  if p_selected then
    if not exists(select 1 from public.japan_beta_picks where user_id=v_user and song_id=p_song_id) then
      select id into v_existing_recommendation from public.recommendations where user_id=v_user and song_id=p_song_id and recommended order by id limit 1;
      if v_existing_recommendation is null then
        insert into public.recommendations(song_id,recommended,user_id) values(p_song_id,true,v_user) returning id into v_owned_recommendation;
      end if;
      insert into public.japan_beta_picks(user_id,song_id,recommendation_id) values(v_user,p_song_id,v_owned_recommendation);
    end if;
  else
    delete from public.japan_beta_picks where user_id=v_user and song_id=p_song_id returning recommendation_id into v_owned_recommendation;
    if v_owned_recommendation is not null then delete from public.recommendations where id=v_owned_recommendation and user_id=v_user; end if;
  end if;
  return (select count(*)::integer from public.japan_beta_picks where user_id=v_user);
end; $$;

create or replace function public.get_japan_beta_campaign_status() returns table(participant_count bigint,pick_count bigint,target_count integer)
language sql stable security definer set search_path=public,pg_temp as $$ select count(distinct user_id)::bigint,count(*)::bigint,100 from public.japan_beta_picks $$;

revoke all on function public.set_japan_beta_pick(bigint,boolean) from public,anon;
grant execute on function public.set_japan_beta_pick(bigint,boolean) to authenticated;
revoke all on function public.get_japan_beta_campaign_status() from public,anon;
grant execute on function public.get_japan_beta_campaign_status() to authenticated;

commit;
