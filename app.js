const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";

const MIN_JAPAN_VOTES = 5;
const MIN_OVERSEAS_RESPONSES = 5;
const MIN_OVERSEAS_RATINGS = 3;

let songs = [];
let audience = null;
let currentUser = null;
let accessToken = null;
let busy = false;
let listenerProfile = null;
let genreOptions = [];
let selectedGenreIds = [];
let demographicOptions = [];
let selectedCountry = null;
let selectedAgeBand = null;
let songTagOptions = [];
let selectedSongTag = null;

const $ = (selector) => document.querySelector(selector);

const cards = $("#cards");
const sortSelect = $("#sortSelect");
const ratingSections = $("#ratingSections");
const statusBar = $("#statusBar");
const countryFilter = $("#countryFilter");
const ageFilter = $("#ageFilter");
const songTagFilter = $("#songTagFilter");

const SESSION_KEY = "jhg_supabase_session_v1";

/* =========================
   GENERAL
========================= */

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function showStatus(
  message,
  type = "success",
  sticky = false
) {
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


function ui(en, ja) {
  return audience === "japan" ? ja : en;
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function applyInterfaceLanguage(type = audience) {
  const ja = type === "japan";
  document.documentElement.lang = ja ? "ja" : "en";
  const copy = {
    "#aboutBtn": ["How it works", "仕組み"],
    "#heroEyebrow": ["CROSS-CULTURAL MUSIC DISCOVERY", "日本の隠れた名曲を世界へ"],
    "#heroTitle": ["Japanese songs the world hasn’t found yet.", "まだ世界に知られていない日本の名曲を届けよう。"],
    "#heroLead": ["Japanese listeners recommend songs. Overseas listeners tell us whether they already knew them, then rate them after listening.", "海外の人に聴いてほしい日本の曲を推薦してください。海外リスナーの認知度と視聴後評価から、隠れた名曲を発見します。"],
    "#audienceEyebrow": ["CHOOSE YOUR ROLE", "利用方法を選択"],
    "#audienceTitle": ["How are you listening?", "どちらとして参加しますか？"],
    "#japanRoleTitle": ["I’m listening from Japan", "日本から参加する"],
    "#japanRoleCopy": ["Recommend songs you think deserve more attention overseas.", "海外の人にもっと聴いてほしい曲を推薦します。"],
    "#overseasRoleTitle": ["I’m listening from outside Japan", "日本国外から参加する"],
    "#overseasRoleCopy": ["Discover J-pop you haven't heard yet. Tell us if you knew a song, then rate it after listening.", "まだ知らないJ-POPを見つけ、聴く前の認知度と視聴後の評価を教えてください。"],
    "#changeAudienceBtn": ["Change audience", "参加方法を変更"],
    "#songCountLabel": ["songs", "曲"],
    "#japanVoteLabel": ["Japan votes", "日本からの投票"],
    "#overseasResponseLabel": ["overseas responses", "海外からの回答"],
    "#rankingEyebrow": ["DISCOVERY GAP RANKING", "海外との認知ギャップランキング"],
    "#rankingTitle": ["Hidden Gem Index", "隠れた名曲ランキング"],
    "#countryFilterLabel": ["Country", "国別"],
    "#ageFilterLabel": ["Age band", "年齢別"],
    "#songTagFilterLabel": ["Song tag", "曲のタグ"],
    "#rankingCopy": ["Hidden Gem Score = Japan Recommendation × (Overseas Rating ÷ 5) × (1 − Overseas Awareness).", "隠れた名曲スコア ＝ 日本での推薦率 ×（海外での評価 ÷ 5）×（1 − 海外での認知度）"],
    "#requestEyebrow": ["ADD A HIDDEN GEM", "曲を推薦"],
    "#requestTitle": ["Recommend a song to the world.", "海外の人に聴いてほしい曲を推薦しよう。"],
    "#requestCopy": ["Enter a song title, choose the correct video from three YouTube results, and add it to the ranking immediately.", "曲名を入力し、YouTubeの候補3件から正しい動画を選んでください。選んだ曲はすぐランキングに追加されます。"],
    "#songSearchLabel": ["Song title", "曲名"],
    "#songSearchSubmit": ["Search", "YouTubeで検索"],
    "#requestLimitCopy": ["Check the title and channel before choosing a video.", "選択前に動画名とチャンネルを確認してください。"]
  };
  Object.entries(copy).forEach(([selector, values]) => setText(selector, ja ? values[1] : values[0]));
  const input = $("#songSearchTitle");
  if (input) input.placeholder = ja ? "例：プラスティック・ラブ" : "e.g. Plastic Love";
  renderDemographicOptions();
  if (songs.length) render();
}

function youtubeEmbedUrl(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    let id = null;

    if (parsed.hostname.includes("youtu.be")) {
      id =
        parsed.pathname
          .split("/")
          .filter(Boolean)[0];
    }

    if (parsed.hostname.includes("youtube.com")) {
      id = parsed.searchParams.get("v");

      if (
        !id &&
        parsed.pathname.startsWith("/shorts/")
      ) {
        id =
          parsed.pathname.split("/")[2];
      }

      if (
        !id &&
        parsed.pathname.startsWith("/embed/")
      ) {
        id =
          parsed.pathname.split("/")[2];
      }
    }

    return id
      ? `https://www.youtube.com/embed/${encodeURIComponent(id)}`
      : null;
  } catch {
    return null;
  }
}

/* =========================
   AUTH
========================= */

function saveSession(session) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify(session)
  );
}

