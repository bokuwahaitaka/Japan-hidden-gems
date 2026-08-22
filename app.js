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
let personalizedRecommendations = [];
let favoriteSongIds = new Set();
let notInterestedSongIds = new Set();
let interfaceLanguage = ["ja", "en"].includes(localStorage.getItem("jhg_interface_language_v1")) ? localStorage.getItem("jhg_interface_language_v1") : null;
let currentView = "home";
let activeRatingSongId = null;

const $ = (selector) => document.querySelector(selector);

const cards = $("#cards");
const sortSelect = $("#sortSelect");
const ratingSections = $("#ratingSections");
const statusBar = $("#statusBar");
const countryFilter = $("#countryFilter");
const ageFilter = $("#ageFilter");
const songTagFilter = $("#songTagFilter");
const personalizedGrid = $("#personalizedGrid");
const favoritesGrid = $("#favoritesGrid");
const similarSongsGrid = $("#similarSongsGrid");

const SESSION_KEY = "jhg_supabase_session_v1";
const PENDING_ACCOUNT_KEY = "jhg_pending_account_email_v1";
const PENDING_PASSWORD_KEY = "jhg_pending_account_password_v1";
const PENDING_RESET_KEY = "jhg_pending_password_reset_v1";
const LANGUAGE_KEY = "jhg_interface_language_v1";

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
  return interfaceLanguage === "ja" ? ja : en;
}

function songTitle(song) {
  if (interfaceLanguage === "en" && song?.title_en?.trim()) {
    return song.title_en.trim();
  }
  return song?.title ?? "";
}

function setInterfaceLanguage(language, persist = true) {
  interfaceLanguage = language === "ja" ? "ja" : "en";
  if (persist) localStorage.setItem(LANGUAGE_KEY, interfaceLanguage);
  applyInterfaceLanguage(interfaceLanguage);
}

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

const VALID_VIEWS = new Set(["home", "ranking", "personalized", "favorites", "request", "listen"]);

function routeFromLocation() {
  const requested = new URLSearchParams(window.location.search).get("view");
  return VALID_VIEWS.has(requested) ? requested : "home";
}

function songFromLocation() {
  const value = Number(new URLSearchParams(window.location.search).get("song"));
  return Number.isInteger(value) && value > 0 ? value : null;
}

function routeUrl(view, songId = null) {
  const url = new URL(window.location.href);
  if (view === "home") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  if (view === "listen" && songId) url.searchParams.set("song", String(songId));
  else url.searchParams.delete("song");
  return url;
}

function syncListenView() {
  document.querySelectorAll("#ratingSections [data-song-id]").forEach((section) => {
    section.classList.toggle("is-active-rating", Number(section.dataset.songId) === activeRatingSongId);
  });
}

function renderView(view, options = {}) {
  const nextView = VALID_VIEWS.has(view) ? view : "home";
  currentView = nextView;
  activeRatingSongId = nextView === "listen" ? Number(options.songId || songFromLocation()) || null : null;

  document.querySelectorAll("[data-screen]").forEach((screen) => {
    screen.classList.toggle("is-active", screen.dataset.screen === nextView);
  });

  const activeNavView = nextView === "listen" ? "ranking" : nextView;
  document.querySelectorAll("[data-route]").forEach((item) => {
    const active = item.dataset.route === activeNavView;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });

  syncListenView();
  window.scrollTo({ top: 0, behavior: "auto" });
}

function navigateTo(view, options = {}) {
  const nextView = VALID_VIEWS.has(view) ? view : "home";
  const songId = nextView === "listen" ? Number(options.songId) || null : null;
  const state = { jhgRoute: true, view: nextView, songId, fromView: currentView };
  window.history[options.replace ? "replaceState" : "pushState"](state, "", routeUrl(nextView, songId));
  renderView(nextView, { songId });
}

function initializeRouter() {
  const view = routeFromLocation();
  const songId = songFromLocation();
  window.history.replaceState({ jhgRoute: true, view, songId, fromView: null }, "", routeUrl(view, songId));
  renderView(view, { songId });
  window.addEventListener("popstate", () => renderView(routeFromLocation(), { songId: songFromLocation() }));
}

function goBackFromListen() {
  if (window.history.state?.fromView) window.history.back();
  else navigateTo("ranking", { replace: true });
}

