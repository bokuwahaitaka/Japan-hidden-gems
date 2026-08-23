import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://bokuwahaitaka.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://bokuwahaitaka.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function normalize(value: string) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ja")
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(value: string) {
  return normalize(value).split(/\s+/).filter((part) => part.length > 1);
}

function coverage(needles: string[], haystack: string) {
  if (!needles.length) return 0;
  const normalized = normalize(haystack);
  return needles.filter((token) => normalized.includes(token)).length / needles.length;
}

function matchScore(song: any, item: any) {
  const wantedTitle = normalize(song.title_en || song.title);
  const title = normalize(item.trackName || "");
  const artist = normalize(item.artistName || "");
  let score = wantedTitle && title === wantedTitle ? 0.62 : coverage(tokens(song.title_en || song.title), title) * 0.54;
  score += Math.max(
    coverage(tokens(song.artist_en || song.artist), artist),
    coverage(tokens(song.artist_en || song.artist), `${artist} ${item.collectionName || ""}`),
  ) * 0.38;
  if (item.kind === "song" && item.previewUrl && item.trackViewUrl) score += 0.05;
  return Math.max(0, Math.min(1, score));
}

async function parseJson(response: Response) {
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || text || "Request failed");
  return data;
}

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

Deno.serve(async (request) => {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Missing authentication." }), { status: 401, headers });
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Server configuration is incomplete.");

    const isAdmin = await parseJson(await fetch(supabaseUrl + "/rest/v1/rpc/is_song_admin", {
      method: "POST", headers: { apikey: anonKey, Authorization: authHeader, "Content-Type": "application/json" }, body: "{}",
    }));
    if (isAdmin !== true) return new Response(JSON.stringify({ error: "Administrator access required." }), { status: 403, headers });

    const payload = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(10, Number(payload?.limit) || 10));
    const songs = await parseJson(await fetch(
      supabaseUrl + "/rest/v1/songs?select=id,title,artist,title_en,artist_en&is_hidden=eq.false&apple_preview_status=in.(pending,failed)&order=id.asc&limit=" + limit,
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } },
    ));

    let updated = 0, review = 0, unavailable = 0, failed = 0;
    for (let index = 0; index < (songs || []).length; index += 1) {
      const song = songs[index];
      if (index > 0) await wait(3200);
      try {
        const params = new URLSearchParams({
          term: [song.artist_en || song.artist, song.title_en || song.title].filter(Boolean).join(" "),
          country: "JP", media: "music", entity: "song", limit: "5", lang: "ja_jp", explicit: "No",
        });
        const data = await parseJson(await fetch("https://itunes.apple.com/search?" + params));
        const ranked = (data.results || []).filter((item: any) => item.previewUrl && item.trackViewUrl)
          .map((item: any) => ({ item, score: matchScore(song, item) }))
          .sort((a: any, b: any) => b.score - a.score);
        const best = ranked[0];
        let changes: Record<string, unknown>;
        if (!best) {
          changes = { apple_preview_status: "unavailable", apple_match_confidence: null, apple_preview_checked_at: new Date().toISOString() };
          unavailable += 1;
        } else if (best.score < 0.72) {
          changes = { apple_preview_status: "review", apple_match_confidence: Number(best.score.toFixed(3)), apple_preview_checked_at: new Date().toISOString() };
          review += 1;
        } else {
          const artwork = String(best.item.artworkUrl100 || "").replace(/100x100bb/, "600x600bb");
          changes = {
            apple_track_id: best.item.trackId, apple_music_url: best.item.trackViewUrl,
            apple_preview_url: best.item.previewUrl, apple_artwork_url: artwork || null,
            apple_preview_status: "matched", apple_match_confidence: Number(best.score.toFixed(3)),
            apple_preview_checked_at: new Date().toISOString(), preview_provider: "apple",
          };
          updated += 1;
        }
        await parseJson(await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, {
          method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(changes),
        }));
      } catch (error) {
        failed += 1;
        await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, {
          method: "PATCH", headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ apple_preview_status: "failed", apple_preview_checked_at: new Date().toISOString() }),
        });
        console.error("Apple preview enrichment failed", song.id, error);
      }
    }

    return new Response(JSON.stringify({ processed: (songs || []).length, updated, review, unavailable, failed }), { status: 200, headers });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error." }), { status: 500, headers });
  }
});