function readSession() {
  try {
    return JSON.parse(
      localStorage.getItem(SESSION_KEY) || "null"
    );
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function authRequest(
  path,
  options = {}
) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/${path}`,
    {
      ...options,

      headers: {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    }
  );

  const text = await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
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
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/user`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!response.ok) {
    return null;
  }

  return response.json();
}

async function refreshSession(
  refreshToken
) {
  return authRequest(
    "token?grant_type=refresh_token",
    {
      method: "POST",

      body: JSON.stringify({
        refresh_token: refreshToken
      })
    }
  );
}

async function createAnonymousSession() {
  return authRequest(
    "signup",
    {
      method: "POST",

      body: JSON.stringify({
        data: {},
        gotrue_meta_security: {
          captcha_token: null
        }
      })
    }
  );
}

async function ensureAnonymousUser() {
  const stored =
    readSession();

  if (stored?.access_token) {
    const user =
      await validateAccessToken(
        stored.access_token
      );

    if (user?.id) {
      accessToken =
        stored.access_token;

      currentUser =
        user;

      return;
    }
  }

  if (stored?.refresh_token) {
    try {
      const refreshed =
        await refreshSession(
          stored.refresh_token
        );

      if (
        refreshed?.access_token &&
        refreshed?.user?.id
      ) {
        saveSession(refreshed);

        accessToken =
          refreshed.access_token;

        currentUser =
          refreshed.user;

        return;
      }
    } catch (error) {
      console.warn(
        "Session refresh failed:",
        error
      );

      clearSession();
    }
  }

  const created =
    await createAnonymousSession();

  if (
    !created?.access_token ||
    !created?.user?.id
  ) {
    throw new Error(
      "Anonymous sign-in returned no session."
    );
  }

  saveSession(created);

  accessToken =
    created.access_token;

  currentUser =
    created.user;
}

/* =========================
   SUPABASE REST
========================= */

async function rest(
  path,
  options = {}
) {
  const authenticated =
    options.authenticated === true;

  const {
    authenticated: ignored,
    ...fetchOptions
  } = options;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...fetchOptions,

      headers: {
        apikey: SUPABASE_KEY,

        Authorization:
          `Bearer ${
            authenticated
              ? accessToken
              : SUPABASE_KEY
          }`,

        "Content-Type":
          "application/json",

        ...(fetchOptions.headers || {})
      }
    }
  );

  const text =
    await response.text();

  let data = null;

  try {
    data =
      text
        ? JSON.parse(text)
        : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const detail =
      data?.message ||
      data?.details ||
      data?.hint ||
      (
        typeof data === "string"
          ? data
          : ""
      ) ||
      `Database request failed (${response.status})`;

    throw new Error(detail);
  }

  return data;
}


/* =========================
   LISTENER PROFILE
========================= */

const AGE_BANDS = {
  under_18: "Under 18",
  "18_24": "18–24",
  "25_34": "25–34",
  "35_44": "35–44",
  "45_54": "45–54",
  "55_64": "55–64",
  "65_plus": "65+",
  prefer_not_to_say: "Prefer not to say"
};

async function loadListenerProfile() {
  const [profiles, preferences, genres] = await Promise.all([
    rest(
      "listener_profiles?select=user_id,listener_group,country_code,age_band&user_id=eq." +
        encodeURIComponent(currentUser.id),
      { authenticated: true }
    ),
    rest(
      "listener_genre_preferences?select=genre_id&user_id=eq." +
        encodeURIComponent(currentUser.id),
      { authenticated: true }
    ),
    rest(
      "genres?select=id,slug,label_en&is_active=eq.true&order=sort_order.asc",
      { authenticated: true }
    )
  ]);

  listenerProfile = profiles?.[0] ?? null;
  selectedGenreIds = (preferences ?? []).map((row) => Number(row.genre_id));
  genreOptions = genres ?? [];

  if (listenerProfile) {
    setAudience(listenerProfile.listener_group, false);
  }
}

