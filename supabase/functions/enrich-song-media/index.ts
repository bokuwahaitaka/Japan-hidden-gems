import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set(["https://bokuwahaitaka.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
const agent = "Mozilla/5.0 (compatible; JapanHiddenGems/3.0; +https://bokuwahaitaka.github.io/Japan-hidden-gems/)";
const headersFor = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://bokuwahaitaka.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json", "Vary": "Origin",
});

function normalize(value: string) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ja")
    .replace(/&amp;/g, " and ").replace(/[\[\]【】「」『』()（）]/g, " ")
    .replace(/\b(official|music video|mv|pv|audio|lyrics?|topic)\b/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function tokens(value: string) { return normalize(value).split(/\s+/).filter((x) => x.length > 1); }
function coverage(parts: string[], value: string) {
  if (!parts.length) return 0;
  const haystack = normalize(value);
  return parts.filter((part) => haystack.includes(part)).length / parts.length;
}
function textOf(value: any) { return String(value?.simpleText || value?.runs?.map((x: any) => x.text).join("") || ""); }
function findRenderers(value: any, output: any[] = []) {
  if (!value || typeof value !== "object") return output;
  if (value.videoRenderer) output.push(value.videoRenderer);
  for (const child of Object.values(value)) findRenderers(child, output);
  return output;
}
function initialData(html: string) {
  for (const marker of ["var ytInitialData = ", "ytInitialData = "]) {
    const start = html.indexOf(marker);
    if (start < 0) continue;
    const jsonStart = html.indexOf("{", start + marker.length);
    if (jsonStart < 0) continue;
    let depth = 0, quoted = false, escaped = false;
    for (let i = jsonStart; i < html.length; i += 1) {
      const char = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') quoted = true;
      else if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) return JSON.parse(html.slice(jsonStart, i + 1));
    }
  }
  throw new Error("YouTube search page format was not recognized.");
}
function score(song: any, renderer: any) {
  const title = textOf(renderer.title), channel = textOf(renderer.ownerText || renderer.shortBylineText);
  const wantedTitles = [song.title, song.title_en].filter(Boolean);
  const wantedArtists = [song.artist, song.artist_en].filter(Boolean);
  const titleCoverage = Math.max(...wantedTitles.map((value) => coverage(tokens(value), title)), 0);
  const artistCoverage = Math.max(
    ...wantedArtists.flatMap((value) => [coverage(tokens(value), title), coverage(tokens(value), channel)]),
    0,
  );
  const normalizedChannel = normalize(channel);
  const exactArtistChannel = wantedArtists.some((value) => normalize(value) === normalizedChannel);
  const verifiedArtist = JSON.stringify(renderer.ownerBadges || renderer.badges || []).includes("VERIFIED");
  const officialMarker = /official|\btopic\b|vevo|sony music|universal music|warner music|avex|victor entertainment|nippon columbia|king records|ponycanyon|lantis|toys factory|j storm/i.test(channel);
  const officialChannel = officialMarker || verifiedArtist || exactArtistChannel;
  const officialTitle = /official|music video|\bmv\b|\bpv\b/i.test(title);
  const wantedText = wantedTitles.join(" ");
  const bad = /cover|karaoke|reaction|tutorial|instrumental|nightcore|sped up|slowed|remix/i.test(title) && !/cover|karaoke|instrumental|remix/i.test(wantedText);
  const live = /\blive\b/i.test(title) && !/\blive\b/i.test(wantedText);
  let value = titleCoverage * .54 + artistCoverage * .34 + (officialChannel ? .09 : 0) + (officialTitle ? .03 : 0);
  if (bad) value -= .4;
  if (live) value -= .15;
  const signals = [officialChannel && "official-channel", officialTitle && "official-title", titleCoverage >= .8 && "title-match", artistCoverage >= .8 && "artist-match"].filter(Boolean);
  return {
    value: Math.max(0, Math.min(1, value)),
    title,
    channel,
    signals,
    officialChannel,
    officialMarker,
    verifiedArtist,
    exactArtistChannel,
    titleCoverage,
    artistCoverage,
    disqualified: bad || live,
  };
}
async function json(response: Response) {
  const body = await response.text(); let data: any;
  try { data = body ? JSON.parse(body) : null; } catch { data = body; }
  if (!response.ok) throw new Error(data?.message || data?.error || body || "Request failed.");
  return data;
}
async function fetchSearch(query: string) {
  const url = "https://www.youtube.com/results?hl=ja&gl=JP&search_query=" + encodeURIComponent(query);
  const response = await fetch(url, { headers: { "User-Agent": agent, "Accept-Language": "ja,en;q=0.8", Cookie: "CONSENT=YES+cb.20210328-17-p0.en+FX+410" } });
  if (!response.ok) throw new Error("YouTube public search returned HTTP " + response.status);
  return findRenderers(initialData(await response.text())).filter((x) => /^[A-Za-z0-9_-]{11}$/.test(x.videoId || ""));
}
async function playable(videoId: string) {
  // oEmbed is public, keyless and quota-free. It avoids false LOGIN_REQUIRED
  // responses that YouTube sometimes gives server-side watch-page requests.
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + videoId)}&format=json`,
    { headers: { "User-Agent": agent, "Accept-Language": "en" } },
  );
  return response.ok;
}

Deno.serve(async (request) => {
  const responseHeaders = headersFor(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: responseHeaders });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers: responseHeaders });
  try {
    const authHeader = request.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!authHeader.startsWith("Bearer ") || !supabaseUrl || !anonKey || !serviceKey) throw new Error("Server configuration is incomplete.");
    const isAdmin = await json(await fetch(supabaseUrl + "/rest/v1/rpc/is_song_admin", { method: "POST", headers: { apikey: anonKey, Authorization: authHeader, "Content-Type": "application/json" }, body: "{}" }));
    if (isAdmin !== true) return new Response(JSON.stringify({ error: "Administrator access required." }), { status: 403, headers: responseHeaders });
    const payload = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(10, Number(payload?.limit) || 10));
    const minId = Number.isFinite(Number(payload?.minId)) ? Number(payload.minId) : null;
    const maxId = Number.isFinite(Number(payload?.maxId)) ? Number(payload.maxId) : null;
    // Defaults to the full backfill so the already-deployed older admin button also starts the queue.
    const runAll = payload?.runAll !== false;
    let songsUrl = supabaseUrl + "/rest/v1/songs?select=id,title,artist,title_en,artist_en&is_hidden=eq.false&youtube_url=is.null&media_enrichment_status=eq.pending&order=id.asc&limit=" + limit;
    if (minId !== null) songsUrl += "&id=gte." + encodeURIComponent(minId);
    if (maxId !== null) songsUrl += "&id=lt." + encodeURIComponent(maxId);
    const songs = await json(await fetch(songsUrl, { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } }));
    let updated = 0, review = 0, failed = 0;
    for (const song of songs || []) {
      try {
        const queries = [
          [song.artist, song.title, song.artist_en, song.title_en, "official"],
          [song.artist, song.title, song.artist_en, song.title_en, "Topic"],
        ].map((parts) => parts.filter(Boolean).join(" "));
        const groups = await Promise.all(queries.map((query) => fetchSearch(query)));
        const seen = new Set<string>();
        const candidates = groups.flatMap((group) =>
          group.slice(0, 12).map((renderer, searchRank) => ({ renderer, searchRank, ...score(song, renderer) }))
        ).filter((candidate) => {
          const videoId = candidate.renderer.videoId;
          if (seen.has(videoId)) return false;
          seen.add(videoId);
          return true;
        });
        const ranked = [...candidates].sort((a, b) => b.value - a.value);
        const strict = ranked.find((x) => x.value >= .55 && x.signals.includes("title-match") && x.signals.includes("artist-match") && x.officialChannel && !x.disqualified);
        // Japanese uploads often use kanji/kana while the seed catalog is romanized.
        // In that case, trust only the first label/verified/artist-owned result from the precise query.
        const scriptFallback = candidates.find((x) =>
          x.searchRank <= 3 && x.officialChannel && !x.disqualified &&
          (x.officialMarker || x.verifiedArtist || x.exactArtistChannel) &&
          (x.titleCoverage >= .8 || x.artistCoverage >= .8 || x.officialMarker)
        );
        const best = strict || scriptFallback;
        if (!best || !(await playable(best.renderer.videoId))) {
          await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, { method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" }, body: JSON.stringify({ media_enrichment_status: "review", media_source: "youtube-public-search" }) });
          review += 1; continue;
        }
        const videoId = best.renderer.videoId, youtubeUrl = "https://www.youtube.com/watch?v=" + videoId;
        const confidence = Number(Math.max(best.value, strict ? best.value : .86).toFixed(3));
        if (confidence >= .84) {
          const update = await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, { method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify({ youtube_url: youtubeUrl, youtube_video_id: videoId, youtube_thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, youtube_status: "valid", youtube_checked_at: new Date().toISOString(), media_enrichment_status: "ready", media_match_confidence: confidence, media_source: "youtube-public-search", media_enriched_at: new Date().toISOString() }) });
          if (!update.ok) throw new Error(await update.text());
          updated += 1;
        } else {
          const candidate = await fetch(supabaseUrl + "/rest/v1/youtube_link_candidates?on_conflict=song_id,video_id", { method: "POST", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ song_id: song.id, video_id: videoId, youtube_url: youtubeUrl, video_title: best.title.slice(0, 500), channel_name: best.channel.slice(0, 300), confidence: Number(best.value.toFixed(3)), official_signals: best.signals, status: "pending", checked_at: new Date().toISOString() }) });
          if (!candidate.ok) throw new Error(await candidate.text());
          await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, { method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" }, body: JSON.stringify({ media_enrichment_status: "review", media_match_confidence: Number(best.value.toFixed(3)), media_source: "youtube-public-search" }) });
          review += 1;
        }
      } catch (error) {
        console.error("youtube-public-search", song.id, error); failed += 1;
        await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, { method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json" }, body: JSON.stringify({ media_enrichment_status: "review", media_source: "youtube-public-search-error" }) });
      }
      await new Promise((resolve) => setTimeout(resolve, 900));
    }
    const continuing = runAll && (songs || []).length > 0;
    if (continuing) {
      EdgeRuntime.waitUntil(fetch(supabaseUrl + "/functions/v1/enrich-song-media", {
        method: "POST",
        headers: { apikey: anonKey, Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ limit, runAll: true, minId, maxId })
      }).catch((error) => console.error("youtube-public-search-chain", error)));
    }
    return new Response(JSON.stringify({ processed: (songs || []).length, updated, review, failed, continuing, quotaStopped: false, method: "youtube-public-search" }), { headers: responseHeaders });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error." }), { status: 500, headers: responseHeaders });
  }
});
