const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";
const SESSION_KEY = "jhg_admin_session_v1";

let accessToken = null;
let adminSongs = [];
let adminTags = [];
let adminReports = [];

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
    const [songs, tags, reports] = await Promise.all([
      rpc("admin_list_songs_v3"),
      rpc("admin_list_song_tags"),
      rpc("admin_list_tag_reports")
    ]);
    adminSongs = songs ?? [];
    adminTags = tags ?? [];
    adminReports = reports ?? [];
    renderSongs();
    renderReports();
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
      <details class="tag-editor">
        <summary>タグを編集</summary>
        <div class="admin-tag-grid">
          ${adminTags.map((tag) => `
            <label>
              <input type="checkbox" name="songTag" value="${tag.id}"
                ${(song.tag_ids || []).map(Number).includes(Number(tag.id)) ? "checked" : ""}>
              <span>${escapeHtml(tag.label_ja)} <small>${escapeHtml(tag.category_ja)}</small></span>
            </label>
          `).join("")}
        </div>
        <button type="button" data-action="tags" data-id="${song.id}">タグを保存</button>
      </details>
    </article>
  `).join("") || '<p class="empty">該当する曲がありません。</p>';
}

function renderReports() {
  const container = $("#tagReports");
  if (!container) return;

  const openReports = adminReports.filter((report) => report.status === "open");
  container.innerHTML = openReports.map((report) => `
    <article class="song-row report-row">
      <div class="song-copy">
        <span class="badge hidden-badge">タグ報告</span>
        <h2>${escapeHtml(report.song_title)}</h2>
        <p>${escapeHtml(report.song_artist)}</p>
        <p>${escapeHtml(report.message)}</p>
        <small>${new Date(report.created_at).toLocaleString("ja-JP")} · 報告ID ${report.id}</small>
      </div>
      <div class="song-actions">
        <button type="button" data-report-action="edit" data-song-id="${report.song_id}">
          曲のタグを確認
        </button>
        <button type="button" data-report-action="resolved" data-report-id="${report.id}">
          対応済み
        </button>
        <button class="secondary" type="button" data-report-action="dismissed" data-report-id="${report.id}">
          却下
        </button>
      </div>
    </article>
  `).join("") || '<p class="empty">未対応のタグ報告はありません。</p>';
}

async function setReportStatus(button) {
  button.disabled = true;
  try {
    await rpc("admin_set_tag_report_status", {
      p_report_id: Number(button.dataset.reportId),
      p_status: button.dataset.reportAction
    });
    await loadSongs();
  } catch (error) {
    $("#adminStatus").textContent = error.message;
    button.disabled = false;
  }
}

function youtubeVideoId(url) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] || null;
    }
    return parsed.searchParams.get("v") ||
      (parsed.pathname.startsWith("/shorts/") ? parsed.pathname.split("/")[2] : null);
  } catch {
    return null;
  }
}

async function invokeAutoTag(videoId) {
  const response = await fetch(SUPABASE_URL + "/functions/v1/auto-tag-song", {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ videoId })
  });
  return parseResponse(response);
}

async function backfillAiTags() {
  const button = $("#backfillTags");
  const candidates = adminSongs
    .map((song) => ({
      song,
      videoId: song.youtube_video_id || youtubeVideoId(song.youtube_url)
    }))
    .filter((item) =>
      item.videoId &&
      (
        item.song.ai_tag_status !== "completed" ||
        !(item.song.tag_ids || []).length
      )
    );

  if (!candidates.length) {
    $("#adminStatus").textContent = "処理できるYouTube曲がありません。";
    return;
  }

  if (!window.confirm(candidates.length + "曲をAIタグ付けします。続行しますか？")) return;

  button.disabled = true;
  let succeeded = 0;
  let failed = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    const item = candidates[index];
    $("#adminStatus").textContent =
      "AIタグ付け中 " + (index + 1) + " / " + candidates.length +
      "：" + item.song.title +
      "（途中で閉じても、次回は未完了分から再開できます）";

    try {
      await invokeAutoTag(item.videoId);
      succeeded += 1;
    } catch (error) {
      console.error("AI tag backfill failed:", item.song.id, error);
      failed += 1;
    }

    await new Promise((resolve) => setTimeout(resolve, 900));
  }

  button.disabled = false;
  $("#adminStatus").textContent =
    "AIタグ付け完了：成功 " + succeeded + "曲、失敗 " + failed + "曲";
  await loadSongs();
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

async function saveSongTags(button) {
  const row = button.closest(".song-row");
  const tagIds = [...row.querySelectorAll('input[name="songTag"]:checked')]
    .map((input) => Number(input.value));

  button.disabled = true;
  try {
    await rpc("admin_set_song_tags", {
      p_song_id: Number(button.dataset.id),
      p_tag_ids: tagIds
    });
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
  if (button.dataset.action === "tags") saveSongTags(button);
});

$("#tagReports")?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-report-action]");
  if (!button) return;

  if (button.dataset.reportAction === "edit") {
    const song = document.querySelector(
      '.song-row button[data-action="tags"][data-id="' + Number(button.dataset.songId) + '"]'
    );
    song?.closest(".song-row")?.scrollIntoView({ behavior: "smooth", block: "center" });
    song?.closest("details")?.setAttribute("open", "");
    return;
  }

  setReportStatus(button);
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
$("#backfillTags").addEventListener("click", backfillAiTags);
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