function renderProfileForm(group) {
  applyInterfaceLanguage(group);

  const dialog = $("#profileDialog");
  const country = $("#profileCountry");
  const ageBand = $("#profileAgeBand");
  const genreList = $("#profileGenres");

  $("#profileGroup").value = group;
  $("#profileTitle").textContent =
    group === "japan"
      ? "日本のリスナー情報"
      : "Tell us where you’re listening from";

  country.value =
    listenerProfile?.listener_group === group
      ? listenerProfile.country_code
      : group === "japan"
        ? "JP"
        : "";

  country.readOnly = group === "japan";

  ageBand.innerHTML =
    '<option value="">Choose an age band</option>' +
    Object.entries(AGE_BANDS)
      .map(([value, label]) =>
        '<option value="' + escapeHtml(value) + '">' +
        escapeHtml(label) + "</option>"
      )
      .join("");

  ageBand.value = listenerProfile?.age_band ?? "";

  genreList.innerHTML = genreOptions
    .map((genre) => {
      const checked = selectedGenreIds.includes(Number(genre.id));
      return '<label class="genre-option">' +
        '<input type="checkbox" name="profileGenre" value="' +
        Number(genre.id) + '"' + (checked ? " checked" : "") + ">" +
        "<span>" + escapeHtml(genre.label_en) + "</span></label>";
    })
    .join("");

  $("#profileError").textContent = "";
  dialog.showModal();
}

function openProfileDialog(group = listenerProfile?.listener_group || "overseas") {
  renderProfileForm(group);
}

async function saveListenerProfile(event) {
  event.preventDefault();

  const group = $("#profileGroup").value;
  const countryCode = $("#profileCountry").value.trim().toUpperCase();
  const ageBand = $("#profileAgeBand").value;
  const genreIds = [...document.querySelectorAll('input[name="profileGenre"]:checked')]
    .map((input) => Number(input.value));

  const error = $("#profileError");

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    error.textContent = "Enter a two-letter country code, such as JP, US, GB or KR.";
    return;
  }

  if ((group === "japan" && countryCode !== "JP") ||
      (group === "overseas" && countryCode === "JP")) {
    error.textContent =
      group === "japan"
        ? "The Japan listener option uses country code JP."
        : "Choose Japan as your role if your country code is JP.";
    return;
  }

  if (!AGE_BANDS[ageBand]) {
    error.textContent = "Choose an age band.";
    return;
  }

  if (genreIds.length < 1 || genreIds.length > 5) {
    error.textContent = "Choose between 1 and 5 genres.";
    return;
  }

  await withBusy(async () => {
    try {
      await rest("listener_profiles?on_conflict=user_id", {
        method: "POST",
        authenticated: true,
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          user_id: currentUser.id,
          listener_group: group,
          country_code: countryCode,
          age_band: ageBand,
          updated_at: new Date().toISOString()
        })
      });

      await rest(
        "listener_genre_preferences?user_id=eq." +
          encodeURIComponent(currentUser.id),
        {
          method: "DELETE",
          authenticated: true,
          headers: { Prefer: "return=minimal" }
        }
      );

      await rest("listener_genre_preferences", {
        method: "POST",
        authenticated: true,
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(
          genreIds.map((genreId) => ({
            user_id: currentUser.id,
            genre_id: genreId
          }))
        )
      });

      listenerProfile = {
        user_id: currentUser.id,
        listener_group: group,
        country_code: countryCode,
        age_band: ageBand
      };
      selectedGenreIds = genreIds;
      setAudience(group);
      $("#profileDialog").close();
      showStatus("Your anonymous profile was saved.");
    } catch (saveError) {
      console.error(saveError);
      error.textContent = "Could not save your profile: " + saveError.message;
    }
  });
}


/* =========================
   DEMOGRAPHIC FILTERS
========================= */

async function loadDemographicOptions() {
  const [demographics, tags] =
    await Promise.all([
      rest(
        "rpc/get_demographic_filter_options",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({})
        }
      ),
      rest(
        "rpc/get_song_filter_tags",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({})
        }
      )
    ]);

  demographicOptions = demographics ?? [];
  songTagOptions = tags ?? [];

  renderDemographicOptions();
}

