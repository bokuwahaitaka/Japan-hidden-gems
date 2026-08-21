const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";

const MIN_JAPAN_VOTES = 5;
const MIN_OVERSEAS_RESPONSES = 5;
const MIN_OVERSEAS_RATINGS = 3;

let songs = [];
let ratings = [];
let recommendations = [];
let audience = null;
let currentUser = null;
let accessToken = null;
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

function showStatus(message, type = "success", sticky = false) {
  if (!statusBar) return;
  statusBar.textContent = message;
  statusBar.className = `status ${type}`;

  clearTimeout(showStatus.timer);
  if (!sticky) {
    showStatus.timer = setTimeout(() => {
      statusBar.className = "status hidden";
    }, 3500);
  }
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

/* ---------- AUTH ---------- */

const SESSION_KEY = "jhg_supabase_session_v1";

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.msg ||
      data?.message ||
      data?.error_description ||
      data?.error ||
      `Auth request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

async function validateAccessToken(token) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) return null;
  return response.json();
}

async function refreshSession(refreshToken) {
  return authRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken })
  });
}

async function createAnonymousSession() {
  return authRequest("signup", {
    method: "POST",
    body: JSON.stringify({
      data: {},
      gotrue_meta_security: {
        captcha_token: null
      }
    })
  });
}
async function ensureAnonymousUser() {
  let stored = readSession();

  if (stored?.access_token) {
    const user = await validateAccessToken(stored.access_token);

    if (user?.id) {
      accessToken = stored.access_token;
      currentUser = user;
      return;
    }
  }

  if (stored?.refresh_token) {
    try {
      const refreshed = await refreshSession(stored.refresh_token);

      if (refreshed?.access_token && refreshed?.user?.id) {
        saveSession(refreshed);
        accessToken = refreshed.access_token;
        currentUser = refreshed.user;
        return;
      }
    } catch (error) {
      console.warn("Session refresh failed:", error);
      clearSession();
    }
  }

  const created = await createAnonymousSession();

  if (!created?.access_token || !created?.user?.id) {
    throw new Error("Anonymous sign-in returned no session.");
  }

  saveSession(created);
  accessToken = created.access_token;
  currentUser = created.user;
}

/* ---------- DATABASE ---------- */

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${options.authenticated ? accessToken : SUPABASE_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      data?.message ||
      data?.details ||
      data?.hint ||
      (typeof data === "string" ? data : "") ||
      `Database request failed (${response.status})`;

    throw new Error(detail);
  }

  return data;
}

async function loadAll() {
  if (!currentUser?.id)
    throw new Error("No anonymous user session.");

  const [songRows, ratingRows, recommendationRows] =
    await Promise.all([
      rest("songs?select=id,title,artist,year,youtube_url&order=id.asc"),
      rest("ratings?select=song_id,user_id,heard_before,rating"),
      rest("recommendations?select=song_id,user_id,recommended")
    ]);

  ratings = ratingRows ?? [];
  recommendations = recommendationRows ?? [];

  songs = (songRows ?? []).map((song) => {
    const songRatings =
      ratings.filter((row) => row.song_id === song.id);

    const songRecommendations =
      recommendations.filter((row) => row.song_id === song.id);

    const recommendationTotal = songRecommendations.length;

    const recommendationCount =
      songRecommendations.filter(
        (row) => row.recommended === true
      ).length;

    const overseasTotal = songRatings.length;

    const knownCount =
      songRatings.filter(
        (row) => row.heard_before === true
      ).length;

    const postListenRatings =
      songRatings.filter(
        (row) =>
          row.heard_before === false &&
          row.rating !== null
      );

    const averageRating =
      postListenRatings.length
        ? postListenRatings.reduce(
            (sum, row) => sum + Number(row.rating),
            0
          ) / postListenRatings.length
        : null;

    const japan =
      recommendationTotal
        ? (recommendationCount /
            recommendationTotal) *
          100
        : null;

    const awareness =
      overseasTotal
        ? (knownCount / overseasTotal) * 100
        : null;

    const overseas =
      averageRating !== null
        ? Number(averageRating.toFixed(2))
        : null;

    const score =
      japan !== null &&
      awareness !== null &&
      overseas !== null
        ? Number(
            (
              japan *
              (overseas / 5) *
              (1 - awareness / 100)
            ).toFixed(1)
          )
        : null;

    const provisional =
      recommendationTotal < MIN_JAPAN_VOTES ||
      overseasTotal < MIN_OVERSEAS_RESPONSES ||
      postListenRatings.length <
        MIN_OVERSEAS_RATINGS;

    const myRecommendation =
      songRecommendations.find(
        (row) =>
          row.user_id === currentUser.id
      ) ?? null;

    const myRating =
      songRatings.find(
        (row) =>
          row.user_id === currentUser.id
      ) ?? null;

    return {
      ...song,
      japan,
      awareness,
      overseas,
      score,
      provisional,
      recommendationTotal,
      overseasTotal,
      postListenRatingCount:
        postListenRatings.length,
      myRecommendation,
      myRating
    };
  });

  renderStats();
  render();
}

function renderStats() {
  $("#songCount").textContent = songs.length;
  $("#japanVoteCount").textContent =
    recommendations.length;
  $("#overseasResponseCount").textContent =
    ratings.length;
}

function metric(value, suffix = "") {
  return value === null
    ? "Collecting data"
    : `${Number(value.toFixed(1))}${suffix}`;
}

function safe(value, fallback) {
  return value === null || value === undefined
    ? fallback
    : value;
}

function getSortedSongs() {
  const sorted = [...songs];
  const mode = sortSelect?.value || "score";

  if (mode === "japan") {
    sorted.sort(
      (a, b) =>
        safe(b.japan, -1) -
        safe(a.japan, -1)
    );
  } else if (mode === "awareness") {
    sorted.sort(
      (a, b) =>
        safe(a.awareness, 101) -
        safe(b.awareness, 101)
    );
  } else if (mode === "rating") {
    sorted.sort(
      (a, b) =>
        safe(b.overseas, -1) -
        safe(a.overseas, -1)
    );
  } else {
    sorted.sort(
      (a, b) =>
        safe(b.score, -1) -
        safe(a.score, -1)
    );
  }

  return sorted;
}

function render() {
  const sortedSongs = getSortedSongs();

  if (!sortedSongs.length) {
    cards.innerHTML =
      '<p class="muted">No songs found.</p>';

    ratingSections.innerHTML = "";
    return;
  }

  cards.innerHTML = sortedSongs
    .map((song, index) => {
      const recommended =
        song.myRecommendation?.recommended;

      const scoreText =
        song.score === null
          ? "Pending"
          : song.score;

      const scoreSuffix =
        song.score === null
          ? ""
          : " / 100";

      return `
      <article class="card">
        <div class="rank">
          ${String(index + 1).padStart(2, "0")}
        </div>

        <div>
          <h3>${escapeHtml(song.title)}</h3>

          <div class="meta">
            ${escapeHtml(song.artist)} ·
            ${escapeHtml(song.year)}
          </div>

          <div class="metrics">
            <p>
              Japan recommendation:
              <strong>
                ${metric(song.japan, "%")}
              </strong>
            </p>

            <p>
              Overseas awareness:
              <strong>
                ${metric(song.awareness, "%")}
              </strong>
            </p>

            <p>
              Overseas post-listening rating:
              <strong>
                ${metric(song.overseas, " / 5")}
              </strong>
            </p>
          </div>

          <div class="score-row">
            <strong>${scoreText}</strong>

            <span>
              Hidden Gem Score${scoreSuffix}
            </span>

            ${
              song.score !== null &&
              song.provisional
                ? '<span class="badge">Provisional</span>'
                : ""
            }
          </div>

          <p class="sample-note">
            ${song.recommendationTotal}
            Japan votes ·
            ${song.overseasTotal}
            overseas responses ·
            ${song.postListenRatingCount}
            post-listening ratings
          </p>

          <div class="actions">

            <button
              class="action primary overseas-action"
              onclick="window.openRating(${song.id})">
              Listen & Rate
            </button>

            <button
              class="action japan-action ${
                recommended === true
                  ? "selected"
                  : ""
              }"
              onclick="window.submitRecommendation(${song.id}, true)">
              ${
                recommended === true
                  ? "Recommended ✓"
                  : "Recommend"
              }
            </button>

            <button
              class="action japan-action ${
                recommended === false
                  ? "selected"
                  : ""
              }"
              onclick="window.submitRecommendation(${song.id}, false)">
              ${
                recommended === false
                  ? "Not for me ✓"
                  : "Not for me"
              }
            </button>

          </div>
        </div>
      </article>
    `;
    })
    .join("");

  ratingSections.innerHTML =
    sortedSongs
      .map((song) => {
        const embed =
          youtubeEmbedUrl(song.youtube_url);

        const my = song.myRating;

        return `
      <section
        class="rating-section"
        data-song-id="${song.id}">

        <div class="rating-inner">

          <p class="eyebrow dark">
            RATE ${escapeHtml(song.title)}
          </p>

          <h2>
            Have you heard this song before?
          </h2>

          ${
            embed
              ? `
              <div class="preview">
                <iframe
                  src="${embed}"
                  title="${escapeHtml(song.title)}"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen>
                </iframe>
              </div>`
              : `
              <div class="no-preview">
                A listening preview has not been
                added for this song yet.
              </div>`
          }

          <div class="rating-actions">

            <button
              class="action ${
                my?.heard_before === true
                  ? "selected"
                  : ""
              }"
              onclick="window.submitRating(${song.id}, true, null)">

              ${
                my?.heard_before === true
                  ? "Yes, I knew it ✓"
                  : "Yes, I knew it"
              }

            </button>

          </div>

          <h3>
            If not, how would you rate it
            after listening?
          </h3>

          <div class="rating-actions">

            ${[1, 2, 3, 4, 5]
              .map(
                (value) => `
              <button
                class="action ${
                  my?.heard_before === false &&
                  Number(my.rating) === value
                    ? "selected"
                    : ""
                }"
                onclick="window.submitRating(${song.id}, false, ${value})">

                ${value}${
                  my?.heard_before === false &&
                  Number(my.rating) === value
                    ? " ✓"
                    : ""
                }

              </button>
            `
              )
              .join("")}

          </div>

          ${
            my
              ? `
              <p class="sample-note">
                Choosing again updates your
                previous response.
              </p>`
              : ""
          }

        </div>
      </section>
    `;
      })
      .join("");
}

async function withBusy(action) {
  if (busy) return;

  busy = true;

  document
    .querySelectorAll(".action")
    .forEach((button) => {
      button.disabled = true;
    });

  try {
    await action();
  } finally {
    busy = false;

    document
      .querySelectorAll(".action")
      .forEach((button) => {
        button.disabled = false;
      });
  }
}

async function submitRecommendation(
  songId,
  recommended
) {
  if (audience !== "japan") {
    showStatus(
      "Choose the Japan listener option first.",
      "error"
    );
    return;
  }

  await withBusy(async () => {
    try {
      const existing =
        recommendations.find(
          (row) =>
            row.user_id === currentUser.id &&
            row.song_id === songId
        );

      if (existing) {
        await rest(
          `recommendations?user_id=eq.${encodeURIComponent(
            currentUser.id
          )}&song_id=eq.${songId}`,
          {
            method: "PATCH",
            authenticated: true,
            headers: {
              Prefer: "return=minimal"
            },
            body: JSON.stringify({
              recommended,
              updated_at:
                new Date().toISOString()
            })
          }
        );
      } else {
        await rest("recommendations", {
          method: "POST",
          authenticated: true,
          headers: {
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            song_id: songId,
            recommended,
            updated_at:
              new Date().toISOString()
          })
        });
      }

      showStatus(
        "Your recommendation was saved."
      );

      await loadAll();
    } catch (error) {
      console.error(error);

      showStatus(
        `Could not save recommendation: ${error.message}`,
        "error"
      );
    }
  });
}

async function submitRating(
  songId,
  heardBefore,
  rating
) {
  if (audience !== "overseas") {
    showStatus(
      "Choose the outside-Japan listener option first.",
      "error"
    );
    return;
  }

  await withBusy(async () => {
    try {
      const existing =
        ratings.find(
          (row) =>
            row.user_id === currentUser.id &&
            row.song_id === songId
        );

      const payload = {
        heard_before: heardBefore,
        rating:
          heardBefore ? null : rating,
        updated_at:
          new Date().toISOString()
      };

      if (existing) {
        await rest(
          `ratings?user_id=eq.${encodeURIComponent(
            currentUser.id
          )}&song_id=eq.${songId}`,
          {
            method: "PATCH",
            authenticated: true,
            headers: {
              Prefer: "return=minimal"
            },
            body:
              JSON.stringify(payload)
          }
        );
      } else {
        await rest("ratings", {
          method: "POST",
          authenticated: true,
          headers: {
            Prefer: "return=minimal"
          },
          body: JSON.stringify({
            ...payload,
            user_id: currentUser.id,
            song_id: songId
          })
        });
      }

      showStatus(
        "Your response was saved."
      );

      await loadAll();
    } catch (error) {
      console.error(error);

      showStatus(
        `Could not save response: ${error.message}`,
        "error"
      );
    }
  });
}

function openRating(songId) {
  document
    .querySelector(
      `[data-song-id="${songId}"]`
    )
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function setAudience(
  type,
  scroll = true
) {
  audience = type;

  document.body.dataset.audience =
    type;

  localStorage.setItem(
    "japanHiddenGemsAudience",
    type
  );

  $("#japanListener")?.classList.toggle(
    "is-selected",
    type === "japan"
  );

  $("#overseasListener")?.classList.toggle(
    "is-selected",
    type === "overseas"
  );

  $("#changeAudienceBtn")
    ?.classList.remove("hidden");

  if (scroll) {
    (
      type === "japan"
        ? $("#ranking")
        : $("#ratingSections")
    )?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

function resetAudience() {
  audience = null;

  delete document.body.dataset.audience;

  localStorage.removeItem(
    "japanHiddenGemsAudience"
  );

  $("#japanListener")
    ?.classList.remove("is-selected");

  $("#overseasListener")
    ?.classList.remove("is-selected");

  $("#changeAudienceBtn")
    ?.classList.add("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function wireUi() {
  $("#japanListener")
    ?.addEventListener(
      "click",
      () => setAudience("japan")
    );

  $("#overseasListener")
    ?.addEventListener(
      "click",
      () => setAudience("overseas")
    );

  $("#changeAudienceBtn")
    ?.addEventListener(
      "click",
      resetAudience
    );

  const dialog =
    $("#aboutDialog");

  $("#aboutBtn")
    ?.addEventListener(
      "click",
      () => dialog?.showModal()
    );

  $("#closeDialog")
    ?.addEventListener(
      "click",
      () => dialog?.close()
    );

  sortSelect
    ?.addEventListener(
      "change",
      render
    );
}

window.submitRecommendation =
  submitRecommendation;

window.submitRating =
  submitRating;

window.openRating =
  openRating;

async function start() {
  wireUi();

  const savedAudience =
    localStorage.getItem(
      "japanHiddenGemsAudience"
    );

  if (
    savedAudience === "japan" ||
    savedAudience === "overseas"
  ) {
    setAudience(
      savedAudience,
      false
    );
  }

  try {
    showStatus(
      "Connecting securely…",
      "success",
      true
    );

    await ensureAnonymousUser();

    await loadAll();

    showStatus("Connected.");
  } catch (error) {
    console.error(error);

    cards.innerHTML =
      '<p class="muted">Could not load the site.</p>';

    showStatus(
      `Startup error: ${error.message}`,
      "error",
      true
    );
  }
}

start();
