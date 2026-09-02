-- Resolve mechanically safe database-linter findings without changing access semantics.

create index if not exists artist_profiles_owner_user_id_idx on public.artist_profiles (owner_user_id);
create index if not exists curator_notifications_song_id_idx on public.curator_notifications (song_id);
create index if not exists daily_discovery_sessions_discovery_song_id_idx on public.daily_discovery_sessions (discovery_song_id);
create index if not exists listener_genre_preferences_genre_id_idx on public.listener_genre_preferences (genre_id);
create index if not exists music_league_entries_song_id_idx on public.music_league_entries (song_id);
create index if not exists music_league_entries_user_id_idx on public.music_league_entries (user_id);
create index if not exists music_league_votes_user_id_idx on public.music_league_votes (user_id);
create index if not exists music_leagues_owner_id_idx on public.music_leagues (owner_id);
create index if not exists personalization_feedback_song_id_idx on public.personalization_feedback (song_id);
create index if not exists ranking_predictions_song_id_idx on public.ranking_predictions (song_id);
create index if not exists recommendation_note_helpful_user_id_idx on public.recommendation_note_helpful (user_id);
create index if not exists referral_events_visitor_user_id_idx on public.referral_events (visitor_user_id);
create index if not exists song_data_suggestions_reviewed_by_idx on public.song_data_suggestions (reviewed_by);
create index if not exists song_data_suggestions_song_id_idx on public.song_data_suggestions (song_id);
create index if not exists song_data_suggestions_user_id_idx on public.song_data_suggestions (user_id);
create index if not exists song_discoveries_song_id_idx on public.song_discoveries (song_id);
create index if not exists song_guides_updated_by_idx on public.song_guides (updated_by);
create index if not exists song_localization_proposals_reviewed_by_idx on public.song_localization_proposals (reviewed_by);
create index if not exists song_localization_proposals_user_id_idx on public.song_localization_proposals (user_id);
create index if not exists song_localization_votes_user_id_idx on public.song_localization_votes (user_id);
create index if not exists song_localizations_updated_by_idx on public.song_localizations (updated_by);
create index if not exists song_preview_events_song_id_idx on public.song_preview_events (song_id);
create index if not exists song_reactions_user_id_idx on public.song_reactions (user_id);
create index if not exists song_tag_assignments_assigned_by_idx on public.song_tag_assignments (assigned_by);
create index if not exists song_tag_reports_resolved_by_idx on public.song_tag_reports (resolved_by);
create index if not exists song_tag_reports_user_id_idx on public.song_tag_reports (user_id);
create index if not exists songs_hidden_by_idx on public.songs (hidden_by);
create index if not exists taste_blends_owner_id_idx on public.taste_blends (owner_id);
create index if not exists v2_comment_reactions_user_id_idx on public.v2_comment_reactions (user_id);
create index if not exists v2_comments_user_id_idx on public.v2_comments (user_id);
create index if not exists youtube_link_candidates_reviewed_by_idx on public.youtube_link_candidates (reviewed_by);

alter policy users_read_own_tag_reports on public.song_tag_reports
  using ((select auth.uid()) = user_id);
alter policy users_read_own_personalization_feedback on public.personalization_feedback
  using ((select auth.uid()) = user_id);

alter policy v2_comments_update_own on public.v2_comments
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy v2_comments_delete_own on public.v2_comments
  using ((select auth.uid()) = user_id);
alter policy v2_comments_read_published on public.v2_comments
  using (status = 'published' or (select auth.uid()) = user_id);
alter policy v2_comments_insert_own on public.v2_comments
  with check ((select auth.uid()) = user_id);

alter policy v2_reactions_insert_own on public.v2_comment_reactions
  with check ((select auth.uid()) = user_id);
alter policy v2_reactions_delete_own on public.v2_comment_reactions
  using ((select auth.uid()) = user_id);

alter policy preview_events_own_select on public.song_preview_events
  using ((select auth.uid()) = user_id);
alter policy preview_events_own_insert on public.song_preview_events
  with check ((select auth.uid()) = user_id);
alter policy preview_events_own_update on public.song_preview_events
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy discoveries_own_select on public.song_discoveries
  using ((select auth.uid()) = user_id);
alter policy discoveries_own_insert on public.song_discoveries
  with check ((select auth.uid()) = user_id);
alter policy discoveries_own_update on public.song_discoveries
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy song_likes_own_select on public.song_likes
  using ((select auth.uid()) = user_id);
alter policy song_likes_own_insert on public.song_likes
  with check ((select auth.uid()) = user_id);
alter policy song_likes_own_delete on public.song_likes
  using ((select auth.uid()) = user_id);

alter policy song_awareness_own_select on public.song_awareness
  using ((select auth.uid()) = user_id);
alter policy song_awareness_own_insert on public.song_awareness
  with check ((select auth.uid()) = user_id);
alter policy song_awareness_own_update on public.song_awareness
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
alter policy song_awareness_own_delete on public.song_awareness
  using ((select auth.uid()) = user_id);

-- Merge equivalent permissive SELECT policies so each request evaluates one predicate.
drop policy if exists beta_errors_admin_read on public.beta_client_errors;
drop policy if exists beta_errors_own_read on public.beta_client_errors;
create policy beta_errors_read_own_or_admin on public.beta_client_errors
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_song_admin()));

drop policy if exists feedback_box_admin_read on public.feedback_box;
drop policy if exists feedback_box_read_own on public.feedback_box;
create policy feedback_box_read_own_or_admin on public.feedback_box
  for select to authenticated
  using ((select auth.uid()) = user_id or (select public.is_song_admin()));

-- The PUBLIC policy already includes anon, so the anon-only duplicate is redundant.
drop policy if exists "Anyone can read songs" on public.songs;
