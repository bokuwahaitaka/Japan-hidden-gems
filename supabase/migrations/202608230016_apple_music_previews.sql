begin;

alter table public.songs
  add column if not exists apple_track_id bigint,
  add column if not exists apple_music_url text,
  add column if not exists apple_preview_url text,
  add column if not exists apple_artwork_url text,
  add column if not exists apple_preview_status text not null default 'pending',
  add column if not exists apple_match_confidence numeric(4,3),
  add column if not exists apple_preview_checked_at timestamptz;

alter table public.songs drop constraint if exists songs_preview_provider_check;
alter table public.songs add constraint songs_preview_provider_check
  check (preview_provider in ('apple', 'youtube', 'external'));

alter table public.songs drop constraint if exists songs_apple_preview_status_check;
alter table public.songs add constraint songs_apple_preview_status_check
  check (apple_preview_status in ('pending', 'matched', 'review', 'unavailable', 'failed'));

alter table public.songs drop constraint if exists songs_apple_match_confidence_check;
alter table public.songs add constraint songs_apple_match_confidence_check
  check (apple_match_confidence is null or apple_match_confidence between 0 and 1);

create index if not exists songs_apple_preview_backfill_idx
  on public.songs (apple_preview_status, id)
  where is_hidden = false and apple_preview_status in ('pending', 'failed');

commit;
