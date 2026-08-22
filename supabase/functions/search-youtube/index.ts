const allowedOrigins = new Set([
  "https://bokuwahaitaka.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin) ? origin : "https://bokuwahaitaka.github.io";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  const headers = { ...corsHeaders(origin), "Content-Type": "application/json" };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }

  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Missing authentication.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const youtubeKey = Deno.env.get("YOUTUBE_API_KEY");

    if (!supabaseUrl || !anonKey || !youtubeKey) {
      throw new Error("Server configuration is incomplete.");
    }

    const userResponse = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: authHeader },
    });

    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: "Invalid session." }), { status: 401, headers });
    }

    const user = await userResponse.json();

    const profileResponse = await fetch(
      supabaseUrl + "/rest/v1/listener_profiles?select=listener_group,country_code&user_id=eq." +
        encodeURIComponent(user.id),
      { headers: { apikey: anonKey, Authorization: authHeader } },
    );

    const profiles = await profileResponse.json();
    const profile = profiles?.[0];

    if (!profileResponse.ok || profile?.listener_group !== "japan" || profile?.country_code !== "JP") {
      return new Response(
        JSON.stringify({ error: "Only Japan-profile listeners can search for songs." }),
        { status: 403, headers },
      );
    }

    const query = new URL(request.url).searchParams.get("q")?.trim() || "";

    if (query.length < 2 || query.length > 100) {
      return new Response(
        JSON.stringify({ error: "Enter a song title between 2 and 100 characters." }),
        { status: 400, headers },
      );
    }

    const params = new URLSearchParams({
      key: youtubeKey,
      part: "snippet",
      type: "video",
      q: query,
      maxResults: "3",
      order: "relevance",
      regionCode: "JP",
      relevanceLanguage: "ja",
      safeSearch: "strict",
      videoCategoryId: "10",
      videoEmbeddable: "true",
      videoSyndicated: "true",
    });

    const youtubeResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/search?" + params.toString(),
    );
    const youtubeData = await youtubeResponse.json();

    if (!youtubeResponse.ok) {
      console.error("YouTube API error", youtubeData);
      return new Response(
        JSON.stringify({ error: "YouTube search is temporarily unavailable." }),
        { status: 502, headers },
      );
    }

    const items = (youtubeData.items || []).map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail:
        item.snippet.thumbnails?.medium?.url ||
        item.snippet.thumbnails?.default?.url ||
        "",
    }));

    return new Response(JSON.stringify({ items }), { status: 200, headers });
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unexpected error." }),
      { status: 500, headers },
    );
  }
});