function applyInterfaceLanguage(language = interfaceLanguage || (audience === "japan" ? "ja" : "en")) {
  const ja = language === "ja" || language === "japan";
  interfaceLanguage = ja ? "ja" : "en";
  document.documentElement.dataset.language = interfaceLanguage;
  document.documentElement.lang = ja ? "ja" : "en";
  const copy = {
    "#accountBtn": ["Account", "アカウント"],
    "#languageLabel": ["Language", "言語"],
    "#sortScoreOption": ["Highest Hidden Gem Score", "隠れた名曲スコア順"],
    "#sortJapanOption": ["Highest Japan Recommendation", "日本での推薦率順"],
    "#sortAwarenessOption": ["Lowest Overseas Awareness", "海外認知度が低い順"],
    "#sortRatingOption": ["Highest Overseas Rating", "海外評価順"],
    "#methodEyebrow": ["METHOD", "評価方法"],
    "#methodTitle": ["What makes a hidden gem?", "隠れた名曲とは？"],
    "#methodCopy": ["A song ranks highly when Japanese listeners recommend it, overseas listeners rarely knew it beforehand, and people outside Japan rate it highly after listening.", "日本のリスナーから推薦され、海外でまだあまり知られておらず、聴いた後の評価が高い曲ほど上位になります。"],
    "#methodNote": ["Early results are marked provisional until enough responses are collected.", "十分な回答が集まるまでは暫定結果として表示されます。"],
    "#profileEyebrow": ["ANONYMOUS LISTENER PROFILE", "匿名リスナープロフィール"],
    "#profileTitle": ["Tell us about your listening", "あなたの音楽の聴き方を教えてください"],
    "#profileCountryLabel": ["Country or region", "国・地域"],
    "#profileCountryHint": ["Use the two-letter country code. Japan is JP.", "2文字の国コードを入力してください。日本はJPです。"],
    "#profileAgeLabel": ["Age band", "年齢層"],
    "#profileGenresLabel": ["Genres you enjoy", "好きなジャンル"],
    "#profileGenresHint": ["Choose 1–5.", "1〜5個選択してください。"],
    "#profilePrivacy": ["Saved to your anonymous survey profile. We do not ask for your name or exact age.", "匿名プロフィールとして保存します。氏名や正確な年齢は尋ねません。"],
    "#profileSubmitButton": ["Save and continue", "保存して続ける"],
    "#aboutEyebrow": ["ABOUT", "このサイトについて"],
    "#aboutTitle": ["Discovery before popularity.", "人気になる前の音楽を発見する。"],
    "#aboutCopy": ["Each browser gets an anonymous Supabase user. You can update your previous response by choosing again.", "ブラウザごとに匿名ユーザーを作成し、同じ項目を選び直すと以前の回答を更新できます。"],
    "#footerCopy": ["Prototype — no copyrighted audio or artwork is hosted here.", "試作版 — 著作権のある音源や画像はこのサイト上に保存していません。"],
    "#homeNavLabel": ["Home", "ホーム"],
    "#rankingNavLabel": ["Ranking", "ランキング"],
    "#personalizedNavLabel": ["For You", "おすすめ"],
    "#requestNavLabel": ["Recommend", "曲を推薦"],
    "#listenBackBtn": ["← Back", "← 戻る"],
    "#aboutBtn": ["How it works", "仕組み"],
    "#similarEyebrow": ["SIMILAR SONGS", "似ている曲"],
    "#similarSongsTitle": ["More songs like this", "この曲に似ている曲"],
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
    "#favoritesBtn": ["My Hidden Gems", "お気に入り"],
    "#favoritesEyebrow": ["MY HIDDEN GEMS", "保存した曲"],
    "#favoritesTitle": ["Your saved songs", "お気に入りの曲"],
    "#favoritesCopy": ["Save songs you want to hear again.", "あとでもう一度聴きたい曲を保存できます。"],
    "#personalizedEyebrow": ["FOR YOU", "あなたへのおすすめ"],
    "#personalizedTitle": ["Songs picked for you", "あなたに合いそうな曲"],
    "#personalizedCopy": ["Based on your favorite genres, recommendations, ratings, and song tags.", "好きなジャンル・推薦・評価・曲タグをもとに選んでいます。"],
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
    "#requestLimitCopy": ["Check the title and channel before choosing a video.", "選択前に動画名とチャンネルを確認してください。"],
    "#authEyebrow": ["ACCOUNT", "アカウント"],
    "#authTitle": ["Keep your hidden gems with you.", "お気に入りをどの端末でも。"],
    "#authCopy": ["Create an account to sync favorites across browsers and devices. You can keep using the site anonymously.", "アカウントを作ると、お気に入りをブラウザや端末間で同期できます。匿名のままでも利用できます。"],
    "#authEmailLabel": ["Email", "メールアドレス"],
    "#authPasswordLabel": ["Password", "パスワード"],
    "#authPasswordHint": ["Use at least 8 characters.", "8文字以上で入力してください。"],
    "#signInButton": ["Log in", "ログイン"],
    "#createAccountButton": ["Create account", "新規登録"],
    "#forgotPasswordButton": ["Forgot your password?", "パスワードを忘れた場合"],
    "#authResetCopy": ["Enter a new password for your account.", "アカウントの新しいパスワードを入力してください。"],
    "#resetPasswordLabel": ["New password", "新しいパスワード"],
    "#resetPasswordHint": ["Use at least 8 characters.", "8文字以上で入力してください。"],
    "#resetPasswordButton": ["Update password", "パスワードを更新"],
    "#authGuestNote": ["Anonymous use stays available. Creating an account keeps the current browser’s favorites and responses.", "匿名利用も継続できます。新規登録すると、このブラウザのお気に入りと回答をそのまま引き継ぎます。"],
    "#authFinishCopy": ["Email confirmed. Set a password to finish creating your account.", "メール確認が完了しました。パスワードを設定すると登録完了です。"],
    "#finishPasswordLabel": ["New password", "新しいパスワード"],
    "#finishPasswordHint": ["Use at least 8 characters.", "8文字以上で入力してください。"],
    "#finishAccountButton": ["Finish account", "登録を完了"],
    "#authSignedInLabel": ["Signed in as", "ログイン中"],
    "#signOutButton": ["Log out", "ログアウト"]
  };
  Object.entries(copy).forEach(([selector, values]) => setText(selector, ja ? values[1] : values[0]));
  const languageSelect = $("#languageSelect");
  if (languageSelect) {
    languageSelect.value = interfaceLanguage;
    languageSelect.setAttribute("aria-label", ja ? "サイトの言語" : "Site language");
  }
  const input = $("#songSearchTitle");
  if (input) input.placeholder = ja ? "例：プラスティック・ラブ" : "e.g. Plastic Love";
  const countryInput = $("#profileCountry");
  if (countryInput) countryInput.placeholder = ja ? "2文字コード（例：JP）" : "Two-letter code, e.g. US";
  renderDemographicOptions();
  if (songs.length) {
    render();
    renderPersonalized();
    renderFavorites();
  }
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


function applySession(session) {
  if (!session?.access_token || !session?.user?.id) {
    throw new Error("The account session was not returned.");
  }

  saveSession(session);
  accessToken = session.access_token;
  currentUser = session.user;
  syncAccountUi();
}

function consumeAuthCallback() {
  if (!window.location.hash.includes("access_token=")) return false;

  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessTokenFromUrl = params.get("access_token");
  const refreshTokenFromUrl = params.get("refresh_token");

  if (!accessTokenFromUrl || !refreshTokenFromUrl) return false;

  saveSession({
    access_token: accessTokenFromUrl,
    refresh_token: refreshTokenFromUrl,
    token_type: params.get("token_type") || "bearer",
    expires_in: Number(params.get("expires_in") || 3600)
  });

  if (params.get("type") === "email_change" || localStorage.getItem(PENDING_ACCOUNT_KEY)) {
    localStorage.setItem(PENDING_PASSWORD_KEY, "true");
    localStorage.removeItem(PENDING_ACCOUNT_KEY);
  }

  if (params.get("type") === "recovery") {
    localStorage.setItem(PENDING_RESET_KEY, "true");
  }

  history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}

function isMemberAccount() {
  return Boolean(currentUser?.email && currentUser?.is_anonymous !== true);
}

function syncAccountUi() {
  const resettingPassword =
    localStorage.getItem(PENDING_RESET_KEY) === "true" &&
    Boolean(currentUser?.email);
  const needsPassword =
    !resettingPassword &&
    localStorage.getItem(PENDING_PASSWORD_KEY) === "true" &&
    Boolean(currentUser?.email);
  const member = isMemberAccount() && !needsPassword && !resettingPassword;

  $("#authGuestPanel")?.classList.toggle("hidden", member || needsPassword || resettingPassword);
  $("#authFinishPanel")?.classList.toggle("hidden", !needsPassword);
  $("#authResetPanel")?.classList.toggle("hidden", !resettingPassword);
  $("#authMemberPanel")?.classList.toggle("hidden", !member);

  const email = $("#accountEmail");
  if (email) email.textContent = currentUser?.email || "";

  const button = $("#accountBtn");
  if (button) {
    button.dataset.member = member ? "true" : "false";
    button.setAttribute("aria-label", member ? ui("Account settings", "アカウント設定") : ui("Log in or create an account", "ログインまたは新規登録"));
  }
}

function openAccountDialog() {
  syncAccountUi();
  const error = $("#authError");
  if (error) error.textContent = "";
  $("#authDialog")?.showModal();
}

async function reloadForCurrentUser() {
  listenerProfile = null;
  selectedGenreIds = [];
  favoriteSongIds = new Set();
  notInterestedSongIds = new Set();
  await loadListenerProfile();
  await loadDemographicOptions();
  await loadAll();
}

async function signInWithPassword(event) {
  event.preventDefault();

  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const error = $("#authError");
  error.textContent = "";

  await withBusy(async () => {
    try {
      const session = await authRequest("token?grant_type=password", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });

      applySession(session);
      await reloadForCurrentUser();
      $("#authDialog")?.close();
      showStatus(ui("Logged in. Your saved songs are synced.", "ログインしました。お気に入りを同期しました。"), "success");
    } catch (loginError) {
      console.error(loginError);
      error.textContent = ui("Could not log in: ", "ログインできませんでした：") + loginError.message;
    }
  });
}

