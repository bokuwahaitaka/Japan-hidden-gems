import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

const MIN_JAPAN_VOTES = 5;
const MIN_OVERSEAS_RESPONSES = 5;
const MIN_OVERSEAS_RATINGS = 3;

let songs = [];
let ratings = [];
let recommendations = [];
let audience = null;
let currentUser = null;
let busy = false;

const $ = (selector) => document.querySelector(selector);
const cards = $("#cards");
const sortSelect = $("#sortSelect");
const ratingSections = $("#ratingSections");
const statusBar = $("#statusBar");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showStatus(message, type = "success") {
  statusBar.textContent = message;
  statusBar.className = `status ${type}`;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => {
    statusBar.className = "status hidden";
  }, 3200);
}

function youtubeEmbedUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    let id = null;

    if (parsed.hostname.includes("youtu.be")) {
      id = parsed.pathname.split("/").filter(Boolean)[0];
    } else if (parsed.hostname.includes("youtube.com")) {
      id = parsed.searchParams.get("v");

      if (!id && parsed.pathname.startsWith("/shorts/")) {
        id = parsed.pathname.split("/")[2];
      }

      if (!id && parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.split("/")[2];
      }
    }

    return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
  } catch {
    return null;
  }
}

async function ensureAnonymousUser() {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  if (sessionData.session?.user) {
    currentUser = sessionData.session.user;
    return;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;

  currentUser = data.user;
}

async function loadAll() {
  const [
    { data: songRows, error: songsError },
    { data: ratingRows, error: ratingsError },
    { data: recommendationRows, error: recommendationsError }
  ] = await Promise.all([
    supabase
      .from("songs")
      .select("id,title,artist,year,youtube_url")
      .order("id", { ascending: true }),

    supabase
      .from("ratings")
      .select("song_id,user_id,heard_before,rating"),

    supabase
      .from("recommendations")
      .select("song_id,user_id,recommended")
  ]);

  if (songsError) throw songsError;
  if (ratingsError) throw ratingsError;
  if (recommendationsError) throw recommendationsError;

  ratings = ratingRows ?? [];
  recommendations = recommendationRows ?? [];

  songs = (songRows ?? []).map((song) => {
    const songRatings = ratings.filter((row) => row.song_id === song.id);
    const songRecommendations = recommendations.filter((row) => row.song_id === song.id);

    const recommendationTotal = songRecommendations.length;
    const recommendationCount = songRecommendations.filter((row) => row.recommended === true).length;

    const overseasTotal = songRatings.length;
    const knownCount = songRatings.filter((row) => row.heard_before === true).length;

    const postListenRatings = songRatings.filter(
      (row) => row.heard_before === false && row.rating !== null
    );

    const averageRating = postListenRatings.length
      ? postListenRatings.reduce((sum, row) => sum + Number(row.rating), 0) / postListenRatings.length
      : null;

    const japan = recommendationTotal
      ? (recommendationCount / recommendationTotal) * 100
      : null;

    const awareness = overseasTotal
      ? (knownCount / overseasTotal) * 100
      : null;

    const overseas = averageRating !== null
      ? Number(averageRating.toFixed(2))
      : null;

    const score =
      japan !== null && awareness !== null && overseas !== null
        ? Number((japan * (overseas / 5) * (1 - awareness / 100)).toFixed(1))
        : null;

    const provisional =
      recommendationTotal < MIN_JAPAN_VOTES ||
      overseasTotal < MIN_OVERSEAS_RESPONSES ||
      postListenRatings.length < MIN_OVERSEAS_RATINGS;

    const myRecommendation = currentUser
      ? songRecommendations.find((row) => row.user_id === currentUser.id) ?? null
      : null;

    const myRating = currentUser
      ? songRatings.find((row) => row.user_id === currentUser.id) ?? null
      : null;

    return {
      ...song,
      japan,
      awareness,
      overseas,
      score,
      provisional,
      recommendationTotal,
      overseasTotal,
      postListenRatingCount: postListenRatings.length,
      myRecommendation,
      myRating
    };
  });

  renderStats();
  render();
}

function renderStats() {
  $("#songCount").textContent = songs.length;
  $("#japanVoteCount").textContent = recommendations.length;
  $("#overseasResponseCount").textContent = ratings.length;
}

function metric(value, suffix = "") {
  return value === null ? "Collecting data" : `${Number(value.toFixed(1))}${suffix}`;
}

function safe(value, fallback) {
  return value === null || value === undefined ? fallback : value;
}

function getSortedSongs() {
  const sorted = [...songs];
  const mode = sortSelect?.value || "score";

  if (mode === "japan") {
    sorted.sort((a, b) => safe(b.japan, -1) - safe(a.japan, -1));
  } else if (mode === "awareness") {
    sorted.sort((a, b) => safe(a.awareness, 101) - safe(b.awareness, 101));
  } else if (mode === "rating") {
    sorted.sort((a, b) => safe(b.overseas, -1) - safe(a.overseas, -1));
  } else {
    sorted.sort((a, b) => safe(b.score, -1) - safe(a.score, -1));
  }

  return sorted;
}

function render() {
  const sortedSongs = getSortedSongs();

  cards.innerHTML = sortedSongs.map((song, index) => {
    const recommended = song.myRecommendation?.recommended;
    const scoreText = song.score === null ? "Pending" : song.score;
    const scoreSuffix = song.score === null ? "" : " / 100";

    return `
      <article class="card">
        <div class="rank">${String(index + 1).padStart(2, "0")}</div>

        <div>
          <h3>${escapeHtml(song.title)}</h3>
          <div class="meta">${escapeHtml(song.artist)} · ${escapeHtml(song.year)}</div>

          <div class="metrics">
            <p>Japan recommendation: <strong>${metric(song.japan, "%")}</strong></p>
            <p>Overseas awareness: <strong>${metric(song.awareness, "%")}</strong></p>
            <p>Overseas post-listening rating: <strong>${metric(song.overseas, " / 5")}</strong></p>
          </div>

          <div class="score-row">
            <strong>${scoreText}</strong>
            <span>Hidden Gem Score${scoreSuffix}</span>
            ${song.score !== null && song.provisional ? '<span class="badge">Provisional</span>' : ""}
          </div>

          <p class="sample-note">
            ${song.recommendationTotal} Japan vote${song.recommendationTotal === 1 ? "" : "s"} ·
            ${song.overseasTotal} overseas response${song.overseasTotal === 1 ? "" : "s"} ·
            ${song.postListenRatingCount} post-listening rating${song.postListenRatingCount === 1 ? "" : "s"}
          </p>

          <div class="actions">
            <button class="action primary overseas-action"
              onclick="window.openRating(${song.id})">
              Listen & Rate
            </button>

            <button class="action japan-action ${recommended === true ? "selected" : ""}"
              onclick="window.submitRecommendation(${song.id}, true)">
              ${recommended === true ? "Recommended ✓" : "Recommend"}
            </button>

            <button class="action japan-action ${recommended === false ? "selected" : ""}"
              onclick="window.submitRecommendation(${song.id}, false)">
              ${recommended === false ? "Not for me ✓" : "Not for me"}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  ratingSections.innerHTML = sortedSongs.map((song) => {
    const embed = youtubeEmbedUrl(song.youtube_url);
    const my = song.myRating;

    return `
      <section class="rating-section" data-song-id="${song.id}">
        <div class="rating-inner">
          <p class="eyebrow dark">RATE ${escapeHtml(song.title)}</p>
          <h2>Have you heard this song before?</h2>

          ${
            embed
              ? `<div class="preview"><iframe src="${embed}" title="${escapeHtml(song.title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`
              : `<div class="no-preview">A listening preview has not been added for this song yet.</div>`
          }

          <div class="rating-actions">
            <button class="action ${my?.heard_before === true ? "selected" : ""}"
              onclick="window.submitRating(${song.id}, true, null)">
              ${my?.heard_before === true ? "Yes, I knew it ✓" : "Yes, I knew it"}
            </button>
          </div>

          <h3>If not, how would you rate it after listening?</h3>

          <div class="rating-actions">
            ${[1,2,3,4,5].map((value) => `
              <button class="action ${my?.heard_before === false && Number(my.rating) === value ? "selected" : ""}"
                onclick="window.submitRating(${song.id}, false, ${value})">
                ${value}${my?.heard_before === false && Number(my.rating) === value ? " ✓" : ""}
              </button>
            `).join("")}
          </div>

          ${my ? '<p class="sample-note">Choosing again updates your previous response.</p>' : ""}
        </div>
      </section>
    `;
  }).join("");
}

async function withBusy(action) {
  if (busy) return;
  busy = true;

  document.querySelectorAll(".action").forEach((button) => {
    button.disabled = true;
  });

  try {
    await action();
  } finally {
    busy = false;
    document.querySelectorAll(".action").forEach((button) => {
      button.disabled = false;
    });
  }
}

async function submitRecommendation(songId, recommended) {
  if (audience !== "japan") {
    showStatus("Choose the Japan listener option first.", "error");
    return;
  }

  await withBusy(async () => {
    const existing = recommendations.find(
      (row) => row.user_id === currentUser.id && row.song_id === songId
    );

    let result;

    if (existing) {
      result = await supabase
        .from("recommendations")
        .update({
          recommended,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", currentUser.id)
        .eq("song_id", songId);
    } else {
      result = await supabase
        .from("recommendations")
        .insert({
          user_id: currentUser.id,
          song_id: songId,
          recommended,
          updated_at: new Date().toISOString()
        });
    }

    if (result.error) {
      console.error(result.error);
      showStatus("Could not save your recommendation.", "error");
      return;
    }

    showStatus("Your recommendation was saved.");
    await loadAll();
  });
}

async function submitRating(songId, heardBefore, rating) {
  if (audience !== "overseas") {
    showStatus("Choose the outside-Japan listener option first.", "error");
    return;
  }

  await withBusy(async () => {
    const existing = ratings.find(
      (row) => row.user_id === currentUser.id && row.song_id === songId
    );

    const payload = {
      heard_before: heardBefore,
      rating: heardBefore ? null : rating,
      updated_at: new Date().toISOString()
    };

    let result;

    if (existing) {
      result = await supabase
        .from("ratings")
        .update(payload)
        .eq("user_id", currentUser.id)
        .eq("song_id", songId);
    } else {
      result = await supabase
        .from("ratings")
        .insert({
          ...payload,
          user_id: currentUser.id,
          song_id: songId
        });
    }

    if (result.error) {
      console.error(result.error);
      showStatus("Could not save your response.", "error");
      return;
    }

    showStatus("Your response was saved.");
    await loadAll();
  });
}

function openRating(songId) {
  document
    .querySelector(`[data-song-id="${songId}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setAudience(type, scroll = true) {
  audience = type;
  document.body.dataset.audience = type;
  localStorage.setItem("japanHiddenGemsAudience", type);

  $("#japanListener")?.classList.toggle("is-selected", type === "japan");
  $("#overseasListener")?.classList.toggle("is-selected", type === "overseas");
  $("#changeAudienceBtn")?.classList.remove("hidden");

  if (scroll) {
    (type === "japan" ? $("#ranking") : $("#ratingSections"))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function resetAudience() {
  audience = null;
  delete document.body.dataset.audience;
  localStorage.removeItem("japanHiddenGemsAudience");
  $("#japanListener")?.classList.remove("is-selected");
  $("#overseasListener")?.classList.remove("is-selected");
  $("#changeAudienceBtn")?.classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
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

  const savedAudience = localStorage.getItem("japanHiddenGemsAudience");
  if (savedAudience === "japan" || savedAudience === "overseas") {
    setAudience(savedAudience, false);
  }

  try {
    await ensureAnonymousUser();
    await loadAll();
  } catch (error) {
    console.error(error);
    cards.innerHTML = '<p class="muted">Could not load the site.</p>';
    showStatus(
      String(error?.message || "").toLowerCase().includes("anonymous")
        ? "Anonymous sign-in is not enabled in Supabase."
        : "Could not connect to Supabase.",
      "error"
    );
  }
}

start();
