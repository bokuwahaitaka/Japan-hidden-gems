begin;

-- Every non-Japanese locale gets a safe, script-neutral baseline immediately.
-- Official/community localized names can replace these rows later.
insert into public.song_localizations (
  song_id,
  locale,
  localized_title,
  localized_artist,
  cultural_note,
  source,
  updated_at
)
select
  song.id,
  locale.code,
  song.title_en,
  song.artist_en,
  '',
  'admin',
  now()
from public.songs song
cross join (values ('en'), ('ko'), ('zh'), ('ru'), ('es'), ('fr')) as locale(code)
where nullif(btrim(song.title_en), '') is not null
  and nullif(btrim(song.artist_en), '') is not null
on conflict (song_id, locale) do nothing;

commit;