async function createMemberAccount() {
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const error = $("#authError");
  error.textContent = "";

  if (!email || password.length < 8) {
    error.textContent = ui("Enter an email address and a password of at least 8 characters.", "メールアドレスと8文字以上のパスワードを入力してください。");
    return;
  }

  await withBusy(async () => {
    try {
      await authRequest(
        "user?redirect_to=" + encodeURIComponent(window.location.origin + window.location.pathname),
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({
            email,
            data: { account_created_from: "japan-hidden-gems" }
          })
        }
      );

      localStorage.setItem(PENDING_ACCOUNT_KEY, email);
      syncAccountUi();
      showStatus(ui("Confirmation email sent. Open its link, then set your password.", "確認メールを送信しました。リンクを開いた後、パスワードを設定してください。"), "success", true);
      error.textContent = ui("Check your inbox. You will set the password after confirming your email.", "受信箱を確認してください。メール確認後にパスワードを設定します。");
    } catch (signupError) {
      console.error(signupError);
      error.textContent = ui("Could not create the account: ", "新規登録できませんでした：") + signupError.message;
    }
  });
}



async function requestPasswordReset() {
  const email = $("#authEmail").value.trim();
  const error = $("#authError");
  error.textContent = "";

  if (!email) {
    error.textContent = ui("Enter your email address first.", "先にメールアドレスを入力してください。");
    $("#authEmail")?.focus();
    return;
  }

  await withBusy(async () => {
    try {
      await authRequest(
        "recover?redirect_to=" + encodeURIComponent(window.location.origin + window.location.pathname),
        {
          method: "POST",
          body: JSON.stringify({ email })
        }
      );

      showStatus(ui("Password reset email sent.", "パスワード再設定メールを送信しました。"), "success", true);
      error.textContent = ui("Check your inbox and open the reset link.", "受信箱を確認し、再設定リンクを開いてください。");
    } catch (resetRequestError) {
      console.error(resetRequestError);
      error.textContent = ui("Could not send the reset email: ", "再設定メールを送信できませんでした：") + resetRequestError.message;
    }
  });
}