function renderDemographicOptions() {
  if (!countryFilter || !ageFilter) return;

  const countries =
    demographicOptions.filter(
      (option) =>
        option.filter_type === "country"
    );

  const ages =
    demographicOptions.filter(
      (option) =>
        option.filter_type === "age"
    );

  countryFilter.innerHTML =
    '<option value="">' +
      ui("All countries", "すべての国") +
    "</option>" +
    countries
      .map(
        (option) =>
          '<option value="' +
          escapeHtml(option.value) +
          '">' +
          escapeHtml(option.label) +
          " (" +
          Number(option.respondent_count) +
          ")" +
          "</option>"
      )
      .join("");

  ageFilter.innerHTML =
    '<option value="">' +
      ui("All ages", "すべての年齢") +
    "</option>" +
    ages
      .map(
        (option) =>
          '<option value="' +
          escapeHtml(option.value) +
          '">' +
          escapeHtml(
            ui(
              option.label_en,
              option.label_ja
            )
          ) +
          " (" +
          Number(option.respondent_count) +
          ")" +
          "</option>"
      )
      .join("");

  countryFilter.value =
    selectedCountry ?? "";

  ageFilter.value =
    selectedAgeBand ?? "";

  if (songTagFilter) {
    songTagFilter.innerHTML =
      '<option value="">' +
        ui("All tags", "すべてのタグ") +
      "</option>" +
      songTagOptions.map((tag) =>
        '<option value="' + Number(tag.id) + '">' +
        escapeHtml(ui(tag.label_en, tag.label_ja)) +
        " · " + escapeHtml(ui(tag.category_en, tag.category_ja)) +
        "</option>"
      ).join("");
    songTagFilter.value = selectedSongTag ?? "";
  }
}

async function applyCountryFilter() {
  selectedCountry =
    countryFilter.value || null;

  if (selectedCountry) {
    selectedAgeBand = null;
    ageFilter.value = "";
  }

  await loadAll();
}

async function applySongTagFilter() {
  selectedSongTag =
    songTagFilter.value
      ? Number(songTagFilter.value)
      : null;

  await loadAll();
}

async function applyAgeFilter() {
  selectedAgeBand =
    ageFilter.value || null;

  if (selectedAgeBand) {
    selectedCountry = null;
    countryFilter.value = "";
  }

  await loadAll();
}

/* =========================
   LOAD AGGREGATED DATA
========================= */

async function loadAll() {
  if (!currentUser?.id) {
    throw new Error(
      "No anonymous user session."
    );
  }

  const [rows, hiddenRows] =
    await Promise.all([
      rest(
        "rpc/get_hidden_gem_data_segment",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({
            p_country_code: selectedCountry,
            p_age_band: selectedAgeBand,
            p_tag_id: selectedSongTag
          })
        }
      ),
      rest(
        "rpc/get_hidden_song_ids",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({})
        }
      )
    ]);

  const hiddenSongIds =
    new Set(
      (hiddenRows ?? []).map(
        (row) => Number(row.id)
      )
    );

  songs =
    (rows ?? [])
      .filter(
        (row) =>
          !hiddenSongIds.has(
            Number(row.id)
          )
      )
      .map((row) => {
      const recommendationTotal =
        Number(
          row.recommendation_total ?? 0
        );

      const recommendationCount =
        Number(
          row.recommendation_count ?? 0
        );

      const overseasTotal =
        Number(
          row.overseas_total ?? 0
        );

      const knownCount =
        Number(
          row.known_count ?? 0
        );

      const postListenRatingCount =
        Number(
          row.post_listen_rating_count ?? 0
        );

      const averageRating =
        row.average_rating === null
          ? null
          : Number(
              row.average_rating
            );

      const japan =
        recommendationTotal > 0
          ? (
              recommendationCount /
              recommendationTotal
            ) * 100
          : null;

      const awareness =
        overseasTotal > 0
          ? (
              knownCount /
              overseasTotal
            ) * 100
          : null;

      const overseas =
        averageRating !== null
          ? Number(
              averageRating.toFixed(2)
            )
          : null;

      const score =
        japan !== null &&
        awareness !== null &&
        overseas !== null
          ? Number(
              (
                japan *
                (overseas / 5) *
                (
                  1 -
                  awareness / 100
                )
              ).toFixed(1)
            )
          : null;

      const provisional =
        recommendationTotal <
          MIN_JAPAN_VOTES ||
        overseasTotal <
          MIN_OVERSEAS_RESPONSES ||
        postListenRatingCount <
          MIN_OVERSEAS_RATINGS;

      const myRecommendation =
        row.my_recommended === null
          ? null
          : {
              recommended:
                row.my_recommended
            };

      const myRating =
        row.my_heard_before === null &&
        row.my_rating === null
          ? null
          : {
              heard_before:
                row.my_heard_before,

              rating:
                row.my_rating
            };

      return {
        id:
          row.id,

        title:
          row.title,

        artist:
          row.artist,

        year:
          row.year,

        youtube_url:
          row.youtube_url,

        japan,
        awareness,
        overseas,
        score,
        provisional,

        recommendationTotal,
        overseasTotal,
        postListenRatingCount,

        myRecommendation,
        myRating
      };
    });

  renderStats();
  render();
}

