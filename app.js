import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

const MIN_JAPAN_VOTES = 5;
const MIN_OVERSEAS_RESPONSES = 5;
const MIN_OVERSEAS_RATINGS = 3;

let songs = [];
let currentUser = null;
let audience = null;
let busy = false;

const $ = (s) => document.querySelector(s);
const cards = $("#cards");
const ratingSections = $("#ratingSections");
const sortSelect = $("#sortSelect");
const statusBar = $("#statusBar");

function showStatus(message, type = "success") {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => statusBar.className = "status-bar hidden", 3500);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

function youtubeEmbedUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id = null;
    if (u.hostname.includes("youtu.be")) id = u.pathname.split("/").filter(Boolean)[0];
    if (u.hostname.includes("youtube.com")) {
      id = u.searchParams.get("v") || (u.pathname.startsWith("/shorts/") ? u.pathname.split("/")[2] : null) || (u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null);
    }
    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  } catch { return null; }
}

async function ensureAnonymousUser() {
  const { data: existing } = await supabase.auth.getSession();
  if (existing.session?.user) {
    currentUser = existing.session.user;
    return;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  currentUser = data.user;
}

async function loadAll() {
  cards.innerHTML = '<p class="loading">Loading songsâ¦</p>';

  const [songsResult, metricsResult, myRecResult, myRatingsResult] = await Promise.all([
    supabase.from("songs").select("id,title,artist,year,youtube_url").order("id", { ascending: true }),
    supabase.rpc("get_song_metrics"),
    supabase.from("recommendations").select("song_id,recommended"),
    supabase.from("ratings").select("song_id,heard_before,rating")
  ]);

  for (const result of [songsResult, metricsResult, myRecResult, myRatingsResult]) {
    if (result.error) throw result.error;
  }

  const metricsBySong = new Map((metricsResult.data ?? []).map((m) => [Number(m.song_id), m]));
  const recBySong = new Map((myRecResult.data ?? []).map((r) => [Number(r.song_id), r]));
  const ratingBySong = new Map((myRatingsResult.data ?? []).map((r) => [Number(r.song_id), r]));

  songs = (songsResult.data ?? []).map((song) => {
    const m = metricsBySong.get(Number(song.id)) ?? {};
    const japan = m.japan_pct == null ? null : Number(m.japan_pct);
    const awareness = m.awareness_pct == null ? null : Number(m.awareness_pct);
    const overseas = m.overseas_rating == null ? null : Number(m.overseas_rating);
    const score = japan !== null && awareness !== null && overseas !== null
      ? Number((japan * (overseas / 5) * (1 - awareness / 100)).toFixed(1))
      : null;

    const japanVotes = Number(m.japan_votes ?? 0);
    const overseasResponses = Number(m.overseas_responses ?? 0);
    const postListenRatings = Number(m.post_listen_ratings ?? 0);

    return {
      ...song,
      japan,
      awareness,
      overseas,
      score,
      japanVotes,
      overseasResponses,
      postListenRatings,
      isProvisional: japanVotes < MIN_JAPAN_VOTES || overseasResponses < MIN_OVERSEAS_RESPONSES || postListenRatings < MIN_OVERSEAS_RATINGS,
      myRecommendation: recBySong.get(Number(song.id)) ?? null,
      myRating: ratingBySong.get(Number(song.id)) ?? null
    };
  });

  renderStats();
  render();
}

function renderStats() {
  $("#songCount").textContent = songs.length;
  $("#japanVoteCount").textContent = songs.reduce((n, s) => n + s.japanVotes, 0);
  $("#overseasResponseCount").textContent = songs.reduce((n, s) => n + s.overseasResponses, 0);
}

function fallback(v, f) { return v == null ? f : v; }
function getSortedSongs() {
  const list = [...songs];
  const mode = sortSelect?.value || "score";
  if (mode === "japan") list.sort((a,b) => fallback(b.japan,-1) - fallback(a.japan,-1));
  else if (mode === "overseas") list.sort((a,b) => fallback(a.awareness,101) - fallback(b.awareness,101));
  else if (mode === "rating") list.sort((a,b) => fallback(b.overseas,-1) - fallback(a.overseas,-1));
  else list.sort((a,b) => fallback(b.score,-1) - fallback(a.score,-1));
  return list;
}

function metric(v, suffix = "") { return v == null ? "Collecting data" : `${Number(v.toFixed(1))}${suffix}`; }

function render() {
  const sorted = getSortedSongs();
  if (!sorted.length) {
    cards.innerHTML = '<p class="loading">No songs yet.</p>';
    ratingSections.innerHTML = "";
    return;
  }

  cards.innerHTML = sorted.map((s, i) => {
    const rec = s.myRecommendation?.recommended;
    return `
      <article class="card">
        <div class="rank">${String(i+1).padStart(2,"0")}</div>
        <div>
          <h3>${escapeHtml(s.title)}</h3>
          <div class="meta">${escapeHtml(s.artist)} Â· ${escapeHtml(s.year)}</div>
          <div class="meters">
            <p>Japan recommendation: <strong>${metric(s.japan,"%")}</strong></p>
            <p>Overseas awareness: <strong>${metric(s.awareness,"%")}</strong></p>
            <p>Overseas post-listening rating: <strong>${metric(s.overseas," / 5")}</strong></p>
          </div>
          <div class="score">
            <strong>${s.score == null ? "Pending" : s.score}</strong>
            <span>Hidden Gem Score${s.score == null ? "" : " / 100"}</span>
            ${s.score != null && s.isProvisional ? '<span class="provisional">Provisional</span>' : ""}
          </div>
          <p class="sample-note">${s.japanVotes} Japan vote${s.japanVotes===1?"":"s"} Â· ${s.overseasResponses} overseas response${s.overseasResponses===1?"":"s"} Â· ${s.postListenRatings} post-listening rating${s.postListenRatings===1?"":"s"}</p>
          <div class="card-actions">
            <button class="action-button primary-action overseas-action" onclick="window.openRating(${s.id})">Listen & Rate</button>
            <button class="action-button japan-action ${rec===true?"selected":""}" onclick="window.submitRecommendation(${s.id},true)">${rec===true?"Recommended â":"Recommend"}</button>
            <button class="action-button muted-action japan-action ${rec===false?"selected":""}" onclick="window.submitRecommendation(${s.id},false)">${rec===false?"Not for me â":"Not for me"}</button>
          </div>
        </div>
      </article>`;
  }).join("");

  ratingSections.innerHTML = sorted.map((s) => {
    const embed = youtubeEmbedUrl(s.youtube_url);
    const my = s.myRating;
    return `
      <section class="section rating-section" data-song-id="${s.id}">
        <p class="eyebrow dark">RATE ${escapeHtml(s.title)}</p>
        <h2>Have you heard this song before?</h2>
        ${embed ? `<div class="embed-wrap"><iframe src="${embed}" title="${escapeHtml(s.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : '<div class="no-preview">A listening preview has not been added for this song yet.</div>'}
        <div class="rating-actions">
          <button class="action-button ${my?.heard_before===true?"selected":""}" onclick="window.submitRating(${s.id},true,null)">${my?.heard_before===true?"Yes, I knew it â":"Yes, I knew it"}</button>
        </div>
        <h3>If not, how would you rate it after listening?</h3>
        <div class="rating-actions">
          ${[1,2,3,4,5].map((v) => `<button class="action-button ${my?.heard_before===false && Number(my.rating)===v?"selected":""}" onclick="window.submitRating(${s.id},false,${v})">${v}${my?.heard_before===false && Number(my.rating)===v?" â":""}</button>`).join("")}
        </div>
        ${my ? '<p class="sample-note">Choosing again updates your previous response.</p>' : ""}
      </section>`;
  }).join("");
}

async function withBusy(fn) {
  if (busy) return;
  busy = true;
  document.querySelectorAll(".card-actions button,.rating-actions button").forEach((b) => b.disabled = true);
  try { await fn(); }
  finally {
    busy = false;
    document.querySelectorAll(".card-actions button,.rating-actions button").forEach((b) => b.disabled = false);
  }
}

async function submitRecommendation(songId, recommended) {
  if (audience !== "japan") return showStatus("Choose the Japan listener option first.", "error");
  await withBusy(async () => {
    const { error } = await supabase.from("recommendations").upsert({
      user_id: currentUser.id,
      song_id: songId,
      recommended,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,song_id" });
    if (error) { console.error(error); return showStatus("Could not save your recommendation.", "error"); }
    showStatus("Your recommendation was saved.");
    await loadAll();
  });
}

async function submitRating(songId, heardBefore, rating) {
  if (audience !== "overseas") return showStatus("Choose the outside-Japan listener option first.", "error");
  await withBusy(async () => {
    const { error } = await supabase.from("ratings").upsert({
      user_id: currentUser.id,
      song_id: songId,
      heard_before: heardBefore,
      rating: heardBefore ? null : rating,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,song_id" });
    if (error) { console.error(error); return showStatus("Could not save your response.", "error"); }
    showStatus("Your response was saved.");
    await loadAll();
  });
}

function openRating(songId) {
  document.querySelector(`[data-song-id="${songId}"]`)?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function setAudience(type, shouldScroll = true) {
  audience = type;
  document.body.dataset.audience = type;
  localStorage.setItem("japanHiddenGemsAudience", type);
  $("#japanListener")?.classList.toggle("is-selected", type === "japan");
  $("#overseasListener")?.classList.toggle("is-selected", type === "overseas");
  $("#changeAudienceBtn")?.classList.remove("hidden");
  if (shouldScroll) (type === "japan" ? $("#ranking") : $("#ratingSections"))?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function resetAudience() {
  audience = null;
  delete document.body.dataset.audience;
  localStorage.removeItem("japanHiddenGemsAudience");
  $("#japanListener")?.classList.remove("is-selected");
  $("#overseasListener")?.classList.remove("is-selected");
  $("#changeAudienceBtn")?.classList.add("hidden");
  $("#audienceGate")?.scrollIntoView({ behavior:"smooth", block:"start" });
}

function wireUi() {
  $("#japanListener")?.addEventListener("click", () => setAudience("japan"));
  $("#overseasListener")?.addEventListener("click", () => setAudience("overseas"));
  $("#changeAudienceBtn")?.addEventListener("click", resetAudience);
  const dialog = $("#aboutDialog");
  $("#aboutBtn")?.addEventListener("click", () => dialog?.showModal());
  $("#closeDialog")?.addEventListener("click", () => dialog?.close());
  sortSelect?.addEventListener("change", render);
}

window.submitRecommendation = submitRecommendation;
window.submitRating = submitRating;
window.openRating = openRating;

async function start() {
  wireUi();
  const saved = localStorage.getItem("japanHiddenGemsAudience");
  if (saved === "japan" || saved === "overseas") setAudience(saved, false);
  try {
    await ensureAnonymousUser();
    await loadAll();
  } catch (error) {
    console.error(error);
    cards.innerHTML = '<p class="loading">Could not load the site.</p>';
    showStatus(String(error?.message || "").toLowerCase().includes("anonymous") ? "Enable Anonymous Sign-ins in Supabase Authentication." : "Could not connect to the database.", "error");
  }
}

start();
      



          