async function updateRecoveredPassword(event) {
  event.preventDefault();

  const password = $("#resetPassword").value;
  const error = $("#resetPasswordError");
  error.textContent = "";

  if (password.length < 8) {
    error.textContent = ui("Use at least 8 characters.", "8文字以上で入力してください。");
    return;
  }

  await withBusy(async () => {
    try {
      const user = await authRequest("user", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password })
      });

      currentUser = user;
      const stored = readSession();
      if (stored) saveSession({ ...stored, user });

      localStorage.removeItem(PENDING_RESET_KEY);
      syncAccountUi();
      $("#authDialog")?.close();
      showStatus(ui("Password updated. You are logged in.", "パスワードを更新し、ログインしました。"), "success");
    } catch (resetError) {
      console.error(resetError);
      error.textContent = ui("Could not update the password: ", "パスワードを更新できませんでした：") + resetError.message;
    }
  });
}

async function finishMemberAccount(event) {
  event.preventDefault();

  const password = $("#finishPassword").value;
  const error = $("#finishAccountError");
  error.textContent = "";

  if (password.length < 8) {
    error.textContent = ui("Use at least 8 characters.", "8文字以上で入力してください。");
    return;
  }

  await withBusy(async () => {
    try {
      const user = await authRequest("user", {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ password })
      });

      currentUser = user;
      const stored = readSession();
      if (stored) saveSession({ ...stored, user });

      localStorage.removeItem(PENDING_ACCOUNT_KEY);
      localStorage.removeItem(PENDING_PASSWORD_KEY);
      syncAccountUi();
      await reloadForCurrentUser();
      $("#authDialog")?.close();
      showStatus(ui("Account created. Your saved songs are now synced.", "登録が完了しました。お気に入りを同期しました。"), "success");
    } catch (finishError) {
      console.error(finishError);
      error.textContent = ui("Could not set the password: ", "パスワードを設定できませんでした：") + finishError.message;
    }
  });
}

