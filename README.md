# Japan Hidden Gems — Prototype

A static MVP for a cross-cultural Japanese music discovery platform.

## What this version includes
- Hidden Gem ranking cards
- Prototype scoring formula
- Japan recommendation / overseas awareness / overseas post-listening rating
- Blind-listening survey UI mockup
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
1. Replace sample songs with a real survey dataset.
2. Add Supabase/Firebase/Postgres for responses.
3. Add country, age-band and genre preference fields.
4. Use authorized Spotify/Apple Music/YouTube embeds where terms allow.
5. Add anti-spam / duplicate-vote controls.
6. Compute confidence intervals, not just raw averages.
7. Deploy to Vercel, Netlify, Cloudflare Pages, or GitHub Pages.
