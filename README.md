# Japan Hidden Gems — Prototype

A static MVP for a cross-cultural Japanese music discovery platform.

## What this version includes
- Hidden Gem ranking cards
- Prototype scoring formula
- Japan recommendation / overseas awareness / overseas post-listening rating
- Blind-listening survey UI mockup
- Japan-listener song-title search with three YouTube candidates, automatic metadata, and duplicate checks
- Responsive mobile layout
- No copyrighted audio, artwork or lyrics

## Run locally
Open `index.html` in a browser.

For a local server:
```bash
python -m http.server 8000
```

Then open http://localhost:8000

## Next production steps
1. Add an admin moderation and removal workflow for user-submitted songs.
2. Improve YouTube metadata into normalized artist/title fields.
3. Use authorized Spotify/Apple Music embeds where terms allow.
4. Strengthen anti-spam controls beyond anonymous-user rate limits.
5. Compute confidence intervals, not just raw averages.


## YouTube title search setup

The title-search UI calls the Supabase Edge Function in
`supabase/functions/search-youtube`.

1. Enable YouTube Data API v3 in Google Cloud and create an API key.
2. Set the function secret: `YOUTUBE_API_KEY=<your key>`.
3. Deploy the function: `supabase functions deploy search-youtube`.
4. Keep the key server-side; never add it to `app.js`.