/* =========================
   STATS
========================= */

function renderStats() {
  const japanVotes =
    songs.reduce(
      (sum, song) =>
        sum +
        song.recommendationTotal,
      0
    );

  const overseasResponses =
    songs.reduce(
      (sum, song) =>
        sum +
        song.overseasTotal,
      0
    );

  $("#songCount").textContent =
    songs.length;

  $("#japanVoteCount").textContent =
    japanVotes;

  $("#overseasResponseCount").textContent =
    overseasResponses;
}

/* =========================
   SORT
========================= */

function metric(
  value,
  suffix = ""
) {
  return value === null
    ? "Collecting data"
    : `${
        Number(
          value.toFixed(1)
        )
      }${suffix}`;
}

function safe(
  value,
  fallback
) {
  return (
    value === null ||
    value === undefined
  )
    ? fallback
    : value;
}

function getSortedSongs() {
  const sorted =
    [...songs];

  const mode =
    sortSelect?.value ||
    "score";

  if (mode === "japan") {
    sorted.sort(
      (a, b) =>
        safe(
          b.japan,
          -1
        ) -
        safe(
          a.japan,
          -1
        )
    );
  }

  else if (
    mode === "awareness"
  ) {
    sorted.sort(
      (a, b) =>
        safe(
          a.awareness,
          101
        ) -
        safe(
          b.awareness,
          101
        )
    );
  }

  else if (
    mode === "rating"
  ) {
    sorted.sort(
      (a, b) =>
        safe(
          b.overseas,
          -1
        ) -
        safe(
          a.overseas,
          -1
        )
    );
  }

  else {
    sorted.sort(
      (a, b) =>
        safe(
          b.score,
          -1
        ) -
        safe(
          a.score,
          -1
        )
    );
  }

  return sorted;
}

/* =========================
   RENDER CARDS
========================= */