async function signOutMember() {
  await withBusy(async () => {
    try {
      if (accessToken) {
        await authRequest("logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
    } catch (logoutError) {
      console.warn("Remote logout failed:", logoutError);
    }

    clearSession();
    accessToken = null;
    currentUser = null;
    await ensureAnonymousUser();
    await reloadForCurrentUser();
    $("#authDialog")?.close();
    showStatus(ui("Logged out. You are now using an anonymous session.", "ログアウトしました。現在は匿名で利用しています。"), "success");
  });
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
  applyInterfaceLanguage(interfaceLanguage || (group === "japan" ? "ja" : "en"));

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

  const [
    rows,
    titleRows,
    hiddenRows,
    tagRows,
    personalizedRows,
    favoriteRows,
    feedbackRows
  ] = await Promise.all([
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
        "songs?select=id,title_en",
        { authenticated: true }
      ),
      rest(
        "rpc/get_hidden_song_ids",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({})
        }
      ),
      rest(
        "rpc/get_public_song_tags",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({})
        }
      ),
      rest(
        "rpc/get_personalized_recommendations",
        {
          method: "POST",
          authenticated: true,
          body: JSON.stringify({ p_limit: 5 })
        }
      ),
      rest(
        "favorite_songs?select=song_id,created_at&user_id=eq." +
          encodeURIComponent(currentUser.id) +
          "&order=created_at.desc",
        { authenticated: true }
      ),
      rest(
        "personalization_feedback?select=song_id&user_id=eq." +
          encodeURIComponent(currentUser.id) +
          "&feedback=eq.not_interested",
        { authenticated: true }
      )
    ]);

  favoriteSongIds = new Set(
    (favoriteRows ?? []).map((row) => Number(row.song_id))
  );

  notInterestedSongIds = new Set(
    (feedbackRows ?? []).map((row) => Number(row.song_id))
  );

  const englishTitles = new Map(
    (titleRows ?? []).map((row) => [Number(row.id), row.title_en])
  );

  const hiddenSongIds =
    new Set(
      (hiddenRows ?? []).map(
        (row) => Number(row.id)
      )
    );

  const tagsBySong = new Map(
    (tagRows ?? []).map((row) => [
      Number(row.song_id),
      Array.isArray(row.tags) ? row.tags : []
    ])
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

        title_en:
          englishTitles.get(Number(row.id)) ?? null,

        artist:
          row.artist,

        year:
          row.year,

        youtube_url:
          row.youtube_url,

        tags:
          tagsBySong.get(Number(row.id)) ?? [],

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

  const songsById = new Map(
    songs.map((song) => [Number(song.id), song])
  );

  personalizedRecommendations = (personalizedRows ?? [])
    .map((row) => {
      const song = songsById.get(Number(row.song_id));
      return song
        ? {
            ...song,
            recommendationScore: Number(row.recommendation_score ?? 0),
            reasonTags: Array.isArray(row.reason_tags) ? row.reason_tags : []
          }
        : null;
    })
    .filter(Boolean);

  renderStats();
  render();
  renderPersonalized();
  renderFavorites();
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


function similarButton(song) {
  return `
    <button
      class="action similar-action"
      onclick="window.openSimilarSongs(${song.id})"
    >
      ${ui("Similar songs", "似ている曲")}
    </button>
  `;
}

async function openSimilarSongs(songId) {
  const numericSongId = Number(songId);
  const sourceSong = songs.find((song) => Number(song.id) === numericSongId);
  const dialog = $("#similarSongsDialog");

  if (!sourceSong || !similarSongsGrid || !dialog) return;

  $("#similarSongsSource").textContent =
    songTitle(sourceSong) + " — " + sourceSong.artist;
  similarSongsGrid.innerHTML =
    '<p class="muted">' + ui("Finding similar songs…", "似ている曲を探しています…") + "</p>";
  dialog.showModal();

  try {
    const rows = await rest("rpc/get_similar_songs", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({
        p_song_id: numericSongId,
        p_limit: 6
      })
    });

    similarSongsGrid.innerHTML = (rows ?? []).map((row) => {
      const sharedTags = Array.isArray(row.shared_tags)
        ? row.shared_tags
        : [];
      const reasons = sharedTags.map((tag) =>
        escapeHtml(ui(tag.label_en, tag.label_ja))
      );
      const sameArtist =
        String(row.artist).toLowerCase() ===
        String(sourceSong.artist).toLowerCase();
      const closeYear =
        row.year && sourceSong.year &&
        Math.abs(Number(row.year) - Number(sourceSong.year)) <= 5;

      if (!reasons.length && sameArtist) {
        reasons.push(ui("Same artist", "同じアーティスト"));
      }
      if (!reasons.length && closeYear) {
        reasons.push(ui("Similar era", "近い年代"));
      }

      return `
        <article class="similar-song-card">
          <p class="eyebrow dark">${ui("SIMILAR PICK", "類似候補")}</p>
          <h3>${escapeHtml(row.title)}</h3>
          <p class="meta">
            ${escapeHtml(row.artist)}
            ${row.year ? " · " + escapeHtml(row.year) : ""}
          </p>
          <p class="similar-reason">
            ${reasons.length
              ? ui("In common: ", "共通点：") + reasons.join(" · ")
              : ui("Selected from nearby hidden-gem signals", "隠れた名曲データから近い候補を選出")}
          </p>
          <div class="actions">
            <button class="action primary" onclick="window.openRating(${row.song_id})">
              ${ui("Listen", "聴いてみる")}
            </button>
            ${favoriteButton({ id: Number(row.song_id) })}
            <button class="action" onclick="window.openSimilarSongs(${row.song_id})">
              ${ui("More like this", "さらに似た曲")}
            </button>
          </div>
        </article>
      `;
    }).join("") || `
      <p class="muted">
        ${ui("No similar songs were found yet.", "似ている曲はまだ見つかりませんでした。")}
      </p>
    `;
  } catch (error) {
    console.error(error);
    similarSongsGrid.innerHTML =
      '<p class="form-error">' +
      escapeHtml(ui("Could not load similar songs: ", "似ている曲を読み込めませんでした：") + error.message) +
      "</p>";
  }
}

