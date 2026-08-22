const allowedOrigins = new Set([
  "https://bokuwahaitaka.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function corsHeaders(origin: string | null) {
  const allowed = origin && allowedOrigins.has(origin)
    ? origin
    : "https://bokuwahaitaka.github.io";

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Vary": "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

async function parseJson(response: Response) {
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(data?.message || data?.error?.message || String(data || response.status));
  }
  return data;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const authorization = req.headers.get("authorization");

  if (!supabaseUrl || !anonKey || !serviceKey || !geminiKey) {
    return json({ error: "Function secrets are incomplete." }, 500, origin);
  }

  if (!authorization?.startsWith("Bearer ")) {
    return json({ error: "Authorization required." }, 401, origin);
  }

  try {
    const userResponse = await fetch(supabaseUrl + "/auth/v1/user", {
      headers: { apikey: anonKey, Authorization: authorization },
    });
    const user = await parseJson(userResponse);

    const profileResponse = await fetch(
      supabaseUrl + "/rest/v1/listener_profiles?select=listener_group&user_id=eq." +
        encodeURIComponent(user.id) + "&limit=1",
      { headers: { apikey: anonKey, Authorization: authorization } },
    );
    const profiles = await parseJson(profileResponse);

    const adminResponse = await fetch(
      supabaseUrl + "/rest/v1/rpc/is_song_admin",
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: authorization,
          "Content-Type": "application/json",
        },
        body: "{}",
      },
    );
    const isAdmin = adminResponse.ok ? await adminResponse.json() : false;

    if (profiles?.[0]?.listener_group !== "japan" && isAdmin !== true) {
      return json({ error: "Only Japan profiles or administrators can tag songs." }, 403, origin);
    }

    const payload = await req.json();
    const videoId = String(payload?.videoId || "").trim();

    if (!/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) {
      return json({ error: "Invalid YouTube video ID." }, 400, origin);
    }

    const youtubeUrl = "https://www.youtube.com/watch?v=" + videoId;
    const songResponse = await fetch(
      supabaseUrl + "/rest/v1/songs?select=id,title,artist,year,youtube_url&youtube_url=eq." +
        encodeURIComponent(youtubeUrl) + "&order=id.desc&limit=1",
      { headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey } },
    );
    const songRows = await parseJson(songResponse);
    const song = songRows?.[0];

    if (!song) {
      return json({ error: "The requested song was not found." }, 404, origin);
    }

    const prompt = [
      "Classify this Japanese music video for a discovery-ranking website.",
      "Create useful, specific tags even when they do not yet exist.",
      "Return 4 to 10 tags total. Use only these categories: genre, era, mood, feature.",
      "Include at least one genre tag and one mood or feature tag.",
      "Use a lowercase ASCII kebab-case slug that is stable and reusable.",
      "Avoid artist names, song titles, promotional words, and uncertain claims.",
      "Use broad tags plus genuinely helpful fine-grained tags when supported by the metadata.",
      "",
      "Title: " + song.title,
      "Artist/channel: " + song.artist,
      "Year: " + (song.year || "unknown"),
      "YouTube video ID: " + videoId,
    ].join("\n");

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(geminiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                tags: {
                  type: "array",
                  minItems: 4,
                  maxItems: 10,
                  items: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["genre", "era", "mood", "feature"] },
                      slug: { type: "string" },
                      label_en: { type: "string" },
                      label_ja: { type: "string" },
                    },
                    required: ["category", "slug", "label_en", "label_ja"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["tags"],
              additionalProperties: false,
            },
          },
        }),
      },
    );
    const gemini = await parseJson(geminiResponse);
    const raw = gemini?.candidates?.[0]?.content?.parts?.[0]?.text;
    const generated = JSON.parse(raw || "{}");

    if (!Array.isArray(generated.tags) || generated.tags.length === 0) {
      throw new Error("Gemini returned no tags.");
    }

    const saveResponse = await fetch(supabaseUrl + "/rest/v1/rpc/save_ai_song_tags", {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: "Bearer " + serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_song_id: song.id,
        p_tags: generated.tags,
        p_model: model,
      }),
    });
    const savedCount = await parseJson(saveResponse);

    return json({ songId: song.id, savedCount, tags: generated.tags }, 200, origin);
  } catch (error) {
    console.error(error);
    return json(
      { error: error instanceof Error ? error.message : "Automatic tagging failed." },
      500,
      origin,
    );
  }
});
