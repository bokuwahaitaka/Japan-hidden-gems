-- Every browser flow establishes an anonymous Auth session before calling RPCs.
-- Remove legacy database-role `anon` access to definer functions so callers
-- cannot bypass authenticated RLS/session assumptions with only the API key.
begin;

revoke execute on function public.dismiss_personalized_song(bigint) from anon;
revoke execute on function public.get_community_feed(integer) from anon;
revoke execute on function public.get_demographic_filter_options() from anon;
revoke execute on function public.get_hidden_gem_data_segment(text,text,bigint) from anon;
revoke execute on function public.get_hidden_gem_data() from anon;
revoke execute on function public.get_hidden_song_ids() from anon;
revoke execute on function public.get_personalized_recommendations(integer) from anon;
revoke execute on function public.get_public_profile(text) from anon;
revoke execute on function public.get_public_song_tags() from anon;
revoke execute on function public.get_song_filter_tags() from anon;
revoke execute on function public.get_weekly_hidden_gems(integer) from anon;
revoke execute on function public.mark_ai_tag_failure(bigint,text) from anon;
revoke execute on function public.request_song(text,text,text,text) from anon;
revoke execute on function public.save_ai_song_tags(bigint,jsonb,text) from anon;
revoke execute on function public.submit_song_tag_report(bigint,text,text) from anon;

commit;