function favoriteButton(song) {
  const saved = favoriteSongIds.has(Number(song.id));
  return `
    <button
      class="action favorite-action ${saved ? "selected" : ""}"
      onclick="window.toggleFavorite(${song.id})"
      aria-pressed="${saved}"
    >
      ${saved ? ui("Saved ♥", "保存済み ♥") : ui("Save ♡", "お気に入り ♡")}
    </button>
  `;
}

function notInterestedButton(song) {
  const dismissed = notInterestedSongIds.has(Number(song.id));

  return `
    <button
      class="action not-interested-action ${dismissed ? "selected" : ""}"
      onclick="window.toggleNotInterested(${song.id})"
      aria-pressed="${dismissed}"
    >
      ${dismissed
        ? ui("Undo not interested", "興味なしを解除")
        : ui("Not interested", "興味なし")}
    </button>
  `;
}

function renderFavorites() {
  if (!favoritesGrid) return;

  const favorites = songs.filter((song) =>
    favoriteSongIds.has(Number(song.id))
  );

  favoritesGrid.innerHTML = favorites.map((song) => `
    <article class="favorite-card">
      <div>
        <p class="eyebrow dark">${ui("SAVED", "お気に入り")}</p>
        <h3>${escapeHtml(songTitle(song))}</h3>
        <p class="meta">${escapeHtml(song.artist)}</p>
      </div>
      <div class="actions">
        <button class="action primary" onclick="window.openRating(${song.id})">
          ${ui("Listen", "聴いてみる")}
        </button>
        ${favoriteButton(song)}
          ${similarButton(song)}
      </div>
    </article>
  `).join("") || `
    <p class="muted">
      ${ui(
        "No saved songs yet. Tap Save on any song to add it here.",
        "まだお気に入りはありません。曲の「お気に入り」を押すとここに保存されます。"
      )}
    </p>
  `;
}

