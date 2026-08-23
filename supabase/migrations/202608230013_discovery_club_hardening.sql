begin;
create index if not exists community_activity_user_idx on public.community_activity(user_id,created_at desc);
create index if not exists community_activity_song_idx on public.community_activity(song_id,created_at desc);
create policy community_activity_no_direct_read on public.community_activity for select to authenticated using (false);
revoke execute on function public.get_discovery_club_feed(integer),public.get_song_reaction_summary(bigint),public.get_discovery_club_leaderboard(integer),public.get_region_discovery_challenge() from anon;
revoke execute on function public.record_club_action(text,bigint),public.set_song_reaction(bigint,text) from anon;
grant execute on function public.get_discovery_club_feed(integer),public.get_song_reaction_summary(bigint),public.get_discovery_club_leaderboard(integer),public.get_region_discovery_challenge() to authenticated;
create or replace function public.get_region_discovery_challenge()
returns table(region text,discovery_count bigint,reaction_count bigint,points bigint)
language sql stable security definer set search_path='' as $$
  select case
    when p.country_code='JP' then 'JP'
    when p.country_code in ('KR','CN','TW','HK','MO','MN') then 'EA'
    when p.country_code in ('US','CA','MX') then 'NA'
    when p.country_code in ('SG','MY','TH','VN','PH','ID','BN','KH','LA','MM','TL') then 'SE'
    when p.country_code in ('SA','AE','QA','KW','BH','OM','IL','JO','LB','TR','IR','IQ','YE') then 'ME'
    when p.country_code in ('IN','PK','BD','LK','NP','BT','MV','AF') then 'SA'
    when p.country_code in ('AU','NZ','FJ','PG') then 'OC'
    when p.country_code in ('BR','AR','CL','CO','PE','VE','UY','PY','BO','EC') then 'LA'
    when p.country_code in ('ZA','NG','EG','KE','MA','GH','TZ','ET') then 'AF'
    else 'EU' end,
    count(distinct e.song_id),count(distinct r.song_id),
    (count(distinct e.song_id)*3+count(distinct r.song_id))::bigint
  from public.listener_profiles p
  left join public.early_discoveries e on e.user_id=p.user_id and e.discovered_at>=date_trunc('week',now())
  left join public.song_reactions r on r.user_id=p.user_id and r.created_at>=date_trunc('week',now())
  group by 1 order by 4 desc limit 20;
$$;
revoke all on function public.get_region_discovery_challenge() from public,anon;
grant execute on function public.get_region_discovery_challenge() to authenticated;
commit;
