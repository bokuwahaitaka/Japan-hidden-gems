begin;
revoke execute on function public.record_club_action(text,bigint),public.set_song_reaction(bigint,text) from anon;
commit;
