begin;

drop policy if exists league_votes_read on public.music_league_votes;
drop policy if exists league_votes_create on public.music_league_votes;
drop policy if exists league_votes_update on public.music_league_votes;

-- Ballots stay private during voting. A member can always read their own vote,
-- while the full result becomes visible only after the league is revealed.
create policy league_votes_read on public.music_league_votes
for select to authenticated
using (
  private.is_league_member(league_id, (select auth.uid()))
  and (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.music_leagues league
      where league.id = music_league_votes.league_id
        and league.status in ('revealed', 'archived')
    )
  )
);

create policy league_votes_create on public.music_league_votes
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_league_member(league_id, (select auth.uid()))
  and exists (
    select 1
    from public.music_leagues league
    where league.id = music_league_votes.league_id
      and league.status = 'voting'
  )
  and exists (
    select 1
    from public.music_league_entries entry
    where entry.id = music_league_votes.entry_id
      and entry.league_id = music_league_votes.league_id
  )
);

create policy league_votes_update on public.music_league_votes
for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.music_leagues league
    where league.id = music_league_votes.league_id and league.status = 'voting'
  )
)
with check (
  user_id = (select auth.uid())
  and private.is_league_member(league_id, (select auth.uid()))
  and exists (
    select 1 from public.music_leagues league
    where league.id = music_league_votes.league_id and league.status = 'voting'
  )
  and exists (
    select 1 from public.music_league_entries entry
    where entry.id = music_league_votes.entry_id and entry.league_id = music_league_votes.league_id
  )
);

commit;
