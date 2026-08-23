import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const origins = new Set(["https://bokuwahaitaka.github.io", "http://localhost:8000", "http://127.0.0.1:8000"]);
const cors = (origin: string | null) => ({"Access-Control-Allow-Origin":origin && origins.has(origin) ? origin : "https://bokuwahaitaka.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Vary":"Origin"});
const reply = (body: unknown, status: number, origin: string | null) => new Response(JSON.stringify(body), {status, headers:{...cors(origin),"Content-Type":"application/json"}});

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors(origin)});
  if (request.method !== "POST") return reply({error:"Method not allowed."},405,origin);
  try {
    const authorization = request.headers.get("authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!authorization.startsWith("Bearer ") || !supabaseUrl || !anonKey) return reply({error:"Authentication required."},401,origin);
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anonKey,authorization}});
    if (!userResponse.ok) return reply({error:"Invalid session."},401,origin);
    const user = await userResponse.json();
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/listener_profiles?select=listener_group,country_code&user_id=eq.${encodeURIComponent(user.id)}`,{headers:{apikey:anonKey,authorization}});
    const profiles = await profileResponse.json();
    if (!profileResponse.ok || profiles?.[0]?.listener_group !== "japan" || profiles?.[0]?.country_code !== "JP") return reply({error:"日本プロフィールの利用者だけが曲を追加できます。"},403,origin);
    const body = await request.json();
    const url = String(body?.url || "");
    if (!/^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(url)) return reply({error:"有効なYouTube動画リンクではありません。"},400,origin);
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,{headers:{"User-Agent":"JapanHiddenGems/2.0"}});
    if (!response.ok) return reply({error:"公開されている動画情報を取得できません。公式MVのリンクを確認してください。"},422,origin);
    const data = await response.json();
    return reply({title:String(data.title || "").slice(0,300),authorName:String(data.author_name || "").slice(0,200),thumbnailUrl:String(data.thumbnail_url || "")},200,origin);
  } catch (error) { console.error(error); return reply({error:"動画情報の確認に失敗しました。"},500,origin); }
});
