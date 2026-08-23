begin;
create index if not exists japan_beta_picks_song_idx on public.japan_beta_picks(song_id);
create index if not exists japan_beta_picks_recommendation_idx on public.japan_beta_picks(recommendation_id) where recommendation_id is not null;
commit;
