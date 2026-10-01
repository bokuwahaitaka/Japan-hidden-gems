# Overseas cult-discovery catalog (300 songs)

This manifest records the 300-song catalog batch loaded into production on
2026-08-24.

## Selection rules

- The song appears in an overseas-facing anime/music discovery dataset or
  community/editorial source.
- The stored video comes from an official, VEVO, label, or artist-owned
  YouTube channel.
- The source snapshot showed between 50,000 and 25,000,000 views, avoiding
  both effectively unknown uploads and the largest worldwide J-pop hits.
- Existing JHG title/artist pairs and YouTube video IDs were excluded.
- No more than three songs from one artist or one anime were selected.
- Every row has a direct watch URL and a deterministic YouTube thumbnail.

The machine-readable audit manifest is
`overseas-cult-official-mv-300.json`.

## Research inputs

- Reddit Japanese music communities:
  https://www.reddit.com/r/japanesemusic/
- Anime OP/ED metadata based on AnimeThemes and MyAnimeList:
  https://github.com/nonlooped/anime-op-ed-dataset
- The Guardian on Asian shoegaze:
  https://www.theguardian.com/music/2017/sep/13/how-shoegaze-took-over-asia
- The Guardian profile of Cuushe:
  https://www.theguardian.com/music/2012/oct/03/new-band-cuushe

## Production identifier

All inserted rows use:

```text
catalog_source = overseas-cult-official-mv-2026-08
```

This makes the batch auditable and removable without affecting user-added
songs. Hiding is preferred to deletion when a video later becomes unavailable.
