Japan Hidden Gems — clean practical v1

Use these files together:
- index.html
- styles.css
- app.js

Your Supabase database migration has already added:
- recommendations.user_id / updated_at
- ratings.user_id / updated_at
- songs.youtube_url
- RLS policies
- unique indexes for one response per user/song

Before testing:
1. Supabase Authentication > Sign In / Providers > Allow anonymous sign-ins = ON.
2. Replace index.html, styles.css, app.js together.
3. Commit all three.
4. Wait for GitHub Pages to deploy.
5. Reload the site.

Expected:
- Authentication > Users gets one anonymous user when the site loads.
- Songs return.
- Japan audience sees Recommend / Not for me.
- Outside-Japan audience sees Listen & Rate and per-song rating sections.
- Re-answering updates the same row rather than adding another vote.
