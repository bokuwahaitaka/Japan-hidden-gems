-- Document the intentional deny-by-default posture for internal-only tables.
begin;

drop policy if exists song_seed_metrics_deny_direct_access on public.song_seed_metrics;
create policy song_seed_metrics_deny_direct_access
on public.song_seed_metrics for all to anon,authenticated
using (false) with check (false);

drop policy if exists youtube_link_candidates_deny_direct_access on public.youtube_link_candidates;
create policy youtube_link_candidates_deny_direct_access
on public.youtube_link_candidates for all to anon,authenticated
using (false) with check (false);

-- These service-only AI maintenance RPCs had an obsolete authenticated grant
-- in production. Their bodies already reject non-service callers; remove the
-- unnecessary API exposure as defense in depth.
revoke execute on function public.save_ai_song_tags(bigint,jsonb,text) from authenticated;
revoke execute on function public.mark_ai_tag_failure(bigint,text) from authenticated;

commit;