function render() {
  const sortedSongs =
    getSortedSongs();

  if (!sortedSongs.length) {
    cards.innerHTML =
      '<p class="muted">No songs found.</p>';

    ratingSections.innerHTML =
      "";

    return;
  }

  cards.innerHTML =
    sortedSongs
      .map(
        (
          song,
          index
        ) => {
          const recommended =
            song
              .myRecommendation
              ?.recommended;

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
                ${
                  String(
                    index + 1
                  ).padStart(
                    2,
                    "0"
                  )
                }
              </div>

              <div>

                <h3>
                  ${
                    escapeHtml(
                      song.title
                    )
                  }
                </h3>

                <div class="meta">
                  ${escapeHtml(song.artist)}
                  ${song.year ? " · " + escapeHtml(song.year) : ""}
                </div>

                <div class="metrics">

                  <p>
                    Japan recommendation:
                    <strong>
                      ${
                        metric(
                          song.japan,
                          "%"
                        )
                      }
                    </strong>
                  </p>

                  <p>
                    Overseas awareness:
                    <strong>
                      ${
                        metric(
                          song.awareness,
                          "%"
                        )
                      }
                    </strong>
                  </p>

                  <p>
                    Overseas post-listening rating:
                    <strong>
                      ${
                        metric(
                          song.overseas,
                          " / 5"
                        )
                      }
                    </strong>
                  </p>

                </div>

                <div class="score-row">

                  <strong>
                    ${scoreText}
                  </strong>

                  <span>
                    Hidden Gem Score
                    ${scoreSuffix}
                  </span>

                  ${
                    song.score !== null &&
                    song.provisional
                      ? `
                        <span class="badge">
                          Provisional
                        </span>
                      `
                      : ""
                  }

                </div>

                <p class="sample-note">
                  ${
                    song.recommendationTotal
                  }
                  Japan votes
                  ·
                  ${
                    song.overseasTotal
                  }
                  overseas responses
                  ·
                  ${
                    song.postListenRatingCount
                  }
                  post-listening ratings
                </p>

                <div class="actions">

                  <button
                    class="action primary overseas-action"
                    onclick="window.openRating(${song.id})"
                  >
                    Listen & Rate
                  </button>

                  <button
                    class="action japan-action ${
                      recommended === true
                        ? "selected"
                        : ""
                    }"
                    onclick="window.submitRecommendation(${song.id}, true)"
                  >
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
                    onclick="window.submitRecommendation(${song.id}, false)"
                  >
                    ${
                      recommended === false
                        ? "Not for me ✓"
                        : "Not for me"
                    }
                  </button>

                  <button
                    class="action"
                    onclick="window.reportSongTags(${song.id})"
                  >
                    ${ui("Report tags", "タグの誤りを報告")}
                  </button>

                </div>

              </div>

            </article>
          `;
        }
      )
      .join("");

  renderRatingSections(
    sortedSongs
  );
}

/* =========================
   RATING SECTIONS
========================= */

function renderRatingSections(
  sortedSongs
) {
  ratingSections.innerHTML =
    sortedSongs
      .map((song) => {
        const embed =
          youtubeEmbedUrl(
            song.youtube_url
          );

        const my =
          song.myRating;

        return `
          <section
            class="rating-section"
            data-song-id="${song.id}"
          >

            <div class="rating-inner">

              <p class="eyebrow dark">
                RATE
                ${
                  escapeHtml(
                    song.title
                  )
                }
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
                        loading="lazy"
                        title="${
                          escapeHtml(
                            song.title
                          )
                        }"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowfullscreen
                      >
                      </iframe>

                    </div>
                  `
                  : `
                    <div class="no-preview">
                      A listening preview has not been added for this song yet.
                    </div>
                  `
              }

              <div class="rating-actions">

                <button
                  class="action ${
                    my?.heard_before === true
                      ? "selected"
                      : ""
                  }"
                  onclick="window.submitRating(${song.id}, true, null)"
                >
                  ${
                    my?.heard_before === true
                      ? "Yes, I knew it ✓"
                      : "Yes, I knew it"
                  }
                </button>

              </div>

              <h3>
                If not, how would you rate it after listening?
              </h3>

              <div class="rating-actions">

                ${
                  [1, 2, 3, 4, 5]
                    .map(
                      (value) => `
                        <button
                          class="action ${
                            my?.heard_before === false &&
                            Number(
                              my.rating
                            ) === value
                              ? "selected"
                              : ""
                          }"
                          onclick="window.submitRating(${song.id}, false, ${value})"
                        >
                          ${value}${
                            my?.heard_before === false &&
                            Number(
                              my.rating
                            ) === value
                              ? " ✓"
                              : ""
                          }
                        </button>
                      `
                    )
                    .join("")
                }

              </div>

              ${
                my
                  ? `
                    <p class="sample-note">
                      Choosing again updates your previous response.
                    </p>
                  `
                  : ""
              }

            </div>

          </section>
        `;
      })
      .join("");
}


/* =========================
   SONG REQUESTS
========================= */

function youtubeVideoId(url) {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id = null;

    if (host === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0];
    } else if (host === "youtube.com" || host === "m.youtube.com") {
      id = parsed.searchParams.get("v");

      if (!id) {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) {
          id = parts[1];
        }
      }
    }

    return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

async function searchSongByTitle(event) {
  event.preventDefault();
  if (listenerProfile?.listener_group !== "japan") {
    showStatus("日本プロフィールの利用者だけが曲を検索できます。", "error");
    return;
  }

  const input = $("#songSearchTitle");
  const button = $("#songSearchSubmit");
  const note = $("#songRequestNote");
  const results = $("#youtubeCandidates");
  const query = input.value.trim();

  if (query.length < 2 || query.length > 100) {
    note.textContent = "曲名は2〜100文字で入力してください。";
    return;
  }

  button.disabled = true;
  button.textContent = "YouTubeを検索中…";
  note.textContent = "";
  results.innerHTML = "";

  try {
    const response = await fetch(
      SUPABASE_URL + "/functions/v1/search-youtube?q=" + encodeURIComponent(query),
      { headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + accessToken } }
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "YouTube検索に失敗しました。");

    const candidates = Array.isArray(data.items) ? data.items : [];
    if (!candidates.length) throw new Error("再生可能なYouTube動画が見つかりませんでした。");
    renderYoutubeCandidates(candidates);
  } catch (error) {
    console.error(error);
    note.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "YouTubeで検索";
  }
}

function renderYoutubeCandidates(candidates) {
  const results = $("#youtubeCandidates");
  results.innerHTML = candidates.map((item) => {
    const id = escapeHtml(item.videoId);
    const title = escapeHtml(item.title);
    const channel = escapeHtml(item.channelTitle);
    return '<article class="youtube-candidate">' +
      '<div class="candidate-preview"><iframe src="https://www.youtube.com/embed/' + id + '" ' +
      'title="' + title + '" loading="lazy" ' +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' +
      '<div class="youtube-candidate-copy"><h3>' + title + '</h3><p>' + channel + '</p>' +
      '<button class="button candidate-add" type="button" data-video-id="' + id +
      '" data-title="' + title + '" data-channel="' + channel + '">この動画を選ぶ</button></div></article>';
  }).join("");

  results.querySelectorAll(".candidate-add").forEach((button) => {
    button.addEventListener("click", () => addYoutubeCandidate(button));
  });
}