async function toggleFavorite(songId) {
  const numericSongId = Number(songId);
  const saved = favoriteSongIds.has(numericSongId);

  try {
    if (saved) {
      await rest(
        "favorite_songs?user_id=eq." +
          encodeURIComponent(currentUser.id) +
          "&song_id=eq." +
          encodeURIComponent(numericSongId),
        {
          method: "DELETE",
          authenticated: true,
          headers: { Prefer: "return=minimal" }
        }
      );
      showStatus(ui("Removed from My Hidden Gems.", "お気に入りから削除しました。"));
    } else {
      if (notInterestedSongIds.has(numericSongId)) {
        await rest(
          "personalization_feedback?user_id=eq." +
            encodeURIComponent(currentUser.id) +
            "&song_id=eq." +
            encodeURIComponent(numericSongId) +
            "&feedback=eq.not_interested",
          {
            method: "DELETE",
            authenticated: true,
            headers: { Prefer: "return=minimal" }
          }
        );
      }

      await rest("favorite_songs", {
        method: "POST",
        authenticated: true,
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          user_id: currentUser.id,
          song_id: numericSongId
        })
      });
      showStatus(ui("Saved to My Hidden Gems.", "お気に入りに保存しました。"));
    }

    await loadAll();
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

function renderPersonalized() {
  if (!personalizedGrid) return;

  personalizedGrid.innerHTML = personalizedRecommendations.map((song) => {
    const reasons = song.reasonTags
      .map((tag) => escapeHtml(ui(tag.label_en, tag.label_ja)))
      .join(" · ");

    return `
      <article class="personalized-card">
        <p class="personalized-score">${Math.round(song.recommendationScore)}% MATCH</p>
        <h3>${escapeHtml(songTitle(song))}</h3>
        <p class="meta">${escapeHtml(song.artist)}</p>
        <p class="personalized-reason">
          ${reasons
            ? ui("Because you like ", "おすすめ理由：") + reasons
            : ui("Selected from the Hidden Gem ranking", "隠れた名曲スコアから選出")}
        </p>
        <div class="actions">
          <button class="action primary" onclick="window.openRating(${song.id})">
            ${ui("Listen", "聴いてみる")}
          </button>
          ${favoriteButton(song)}
          ${similarButton(song)}
          ${notInterestedButton(song)}
        </div>
      </article>
    `;
  }).join("") || `
    <p class="muted">
      ${ui(
        "Rate or recommend a few songs to improve your picks.",
        "曲を推薦・評価すると、おすすめが表示されます。"
      )}
    </p>
  `;
}

async function toggleNotInterested(songId) {
  const numericSongId = Number(songId);
  const dismissed = notInterestedSongIds.has(numericSongId);

  try {
    if (dismissed) {
      await rest(
        "personalization_feedback?user_id=eq." +
          encodeURIComponent(currentUser.id) +
          "&song_id=eq." +
          encodeURIComponent(numericSongId) +
          "&feedback=eq.not_interested",
        {
          method: "DELETE",
          authenticated: true,
          headers: { Prefer: "return=minimal" }
        }
      );
      showStatus(ui(
        "This song can appear in your recommendations again.",
        "興味なしを解除しました。おすすめに再表示されます。"
      ));
    } else {
      if (favoriteSongIds.has(numericSongId)) {
        await rest(
          "favorite_songs?user_id=eq." +
            encodeURIComponent(currentUser.id) +
            "&song_id=eq." +
            encodeURIComponent(numericSongId),
          {
            method: "DELETE",
            authenticated: true,
            headers: { Prefer: "return=minimal" }
          }
        );
      }

      await rest("rpc/dismiss_personalized_song", {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({ p_song_id: numericSongId })
      });
      showStatus(ui(
        "Removed from your recommendations.",
        "おすすめから除外しました。"
      ));
    }

    await loadAll();
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

/* =========================
   SORT
========================= */

function metric(
  value,
  suffix = ""
) {
  return value === null
    ? ui("Collecting data", "集計中")
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
      '<p class="muted">' + ui("No songs found.", "曲が見つかりませんでした。") + '</p>';

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
              ? ui("Pending", "集計中")
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
                      songTitle(song)
                    )
                  }
                </h3>

                <div class="meta">
                  ${escapeHtml(song.artist)}
                  ${song.year ? " · " + escapeHtml(song.year) : ""}
                </div>

                ${song.tags?.length ? `
                  <div class="song-tags">
                    ${song.tags.map((tag) => `
                      <span class="song-tag-pill">
                        ${escapeHtml(ui(tag.label_en, tag.label_ja))}
                      </span>
                    `).join("")}
                  </div>
                ` : ""}

                <div class="metrics">

                  <p>
                    ${ui("Japan recommendation:", "日本での推薦率：")}
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
                    ${ui("Overseas awareness:", "海外での認知度：")}
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
                    ${ui("Overseas post-listening rating:", "海外での視聴後評価：")}
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
                    ${ui("Hidden Gem Score", "隠れた名曲スコア")}
                    ${scoreSuffix}
                  </span>

                  ${
                    song.score !== null &&
                    song.provisional
                      ? `
                        <span class="badge">
                          ${ui("Provisional", "暫定")}
                        </span>
                      `
                      : ""
                  }

                </div>

                <p class="sample-note">
                  ${
                    song.recommendationTotal
                  }
                  ${ui("Japan votes", "日本票")}
                  ·
                  ${
                    song.overseasTotal
                  }
                  ${ui("overseas responses", "海外回答")}
                  ·
                  ${
                    song.postListenRatingCount
                  }
                  ${ui("post-listening ratings", "視聴後評価")}
                </p>

                <div class="actions">

                  <button
                    class="action primary overseas-action"
                    onclick="window.openRating(${song.id})"
                  >
                    ${ui("Listen & Rate", "聴いて評価")}
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
                        ? ui("Recommended ✓", "推薦済み ✓")
                        : ui("Recommend", "推薦する")
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
                        ? ui("Not for me ✓", "自分向けではない ✓")
                        : ui("Not for me", "自分向けではない")
                    }
                  </button>

                  ${favoriteButton(song)}
                  ${similarButton(song)}
                  ${notInterestedButton(song)}

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
                ${ui("RATE", "評価")}
                ${
                  escapeHtml(
                    songTitle(song)
                  )
                }
              </p>

              <h2>
                ${ui("Have you heard this song before?", "この曲を以前から知っていましたか？")}
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
                            songTitle(song)
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
                      ${ui("A listening preview has not been added for this song yet.", "この曲にはまだ試聴動画が登録されていません。")}
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
                      ? ui("Yes, I knew it ✓", "知っていた ✓")
                      : ui("Yes, I knew it", "知っていた")
                  }
                </button>

              </div>

              <h3>
                ${ui("If not, how would you rate it after listening?", "知らなかった場合、聴いた後の評価を教えてください。")}
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
                      ${ui("Choosing again updates your previous response.", "選び直すと以前の回答が更新されます。")}
                    </p>
                  `
                  : ""
              }

            </div>

          </section>
        `;
      })
      .join("");

  syncListenView();
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

