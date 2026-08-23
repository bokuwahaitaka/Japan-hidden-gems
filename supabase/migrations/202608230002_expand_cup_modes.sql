-- Expanded Cup filters and anonymous aggregate leaderboard.
alter table public.tournament_runs drop constraint if exists tournament_runs_mode_check;
alter table public.tournament_runs add constraint tournament_runs_mode_check check (mode in ('random','tag','decade','artist','challenge'));
alter table public.tournament_runs drop constraint if exists tournament_runs_mode_tag_check;
alter table public.tournament_runs add constraint tournament_runs_mode_tag_check check ((mode='tag' and tag_id is not null) or (mode<>'tag' and tag_id is null));
create or replace function public.get_cup_champion_leaderboard(p_limit integer default 10)
returns table(song_id bigint,win_count bigint)
language sql stable security definer set search_path=''
as $$
 select tr.champion_song_id,count(*)::bigint
 from public.tournament_runs tr
 where tr.status='completed' and tr.champion_song_id is not null
 group by tr.champion_song_id
 order by count(*) desc,tr.champion_song_id
 limit greatest(1,least(coalesce(p_limit,10),50));
$$;
revoke all on function public.get_cup_champion_leaderboard(integer) from public,anon;
grant execute on function public.get_cup_champion_leaderboard(integer) to authenticated;