async function autoTagSong(videoId) {
  const response = await fetch(SUPABASE_URL + "/functions/v1/auto-tag-song", {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ videoId })
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(data?.error || data?.message || "Automatic tagging failed.");
  }
  return data;
}

async function addYoutubeCandidate(button) {
  const videoId = button.dataset.videoId;
  const title = button.dataset.title;
  const artist = button.dataset.channel;
  const note = $("#songRequestNote");

  button.disabled = true;
  button.textContent = "追加中…";
  note.textContent = "";

  try {
    await rest("rpc/request_song", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        p_title: title,
        p_artist: artist,
        p_youtube_url: "https://www.youtube.com/watch?v=" + videoId,
        p_video_id: videoId
      })
    });
    let taggingFailed = false;
    try {
      await autoTagSong(videoId);
    } catch (tagError) {
      taggingFailed = true;
      console.warn("Automatic tagging failed:", tagError);
    }

    $("#songSearchTitle").value = "";
    $("#youtubeCandidates").innerHTML = "";
    showStatus(
      taggingFailed
        ? "曲を追加しました。AIタグ付けは後で再試行できます。"
        : "曲を追加し、AIタグを自動設定しました。",
      taggingFailed ? "error" : "success"
    );
    await loadDemographicOptions();
    await loadAll();
    $("#ranking")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    note.textContent = error.message;
    button.disabled = false;
    button.textContent = "この動画を選ぶ";
  }
}

async function reportSongTags(songId) {
  const message = window.prompt(
    ui(
      "What is wrong or missing from this song's tags?",
      "この曲のタグについて、間違いまたは不足している内容を入力してください。"
    )
  );
  if (!message) return;

  try {
    await rest("rpc/submit_song_tag_report", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        p_song_id: Number(songId),
        p_report_type: "other",
        p_message: message.trim()
      })
    });
    showStatus(ui("Report sent. Thank you.", "報告を送信しました。"));
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

/* =========================
   BUSY STATE
========================= */

async function withBusy(
  action
) {
  if (busy) return;

  busy = true;

  document
    .querySelectorAll(
      ".action"
    )
    .forEach(
      (button) => {
        button.disabled =
          true;
      }
    );

  try {
    await action();
  }

  finally {
    busy = false;

    document
      .querySelectorAll(
        ".action"
      )
      .forEach(
        (button) => {
          button.disabled =
            false;
        }
      );
  }
}

/* =========================
   JAPAN VOTE
========================= */

async function submitRecommendation(
  songId,
  recommended
) {
  if (
    audience !== "japan"
  ) {
    showStatus(
      "Choose the Japan listener option first.",
      "error"
    );

    return;
  }

  await withBusy(
    async () => {
      try {
        const song =
          songs.find(
            (item) =>
              item.id === songId
          );

        const existing =
          song?.myRecommendation;

        if (existing) {
          await rest(
            `recommendations?user_id=eq.${encodeURIComponent(
              currentUser.id
            )}&song_id=eq.${songId}`,
            {
              method:
                "PATCH",

              authenticated:
                true,

              headers: {
                Prefer:
                  "return=minimal"
              },

              body:
                JSON.stringify({
                  recommended,

                  updated_at:
                    new Date()
                      .toISOString()
                })
            }
          );
        }

        else {
          await rest(
            "recommendations",
            {
              method:
                "POST",

              authenticated:
                true,

              headers: {
                Prefer:
                  "return=minimal"
              },

              body:
                JSON.stringify({
                  user_id:
                    currentUser.id,

                  song_id:
                    songId,

                  recommended,

                  updated_at:
                    new Date()
                      .toISOString()
                })
            }
          );
        }

        showStatus(
          "Your recommendation was saved."
        );

        await loadAll();
      }

      catch (error) {
        console.error(error);

        showStatus(
          `Could not save recommendation: ${error.message}`,
          "error"
        );
      }
    }
  );
}

/* =========================
   OVERSEAS RATING
========================= */

