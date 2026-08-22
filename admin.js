const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";
const SESSION_KEY = "jhg_admin_session_v1";

let accessToken = null;
let adminSongs = [];

const $ = (selector) => document.querySelector(selector);

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

async function parseResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    throw new Error(data?.message || data?.error_description || data?.error || text || "Request failed.");
  }
  return data;
}

async function signIn(email, password) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  return parseResponse(response);
}

async function validateSession(token) {
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token }
  });
  if (!response.ok) return null;
  return response.json();
}

async function rpc(name, body = {}) {
  const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

function showLogin(message = "") {
  $("#loginPanel").classList.remove("hidden");
  $("#adminPanel").classList.add("hidden");
  $("#loginError").textContent = message;
}

function showAdmin() {
  $("#loginPanel").classList.add("hidden");
  $("#adminPanel").classList.remove("hidden");
}

async function loadSongs() {
  $("#adminStatus").textContent = "読み込み中…";
  try {
    adminSongs = await rpc("admin_list_songs");
    renderSongs();
    $("#adminStatus").textContent = adminSongs.length + "曲";
  } catch (error) {
    showLogin("管理者として登録されていないか、セッションが無効です。");
    sessionStorage.removeItem(SESSION_KEY);
  }
}

function renderSongs() {
  const query = $("#songFilter").value.trim().toLowerCase();
  const visibility = $("#visibilityFilter").value;
  const rows = adminSongs.filter((song) => {
    const matchesText = (song.title + " " + song.artist).toLowerCase().includes(query);
    const matchesVisibility =
      visibility === "all" ||
      (visibility === "hidden" && song.is_hidden) ||
      (visibility === "visible" && !song.is_hidden);
    return matchesText && matchesVisibility;
  });

  $("#adminSongs").innerHTML = rows.map((song) => `
    <article class="song-row">
      <div class="song-copy">
        <span class="badge ${song.is_hidden ? "hidden-badge" : ""}">${song.is_hidden ? "非表示" : "公開中"}</span>
        <h2>${escapeHtml(song.title)}</h2>
        <p>${escapeHtml(song.artist)}${song.year ? " · " + song.year : ""}</p>
        <small>推薦 ${song.recommendation_count}件 · 評価 ${song.rating_count}件 · ID ${song.id}</small>
      </div>
      <div class="song-actions">
        <a href="${escapeHtml(song.youtube_url)}" target="_blank" rel="noopener">YouTube</a>
        <button type="button" data-action="toggle" data-id="${song.id}" data-hidden="${song.is_hidden}">
          ${song.is_hidden ? "復元" : "非表示"}
        </button>
        <button class="danger" type="button" data-action="delete" data-id="${song.id}">完全削除</button>
      </div>
    </article>
  `).join("") || '<p class="empty">該当する曲がありません。</p>';
}

async function toggleSong(button) {
  const songId = Number(button.dataset.id);
  const currentlyHidden = button.dataset.hidden === "true";
  button.disabled = true;
  try {
    await rpc("admin_set_song_hidden", { p_song_id: songId, p_hidden: !currentlyHidden });
    await loadSongs();
  } catch (error) {
    $("#adminStatus").textContent = error.message;
    button.disabled = false;
  }
}

function openDelete(songId) {
  const song = adminSongs.find((item) => Number(item.id) === songId);
  if (!song) return;
  $("#deleteSongId").value = song.id;
  $("#deleteSongTitle").textContent = song.title;
  $("#deleteConfirmation").value = "";
  $("#deleteError").textContent = "";
  $("#deleteDialog").showModal();
}

$("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#loginError").textContent = "";
  try {
    const session = await signIn($("#adminEmail").value.trim(), $("#adminPassword").value);
    accessToken = session.access_token;
    const isAdmin = await rpc("is_song_admin");
    if (isAdmin !== true) throw new Error("このアカウントは管理者ではありません。");
    sessionStorage.setItem(SESSION_KEY, accessToken);
    showAdmin();
    await loadSongs();
  } catch (error) {
    showLogin(error.message);
  }
});

$("#adminSongs").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "toggle") toggleSong(button);
  if (button.dataset.action === "delete") openDelete(Number(button.dataset.id));
});

$("#deleteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const songId = Number($("#deleteSongId").value);
  try {
    await rpc("admin_delete_song", {
      p_song_id: songId,
      p_confirmation: $("#deleteConfirmation").value
    });
    $("#deleteDialog").close();
    await loadSongs();
  } catch (error) {
    $("#deleteError").textContent = error.message;
  }
});

$("#cancelDelete").addEventListener("click", () => $("#deleteDialog").close());
$("#songFilter").addEventListener("input", renderSongs);
$("#visibilityFilter").addEventListener("change", renderSongs);
$("#refreshSongs").addEventListener("click", loadSongs);
$("#logoutBtn").addEventListener("click", () => {
  accessToken = null;
  sessionStorage.removeItem(SESSION_KEY);
  showLogin();
});

(async function startAdmin() {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (!stored) return;
  const user = await validateSession(stored);
  if (!user?.id) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  accessToken = stored;
  try {
    if (await rpc("is_song_admin") !== true) throw new Error();
    showAdmin();
    await loadSongs();
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
  }
})();
