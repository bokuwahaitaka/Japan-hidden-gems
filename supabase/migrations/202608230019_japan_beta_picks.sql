begin;

create table if not exists public.japan_beta_submissions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  song_ids bigint[] not null,
  note text not null default '',
  campaign_version text not null default 'prelaunch-v1',
  created_at timestamptz not null default now(),
  constraint japan_beta_exactly_five check (cardinality(song_ids)=5),
  constraint japan_beta_note_length check (char_length(note)<=280)
);

alter table public.japan_beta_submissions enable row level security;
create policy "users read own beta submission" on public.japan_beta_submissions for select to authenticated using ((select auth.uid())=user_id);

create or replace function public.submit_japan_beta_picks(p_song_ids bigint[], p_note text default '') returns integer
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_user uuid:=auth.uid(); v_song bigint;
begin
  if v_user is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.listener_profiles where user_id=v_user and listener_group='japan' and country_code='JP') then raise exception 'Only Japan-profile listeners can join.'; end if;
  if p_song_ids is null or cardinality(p_song_ids)<>5 or (select count(distinct x) from unnest(p_song_ids) x)<>5 then raise exception 'Choose exactly five different songs.'; end if;
  if char_length(coalesce(p_note,''))>280 then raise exception 'Message is too long.'; end if;
  if exists(select 1 from public.japan_beta_submissions where user_id=v_user) then raise exception 'Your five recommendations have already been submitted.'; end if;
  if (select count(*) from public.songs where id=any(p_song_ids) and not is_hidden)<>5 then raise exception 'One or more songs are unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtext(v_user::text));
  insert into public.japan_beta_submissions(user_id,song_ids,note) values(v_user,p_song_ids,trim(coalesce(p_note,'')));
  foreach v_song in array p_song_ids loop
    update public.recommendations set recommended=true,updated_at=now() where user_id=v_user and song_id=v_song;
    if not found then insert into public.recommendations(song_id,recommended,user_id) values(v_song,true,v_user); end if;
  end loop;
  return 5;
end; $$;

create or replace function public.get_japan_beta_campaign_status() returns table(participant_count bigint,pick_count bigint,target_count integer)
language sql stable security definer set search_path=public,pg_temp as $$ select count(*)::bigint,(count(*)*5)::bigint,100 from public.japan_beta_submissions $$;

revoke all on table public.japan_beta_submissions from public,anon;
grant select on table public.japan_beta_submissions to authenticated;
revoke all on function public.submit_japan_beta_picks(bigint[],text) from public,anon;
grant execute on function public.submit_japan_beta_picks(bigint[],text) to authenticated;
revoke all on function public.get_japan_beta_campaign_status() from public;
grant execute on function public.get_japan_beta_campaign_status() to authenticated;

commit;