async function submitRating(
  songId,
  heardBefore,
  rating
) {
  if (
    audience !== "overseas"
  ) {
    showStatus(
      "Choose the outside-Japan listener option first.",
      "error"
    );

    return;
  }

  await withBusy(
    async () => {
      try {
        const song =
          songs.find(
            (item) =>
              item.id === songId
          );

        const existing =
          song?.myRating;

        const payload = {
          heard_before:
            heardBefore,

          rating:
            heardBefore
              ? null
              : rating,

          updated_at:
            new Date()
              .toISOString()
        };

        if (existing) {
          await rest(
            `ratings?user_id=eq.${encodeURIComponent(
              currentUser.id
            )}&song_id=eq.${songId}`,
            {
              method:
                "PATCH",

              authenticated:
                true,

              headers: {
                Prefer:
                  "return=minimal"
              },

              body:
                JSON.stringify(
                  payload
                )
            }
          );
        }

        else {
          await rest(
            "ratings",
            {
              method:
                "POST",

              authenticated:
                true,

              headers: {
                Prefer:
                  "return=minimal"
              },

              body:
                JSON.stringify({
                  ...payload,

                  user_id:
                    currentUser.id,

                  song_id:
                    songId
                })
            }
          );
        }

        showStatus(
          "Your response was saved."
        );

        await loadAll();
      }

      catch (error) {
        console.error(error);

        showStatus(
          `Could not save response: ${error.message}`,
          "error"
        );
      }
    }
  );
}

/* =========================
   AUDIENCE
========================= */

function openRating(
  songId
) {
  document
    .querySelector(
      `[data-song-id="${songId}"]`
    )
    ?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "start"
    });
}

function setAudience(
  type,
  scroll = true
) {
  audience =
    type;

  document.body.dataset.audience =
    type;

  applyInterfaceLanguage(type);

  $("#japanListener")
    ?.classList.toggle(
      "is-selected",
      type === "japan"
    );

  $("#overseasListener")
    ?.classList.toggle(
      "is-selected",
      type === "overseas"
    );

  $("#changeAudienceBtn")
    ?.classList.remove(
      "hidden"
    );

  if (scroll) {
    (
      type === "japan"
        ? $("#ranking")
        : $("#ratingSections")
    )
      ?.scrollIntoView({
        behavior:
          "smooth",

        block:
          "start"
      });
  }
}

function resetAudience() {
  audience =
    null;

  delete document
    .body
    .dataset
    .audience;

  $("#japanListener")
    ?.classList.remove(
      "is-selected"
    );

  $("#overseasListener")
    ?.classList.remove(
      "is-selected"
    );

  $("#changeAudienceBtn")
    ?.classList.add(
      "hidden"
    );

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================
   STATIC UI
========================= */

function wireUi() {
  $("#japanListener")
    ?.addEventListener(
      "click",
      () => openProfileDialog("japan")
    );

  $("#overseasListener")
    ?.addEventListener(
      "click",
      () => openProfileDialog("overseas")
    );

  $("#changeAudienceBtn")
    ?.addEventListener(
      "click",
      () => openProfileDialog()
    );

  const dialog =
    $("#aboutDialog");

  $("#aboutBtn")
    ?.addEventListener(
      "click",
      () =>
        dialog
          ?.showModal()
    );

  $("#closeDialog")
    ?.addEventListener(
      "click",
      () =>
        dialog
          ?.close()
    );

  $("#songRequestForm")
    ?.addEventListener(
      "submit",
      searchSongByTitle
    );

  $("#profileForm")
    ?.addEventListener(
      "submit",
      saveListenerProfile
    );

  $("#closeProfileDialog")
    ?.addEventListener(
      "click",
      () => $("#profileDialog")?.close()
    );

  countryFilter
    ?.addEventListener(
      "change",
      applyCountryFilter
    );

  ageFilter
    ?.addEventListener(
      "change",
      applyAgeFilter
    );

  songTagFilter
    ?.addEventListener(
      "change",
      applySongTagFilter
    );

  sortSelect
    ?.addEventListener(
      "change",
      render
    );
}

/* =========================
   GLOBAL BUTTON HANDLERS
========================= */

window.submitRecommendation =
  submitRecommendation;

window.submitRating =
  submitRating;

window.openRating =
  openRating;

window.reportSongTags =
  reportSongTags;

/* =========================
   START
========================= */

async function start() {
  wireUi();

  try {
    showStatus(
      "Connecting securely…",
      "success",
      true
    );

    await ensureAnonymousUser();

    await loadListenerProfile();

    await loadDemographicOptions();

    await loadAll();

    showStatus(
      "Connected."
    );
  }

  catch (error) {
    console.error(error);

    if (cards) {
      cards.innerHTML =
        '<p class="muted">Could not load the site.</p>';
    }

    showStatus(
      `Startup error: ${error.message}`,
      "error",
      true
    );
  }
}

start();