function openRating(songId) {
  navigateTo("listen", { songId });
}

function setAudience(
  type,
  scroll = true
) {
  audience =
    type;

  document.body.dataset.audience =
    type;

  if (!localStorage.getItem(LANGUAGE_KEY)) {
    applyInterfaceLanguage(type === "japan" ? "ja" : "en");
  } else {
    applyInterfaceLanguage(interfaceLanguage);
  }

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
    navigateTo(type === "japan" ? "request" : "ranking");
  } else if (type !== "japan" && currentView === "request") {
    navigateTo("ranking", { replace: true });
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

  navigateTo("home");
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

  $("#languageSelect")
    ?.addEventListener(
      "change",
      (event) => setInterfaceLanguage(event.target.value)
    );

  const dialog =
    $("#aboutDialog");

  $("#accountBtn")
    ?.addEventListener(
      "click",
      openAccountDialog
    );

  $("#closeSimilarSongsDialog")
    ?.addEventListener(
      "click",
      () => $("#similarSongsDialog")?.close()
    );

  $("#closeAuthDialog")
    ?.addEventListener(
      "click",
      () => $("#authDialog")?.close()
    );

  $("#authForm")
    ?.addEventListener(
      "submit",
      signInWithPassword
    );

  $("#createAccountButton")
    ?.addEventListener(
      "click",
      createMemberAccount
    );

  $("#forgotPasswordButton")
    ?.addEventListener(
      "click",
      requestPasswordReset
    );

  $("#resetPasswordForm")
    ?.addEventListener(
      "submit",
      updateRecoveredPassword
    );

  $("#finishAccountForm")
    ?.addEventListener(
      "submit",
      finishMemberAccount
    );

  $("#signOutButton")
    ?.addEventListener(
      "click",
      signOutMember
    );

  document.querySelectorAll("[data-route]").forEach((item) => {
    item.addEventListener("click", () => navigateTo(item.dataset.route));
  });

  $("#listenBackBtn")
    ?.addEventListener(
      "click",
      goBackFromListen
    );

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

window.toggleNotInterested =
  toggleNotInterested;

window.toggleFavorite =
  toggleFavorite;

window.openSimilarSongs =
  openSimilarSongs;

/* =========================
   START
========================= */

async function start() {
  wireUi();
  setInterfaceLanguage(interfaceLanguage || (navigator.language?.toLowerCase().startsWith("ja") ? "ja" : "en"), false);

  try {
    showStatus(
      "Connecting securely…",
      "success",
      true
    );

    consumeAuthCallback();
    initializeRouter();
    await ensureAnonymousUser();
    syncAccountUi();

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
