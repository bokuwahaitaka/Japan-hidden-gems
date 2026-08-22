import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const allowedOrigins = new Set([
  "https://bokuwahaitaka.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin)
      ? origin : "https://bokuwahaitaka.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function normalize(value: string) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ja")
    .replace(/&amp;/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
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
  const candidate = normalize(item.snippet?.title || "");
  const channel = normalize(item.snippet?.channelTitle || "");
  const wantedTitle = normalize(song.title_en || song.title);
  const titleTokens = tokens(song.title_en || song.title);
  const artistTokens = tokens(song.artist_en || song.artist);
  let score = 0;

  if (wantedTitle && candidate.includes(wantedTitle)) score += 0.48;
  else score += coverage(titleTokens, candidate) * 0.38;

  score += Math.max(
    coverage(artistTokens, candidate),
    coverage(artistTokens, channel)
  ) * 0.34;

  if (/official|topic|vevo|records|music/.test(candidate + " " + channel)) score += 0.13;
  if (/music video|audio|mv|pv/.test(candidate)) score += 0.05;
  if (/cover|karaoke|reaction|tutorial|instrumental/.test(candidate) &&
      !/cover|karaoke|instrumental/.test(wantedTitle)) score -= 0.28;
  if (/live/.test(candidate) && !/live/.test(wantedTitle)) score -= 0.12;

  return Math.max(0, Math.min(1, score));
}

async function json(response: Response) {
  const text = await response.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || data?.error || text || "Request failed");
  return data;
}

Deno.serve(async (request) => {
  const headers = cors(request.headers.get("origin"));
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }

  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing authentication." }), { status: 401, headers });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const youtubeKey = Deno.env.get("YOUTUBE_API_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey || !youtubeKey) throw new Error("Server configuration is incomplete.");

    const adminResponse = await fetch(supabaseUrl + "/rest/v1/rpc/is_song_admin", {
      method: "POST",
      headers: { apikey: anonKey, Authorization: authHeader, "Content-Type": "application/json" },
      body: "{}",
    });
    const isAdmin = await json(adminResponse);
    if (isAdmin !== true) {
      return new Response(JSON.stringify({ error: "Administrator access required." }), { status: 403, headers });
    }

    const payload = await request.json().catch(() => ({}));
    const limit = Math.max(1, Math.min(20, Number(payload?.limit) || 20));
    const songs = await json(await fetch(
      supabaseUrl +
        "/rest/v1/songs?select=id,title,artist,title_en,artist_en&is_hidden=eq.false" +
        "&media_enrichment_status=in.(pending,failed)&order=id.asc&limit=" + limit,
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } },
    ));

    const matches: any[] = [];
    let quotaStopped = false;
    let firstError = "";

    for (const song of songs || []) {
      const query = [song.artist_en || song.artist, song.title_en || song.title, "official"].filter(Boolean).join(" ");
      const params = new URLSearchParams({
        key: youtubeKey,
        part: "snippet",
        type: "video",
        q: query,
        maxResults: "5",
        order: "relevance",
        regionCode: "JP",
        relevanceLanguage: "ja",
        safeSearch: "strict",
        videoCategoryId: "10",
        videoEmbeddable: "true",
        videoSyndicated: "true",
      });

      const searchResponse = await fetch("https://www.googleapis.com/youtube/v3/search?" + params);
      const searchData = await searchResponse.json();

      if (!searchResponse.ok) {
        const reason = searchData?.error?.errors?.[0]?.reason || "";
        firstError = searchData?.error?.message || "YouTube search failed.";
        if (/quota/i.test(reason + " " + firstError) || searchResponse.status === 403) {
          quotaStopped = true;
          break;
        }
        await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, {
          method: "PATCH",
          headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ media_enrichment_status: "failed", media_source: "youtube-data-api-v3" }),
        });
        continue;
      }

      const ranked = (searchData.items || [])
        .map((item: any) => ({ item, score: matchScore(song, item) }))
        .sort((a: any, b: any) => b.score - a.score);
      const best = ranked[0];

      if (!best || best.score < 0.48) {
        await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + song.id, {
          method: "PATCH",
          headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ media_enrichment_status: "review", media_match_confidence: best?.score || 0, media_source: "youtube-data-api-v3" }),
        });
        continue;
      }

      matches.push({
        song,
        videoId: best.item.id.videoId,
        channelId: best.item.snippet.channelId,
        thumbnail: best.item.snippet.thumbnails?.high?.url ||
          best.item.snippet.thumbnails?.medium?.url ||
          best.item.snippet.thumbnails?.default?.url || "",
        score: best.score,
      });
    }

    const avatarByChannel = new Map<string, string>();
    const channelIds = [...new Set(matches.map((match) => match.channelId).filter(Boolean))];
    for (let i = 0; i < channelIds.length; i += 50) {
      const params = new URLSearchParams({
        key: youtubeKey,
        part: "snippet",
        id: channelIds.slice(i, i + 50).join(","),
        maxResults: "50",
      });
      const data = await json(await fetch("https://www.googleapis.com/youtube/v3/channels?" + params));
      for (const item of data.items || []) {
        avatarByChannel.set(item.id,
          item.snippet?.thumbnails?.high?.url ||
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url || "");
      }
    }

    let updated = 0;
    for (const match of matches) {
      const response = await fetch(supabaseUrl + "/rest/v1/songs?id=eq." + match.song.id, {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: "Bearer " + serviceKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          youtube_url: "https://www.youtube.com/watch?v=" + match.videoId,
          youtube_video_id: match.videoId,
          youtube_channel_id: match.channelId,
          youtube_thumbnail_url: match.thumbnail,
          artist_image_url: avatarByChannel.get(match.channelId) || null,
          media_enrichment_status: "ready",
          media_match_confidence: Number(match.score.toFixed(3)),
          media_source: "youtube-data-api-v3",
          media_enriched_at: new Date().toISOString(),
        }),
      });
      if (response.ok) updated += 1;
    }

    const countRows = await json(await fetch(
      supabaseUrl + "/rest/v1/songs?select=id&is_hidden=eq.false&media_enrichment_status=in.(pending,failed)",
      {
        method: "HEAD",
        headers: {
          apikey: serviceKey,
          Authorization: "Bearer " + serviceKey,
          Prefer: "count=exact",
        },
      },
    ).catch(() => new Response("[]", { status: 200 })));

    return new Response(JSON.stringify({
      processed: (songs || []).length,
      updated,
      review: Math.max(0, (songs || []).length - updated),
      quotaStopped,
      firstError,
      pendingEstimate: Array.isArray(countRows) ? countRows.length : null,
    }), { status: 200, headers });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unexpected error.",
    }), { status: 500, headers });
  }
});