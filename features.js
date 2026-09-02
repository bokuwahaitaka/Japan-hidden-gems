/* Japan Hidden Gems — discovery feature pack */
const featureState = {
  playlists: [],
  playlistSongs: [],
  history: [],
  feeds: [],
  searchQuery: "",
  activeArtist: null,
  activePlaylistId: null,
  loaded: false
};

["detail", "discover", "artists", "playlists", "history"].forEach((view) =>
  VALID_VIEWS.add(view)
);

function safeFeatureDecode(value = "") {
  try { return decodeURIComponent(String(value)); } catch { return String(value); }
}

function featureText(en, ja) {
  return ui(en, ja);
}

function featureSong(id) {
  return songs.find((song) => Number(song.id) === Number(id)) || null;
}

function featureRouteParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    songId: Number(params.get("song")) || null,
    artist: params.get("artist") || null,
    playlistId: Number(params.get("playlist")) || null
  };
}

function featureNavigate(view, params = {}, replace = false) {
  const url = new URL(window.location.href);
  url.searchParams.set("view", view);
  ["song", "artist", "playlist"].forEach((key) => url.searchParams.delete(key));
  if (params.songId) url.searchParams.set("song", String(params.songId));
  if (params.artist) url.searchParams.set("artist", params.artist);
  if (params.playlistId) url.searchParams.set("playlist", String(params.playlistId));

  window.history[replace ? "replaceState" : "pushState"](
    { jhgRoute: true, view, ...params, fromView: currentView },
    "",
    url
  );
  renderView(view, { songId: params.songId });
  renderFeatureRoute(view, params);
}

function featureRelativeTime(value) {
  const date = new Date(value);
  const seconds = Math.max(1, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return featureText("Just now", "たった今");
  if (seconds < 3600) return featureText(`${Math.floor(seconds / 60)} min ago`, `${Math.floor(seconds / 60)}分前`);
  if (seconds < 86400) return featureText(`${Math.floor(seconds / 3600)} hr ago`, `${Math.floor(seconds / 3600)}時間前`);
  if (seconds < 604800) return featureText(`${Math.floor(seconds / 86400)} days ago`, `${Math.floor(seconds / 86400)}日前`);
  return date.toLocaleDateString(interfaceLanguage === "ja" ? "ja-JP" : "en-US");
}

function featureCard(song, kicker = "", meta = "") {
  if (!song) return "";
  return `
    <article class="feature-song-card">
      ${songArtwork(song, "feature-artwork")}
      <div class="feature-song-copy">
        ${kicker ? `<p class="eyebrow dark">${escapeHtml(kicker)}</p>` : ""}
        <h3>
          <button type="button" class="feature-title-link" onclick="window.openSongDetail(${song.id})">
            ${escapeHtml(songTitle(song))}
          </button>
        </h3>
        <p class="meta">${escapeHtml(songArtist(song))}${song.year ? " · " + escapeHtml(song.year) : ""}</p>
        ${meta ? `<p class="feature-meta">${escapeHtml(meta)}</p>` : ""}
        <div class="actions">
          <button class="action primary" onclick="window.openRating(${song.id})">
            ${featureText("Listen", "聴く")}
          </button>
          ${favoriteButton(song)}
          <button class="action" onclick="window.openPlaylistPicker(${song.id})">
            ${featureText("+ Playlist", "＋プレイリスト")}
          </button>
        </div>
      </div>
    </article>
  `;
}

function installFeatureShell() {
  const nav = document.querySelector(".primary-nav");
  const language = document.querySelector(".language-control");

  const navItems = [
    ["discover", "Explore", "見つける"],
    ["artists", "Artists", "アーティスト"],
    ["playlists", "Playlists", "プレイリスト"]
  ];

  navItems.forEach(([route, en, ja]) => {
    if (nav?.querySelector(`[data-feature-route="${route}"]`)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-item";
    button.dataset.featureRoute = route;
    button.textContent = featureText(en, ja);
    button.addEventListener("click", () => featureNavigate(route));
    nav?.insertBefore(button, language || null);
  });

  const main = document.querySelector("main");
  const featureMarkup = `
    <section id="songDetailFeature" class="screen-panel feature-screen" data-screen="detail"></section>

    <section id="discoverFeature" class="shell section screen-panel feature-screen" data-screen="discover">
      <div class="section-head">
        <div><p class="eyebrow dark" data-feature-copy="discoverEyebrow"></p><h2 data-feature-copy="discoverTitle"></h2></div>
      </div>
      <p class="section-copy" data-feature-copy="discoverCopy"></p>
      <div id="trendingFeatureGrid" class="feature-grid"></div>
      <div class="feature-subhead"><p class="eyebrow dark">NEW RELEASES</p><h3 data-feature-copy="newTitle"></h3></div>
      <div id="newFeatureGrid" class="feature-grid"></div>
    </section>

    <section id="artistsFeature" class="shell section screen-panel feature-screen" data-screen="artists">
      <div class="section-head">
        <div><p class="eyebrow dark">ARTIST INDEX</p><h2 data-feature-copy="artistsTitle"></h2></div>
      </div>
      <p class="section-copy" data-feature-copy="artistsCopy"></p>
      <div id="artistFeatureContent"></div>
    </section>

    <section id="playlistsFeature" class="shell section screen-panel feature-screen" data-screen="playlists">
      <div class="section-head">
        <div><p class="eyebrow dark">YOUR COLLECTIONS</p><h2 data-feature-copy="playlistsTitle"></h2></div>
      </div>
      <form id="createPlaylistForm" class="feature-create-form">
        <input id="newPlaylistName" class="text-input" maxlength="50" required>
        <button class="button" type="submit" data-feature-copy="createPlaylist"></button>
      </form>
      <div id="playlistFeatureContent"></div>
      <button class="text-button feature-history-link" type="button" data-feature-route="history" data-feature-copy="historyLink"></button>
    </section>

    <section id="historyFeature" class="shell section screen-panel feature-screen" data-screen="history">
      <div class="section-head">
        <div><p class="eyebrow dark">LISTENING HISTORY</p><h2 data-feature-copy="historyTitle"></h2></div>
      </div>
      <div id="historyFeatureGrid" class="feature-grid"></div>
      <button id="clearHistoryButton" class="button button-ghost" type="button" data-feature-copy="clearHistory"></button>
    </section>

    <dialog id="playlistPickerDialog" class="feature-dialog">
      <button id="closePlaylistPicker" class="dialog-close" type="button" aria-label="Close">×</button>
      <p class="eyebrow dark">PLAYLIST</p>
      <h2 data-feature-copy="pickerTitle"></h2>
      <input id="playlistPickerSongId" type="hidden">
      <div id="playlistPickerOptions" class="playlist-picker-options"></div>
    </dialog>
  `;

  if (!document.querySelector("#songDetailFeature")) {
    main?.insertAdjacentHTML("beforeend", featureMarkup);
  }

  document.querySelector("#createPlaylistForm")?.addEventListener("submit", createPlaylist);
  document.querySelector("#closePlaylistPicker")?.addEventListener("click", () =>
    document.querySelector("#playlistPickerDialog")?.close()
  );
  document.querySelector("#clearHistoryButton")?.addEventListener("click", clearListeningHistory);
  document.querySelectorAll('[data-feature-route="history"]').forEach((button) =>
    button.addEventListener("click", () => featureNavigate("history"))
  );

  installEnhancedSearch();
  applyFeatureLanguage();
}

function applyFeatureLanguage() {
  const copy = {
    discoverEyebrow: ["DISCOVERY DESK", "発見する"],
    discoverTitle: ["Trending now", "いま注目の曲"],
    discoverCopy: [
      "Fresh additions and songs gaining activity across the community.",
      "新しく追加された曲と、最近サイト内で注目されている曲です。"
    ],
    newTitle: ["New to Japan Hidden Gems", "新しく追加された曲"],
    artistsTitle: ["Browse by artist", "アーティストから探す"],
    artistsCopy: ["Open an artist page to see every registered song.", "アーティストを選ぶと登録曲をまとめて表示します。"],
    playlistsTitle: ["Your playlists", "あなたのプレイリスト"],
    createPlaylist: ["Create playlist", "プレイリストを作成"],
    historyLink: ["Open listening history →", "視聴履歴を見る →"],
    historyTitle: ["Recently played", "最近聴いた曲"],
    clearHistory: ["Clear history", "履歴を削除"],
    pickerTitle: ["Add to a playlist", "プレイリストに追加"]
  };

  document.querySelectorAll("[data-feature-copy]").forEach((element) => {
    const values = copy[element.dataset.featureCopy];
    if (values) element.textContent = featureText(values[0], values[1]);
  });
  const input = document.querySelector("#newPlaylistName");
  if (input) input.placeholder = featureText("Playlist name", "プレイリスト名");

  const labels = {
    discover: featureText("Explore", "見つける"),
    artists: featureText("Artists", "アーティスト"),
    playlists: featureText("Playlists", "プレイリスト")
  };
  Object.entries(labels).forEach(([route, label]) => {
    const element = document.querySelector(`[data-feature-route="${route}"]`);
    if (element) element.textContent = label;
  });

  if (featureState.loaded) renderFeatureRoute(currentView, featureRouteParams());
}

function installEnhancedSearch() {
  const controls = document.querySelector(".ranking-controls");
  if (!controls || document.querySelector("#enhancedSongSearch")) return;

  const label = document.createElement("label");
  label.className = "filter-field feature-search-field";
  label.innerHTML = `
    <span>${featureText("Search", "検索")}</span>
    <input id="enhancedSongSearch" class="text-input" type="search"
      placeholder="${featureText("Title, artist or tag", "曲名・アーティスト・タグ")}">
  `;
  controls.prepend(label);

  label.querySelector("input").addEventListener("input", (event) => {
    featureState.searchQuery = event.target.value.trim().toLowerCase();
    visibleSongCount = SONGS_PER_PAGE;
    render();
  });
}

function songMatchesEnhancedSearch(song) {
  const query = featureState.searchQuery;
  if (!query) return true;
  const tags = (song.tags || []).flatMap((tag) => [tag.label_en, tag.label_ja]);
  return [song.title, song.title_en, song.artist, song.artist_en, ...tags]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
}

const basePerformanceSortedSongs = performanceSortedSongs;
performanceSortedSongs = function () {
  return basePerformanceSortedSongs().filter(songMatchesEnhancedSearch);
};

async function loadFeatureData() {
  if (!currentUser?.id) return;
  const [playlists, playlistSongs, history, feeds] = await Promise.all([
    optionalRest("playlists?select=id,name,description,created_at,updated_at&order=updated_at.desc", { authenticated: true }),
    optionalRest("playlist_songs?select=playlist_id,song_id,position,added_at&order=position.asc,added_at.asc", { authenticated: true }),
    optionalRest("listening_history?select=song_id,first_opened_at,last_opened_at,open_count&order=last_opened_at.desc&limit=50", { authenticated: true }),
    optionalRest("rpc/get_discovery_feeds", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({})
    })
  ]);
  featureState.playlists = playlists || [];
  featureState.playlistSongs = playlistSongs || [];
  featureState.history = history || [];
  featureState.feeds = feeds || [];
  featureState.loaded = true;
  renderFeatureRoute(currentView, featureRouteParams());
}

function renderFeatureRoute(view = currentView, params = {}) {
  if (!featureState.loaded && ["detail", "discover", "artists", "playlists", "history"].includes(view)) return;
  if (view === "detail") renderSongDetail(params.songId || featureRouteParams().songId);
  if (view === "discover") renderDiscover();
  if (view === "artists") renderArtists(params.artist || featureRouteParams().artist);
  if (view === "playlists") renderPlaylists(params.playlistId || featureRouteParams().playlistId);
  if (view === "history") renderHistory();
}

async function recordSongOpen(songId) {
  try {
    await rest("rpc/record_song_open", {
      method: "POST",
      authenticated: true,
      body: JSON.stringify({ p_song_id: Number(songId) })
    });
    const existing = featureState.history.find((row) => Number(row.song_id) === Number(songId));
    if (existing) {
      existing.open_count = Number(existing.open_count) + 1;
      existing.last_opened_at = new Date().toISOString();
    } else {
      featureState.history.unshift({
        song_id: Number(songId),
        first_opened_at: new Date().toISOString(),
        last_opened_at: new Date().toISOString(),
        open_count: 1
      });
    }
  } catch (error) {
    console.warn("Could not record listening history:", error);
  }
}

function openSongDetail(songId) {
  const song = featureSong(songId);
  if (!song) return;
  recordSongOpen(song.id);
  featureNavigate("detail", { songId: song.id });
}

function renderSongDetail(songId) {
  const song = featureSong(songId);
  const target = document.querySelector("#songDetailFeature");
  if (!target) return;
  if (!song) {
    target.innerHTML = `<div class="shell section"><p class="muted">${featureText("Song not found.", "曲が見つかりません。")}</p></div>`;
    return;
  }

  const tags = (song.tags || []).map((tag) =>
    `<button class="song-tag-pill" type="button" onclick="window.filterByFeatureTag(${Number(tag.id)})">${escapeHtml(featureText(tag.label_en, tag.label_ja))}</button>`
  ).join("");

  target.innerHTML = `
    <div class="song-detail-hero">
      <div class="shell song-detail-grid">
        ${songArtwork(song, "song-detail-artwork")}
        <div class="song-detail-copy">
          <p class="eyebrow">${featureText("SONG PROFILE", "曲の詳細")}</p>
          <h1>${escapeHtml(songTitle(song))}</h1>
          <button type="button" class="artist-link" onclick="window.openArtistPage('${encodeURIComponent(song.artist)}')">
            ${escapeHtml(songArtist(song))}
          </button>
          ${song.year ? `<p class="detail-year">${escapeHtml(song.year)}</p>` : ""}
          <div class="song-tags">${tags}</div>
          <div class="actions detail-actions">
            <button class="action primary" onclick="window.openRating(${song.id})">${featureText("Watch & rate", "視聴して評価")}</button>
            ${favoriteButton(song)}
            <button class="action" onclick="window.openPlaylistPicker(${song.id})">${featureText("Add to playlist", "プレイリストに追加")}</button>
            ${similarButton(song)}
          </div>
        </div>
      </div>
    </div>
    <div class="shell detail-body">
      <div class="detail-metric"><span>${featureText("Japan recommendation", "日本での推薦率")}</span><strong>${metric(song.japan, "%")}</strong></div>
      <div class="detail-metric"><span>${featureText("Overseas awareness", "海外での認知度")}</span><strong>${metric(song.awareness, "%")}</strong></div>
      <div class="detail-metric"><span>${featureText("Post-listening rating", "視聴後評価")}</span><strong>${metric(song.overseas, " / 5")}</strong></div>
      <div class="detail-metric detail-score"><span>Hidden Gem Score</span><strong>${song.score === null ? featureText("Pending", "集計中") : song.score}</strong></div>
    </div>
  `;
}

function filterByFeatureTag(tagId) {
  selectedSongTag = Number(tagId);
  if (songTagFilter) songTagFilter.value = String(tagId);
  loadAll().then(() => featureNavigate("ranking"));
}

function renderDiscover() {
  const trending = [...featureState.feeds]
    .sort((a, b) => Number(b.trending_score) - Number(a.trending_score))
    .slice(0, 8);
  const newest = [...featureState.feeds]
    .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
    .slice(0, 8);

  const trendingGrid = document.querySelector("#trendingFeatureGrid");
  const newGrid = document.querySelector("#newFeatureGrid");
  if (trendingGrid) {
    trendingGrid.innerHTML = trending.map((feed, index) =>
      featureCard(
        featureSong(feed.song_id),
        `#${index + 1} · ${featureText("TRENDING", "急上昇")}`,
        featureText(`${feed.activity_7d} activities this week`, `今週${feed.activity_7d}件の反応`)
      )
    ).join("") || `<p class="muted">${featureText("Trending data is still collecting.", "急上昇データを集計中です。")}</p>`;
  }
  if (newGrid) {
    newGrid.innerHTML = newest.map((feed) =>
      featureCard(featureSong(feed.song_id), featureText("NEW", "新着"), featureRelativeTime(feed.added_at))
    ).join("");
  }
}

function artistDirectoryImage(artistSongs, size = "card") {
  const artistName = songArtist(artistSongs[0]);
  const artistImage = artistSongs.find((song) => song.artist_image_url)?.artist_image_url;
  const artworkSong = artistSongs.find((song) => song.youtube_thumbnail_url || song.youtube_video_id || song.youtube_url);
  const artwork = artistImage || (artworkSong
    ? (artworkSong.youtube_thumbnail_url || youtubeThumbnailUrl(artworkSong.youtube_url))
    : "");
  const fallback = escapeHtml((artistName || "J").trim().slice(0, 1).toUpperCase());

  if (!artwork) {
    return `<span class="artist-directory-image artist-directory-image--${size} artist-directory-image--fallback" aria-hidden="true">${fallback}</span>`;
  }

  return `
    <span class="artist-directory-image artist-directory-image--${size}${artistImage ? "" : " artist-directory-image--artwork"}">
      <img src="${escapeHtml(artwork)}" alt="" loading="lazy" decoding="async"
        onerror="this.closest('.artist-directory-image').classList.add('artist-directory-image--failed');this.remove()">
      <span class="artist-directory-image-fallback" aria-hidden="true">${fallback}</span>
    </span>
  `;
}

function renderArtists(selectedArtist = null) {
  const target = document.querySelector("#artistFeatureContent");
  if (!target) return;
  const groups = new Map();
  songs.forEach((song) => {
    const key = song.artist || featureText("Unknown artist", "不明なアーティスト");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(song);
  });

  const artist = selectedArtist ? safeFeatureDecode(selectedArtist) : featureState.activeArtist;
  featureState.activeArtist = artist || null;

  if (artist && groups.has(artist)) {
    const artistSongs = groups.get(artist);
    target.innerHTML = `
      <button class="text-button" type="button" onclick="window.openArtistIndex()">← ${featureText("All artists", "アーティスト一覧")}</button>
      <div class="artist-profile-head">
        ${artistDirectoryImage(artistSongs, "profile")}
        <div class="artist-profile-copy">
          <p class="eyebrow dark">ARTIST PROFILE</p>
          <h3>${escapeHtml(songArtist(artistSongs[0]))}</h3>
          <p class="meta">${artistSongs.length} ${featureText("registered songs", "曲を登録")}</p>
        </div>
      </div>
      <div class="feature-grid">${artistSongs.map((song) => featureCard(song)).join("")}</div>
    `;
    return;
  }

  target.innerHTML = `
    <div class="artist-index-grid">
      ${[...groups.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, artistSongs]) => `
          <button class="artist-index-card" type="button" onclick="window.openArtistPage('${encodeURIComponent(name)}')">
            ${artistDirectoryImage(artistSongs)}
            <span class="artist-index-copy">
              <strong>${escapeHtml(songArtist(artistSongs[0]))}</strong>
              <span>${artistSongs.length} ${featureText("songs", "曲")}</span>
            </span>
          </button>
        `).join("")}
    </div>
  `;
}

function openArtistPage(encodedArtist) {
  const artist = safeFeatureDecode(encodedArtist);
  featureState.activeArtist = artist;
  featureNavigate("artists", { artist });
}

function openArtistIndex() {
  featureState.activeArtist = null;
  featureNavigate("artists", {}, true);
}

async function createPlaylist(event) {
  event.preventDefault();
  const input = document.querySelector("#newPlaylistName");
  const name = input?.value.trim();
  if (!name) return;
  try {
    await rest("playlists", {
      method: "POST",
      authenticated: true,
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: currentUser.id, name })
    });
    input.value = "";
    await loadFeatureData();
    showStatus(featureText("Playlist created.", "プレイリストを作成しました。"));
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

function renderPlaylists(selectedId = null) {
  const target = document.querySelector("#playlistFeatureContent");
  if (!target) return;
  const playlistId = Number(selectedId) || featureState.activePlaylistId;
  const selected = featureState.playlists.find((list) => Number(list.id) === Number(playlistId));

  if (selected) {
    featureState.activePlaylistId = Number(selected.id);
    const entries = featureState.playlistSongs.filter((row) => Number(row.playlist_id) === Number(selected.id));
    target.innerHTML = `
      <button class="text-button" type="button" onclick="window.openPlaylistIndex()">← ${featureText("All playlists", "プレイリスト一覧")}</button>
      <div class="playlist-detail-head">
        <div><p class="eyebrow dark">PLAYLIST</p><h3>${escapeHtml(selected.name)}</h3><p class="meta">${entries.length} ${featureText("songs", "曲")}</p></div>
        <button class="action danger-action" type="button" onclick="window.deletePlaylist(${selected.id})">${featureText("Delete playlist", "削除")}</button>
      </div>
      <div class="playlist-song-list">
        ${entries.map((entry, index) => {
          const song = featureSong(entry.song_id);
          if (!song) return "";
          return `<div class="playlist-song-row"><span class="playlist-position">${String(index + 1).padStart(2, "0")}</span>${featureCard(song)}<button class="action" onclick="window.removeFromPlaylist(${selected.id},${song.id})">${featureText("Remove", "外す")}</button></div>`;
        }).join("") || `<p class="muted">${featureText("This playlist is empty.", "このプレイリストは空です。")}</p>`}
      </div>
    `;
    return;
  }

  featureState.activePlaylistId = null;
  target.innerHTML = featureState.playlists.length
    ? `<div class="playlist-index-grid">${featureState.playlists.map((list) => {
        const count = featureState.playlistSongs.filter((row) => Number(row.playlist_id) === Number(list.id)).length;
        return `<button class="playlist-index-card" type="button" onclick="window.openPlaylist(${list.id})"><span class="playlist-cover-mark">♫</span><strong>${escapeHtml(list.name)}</strong><small>${count} ${featureText("songs", "曲")}</small></button>`;
      }).join("")}</div>`
    : `<p class="muted">${featureText("Create your first playlist above.", "上のフォームから最初のプレイリストを作成できます。")}</p>`;
}

function openPlaylist(id) {
  featureState.activePlaylistId = Number(id);
  featureNavigate("playlists", { playlistId: Number(id) });
}

function openPlaylistIndex() {
  featureState.activePlaylistId = null;
  featureNavigate("playlists", {}, true);
}

function openPlaylistPicker(songId) {
  const dialog = document.querySelector("#playlistPickerDialog");
  const options = document.querySelector("#playlistPickerOptions");
  const input = document.querySelector("#playlistPickerSongId");
  if (!dialog || !options || !input) return;
  input.value = String(songId);
  options.innerHTML = featureState.playlists.length
    ? featureState.playlists.map((list) => `
        <button class="playlist-picker-button" type="button" onclick="window.addToPlaylist(${list.id},${songId})">
          <strong>${escapeHtml(list.name)}</strong>
          <span>＋</span>
        </button>
      `).join("")
    : `<div><p class="muted">${featureText("Create a playlist first.", "先にプレイリストを作成してください。")}</p><button class="button" type="button" onclick="document.querySelector('#playlistPickerDialog').close();window.openPlaylistIndex();">${featureText("Create playlist", "作成する")}</button></div>`;
  dialog.showModal();
}

async function addToPlaylist(playlistId, songId) {
  try {
    const existingCount = featureState.playlistSongs.filter((row) => Number(row.playlist_id) === Number(playlistId)).length;
    await rest("playlist_songs?on_conflict=playlist_id,song_id", {
      method: "POST",
      authenticated: true,
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ playlist_id: Number(playlistId), song_id: Number(songId), position: existingCount })
    });
    document.querySelector("#playlistPickerDialog")?.close();
    await loadFeatureData();
    showStatus(featureText("Added to playlist.", "プレイリストに追加しました。"));
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

async function removeFromPlaylist(playlistId, songId) {
  try {
    await rest(`playlist_songs?playlist_id=eq.${playlistId}&song_id=eq.${songId}`, {
      method: "DELETE", authenticated: true, headers: { Prefer: "return=minimal" }
    });
    await loadFeatureData();
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

async function deletePlaylist(playlistId) {
  if (!window.confirm(featureText("Delete this playlist?", "このプレイリストを削除しますか？"))) return;
  try {
    await rest(`playlists?id=eq.${playlistId}`, {
      method: "DELETE", authenticated: true, headers: { Prefer: "return=minimal" }
    });
    featureState.activePlaylistId = null;
    await loadFeatureData();
    renderPlaylists();
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

function renderHistory() {
  const target = document.querySelector("#historyFeatureGrid");
  if (!target) return;
  target.innerHTML = featureState.history.map((entry) =>
    featureCard(
      featureSong(entry.song_id),
      featureText("RECENTLY PLAYED", "最近再生"),
      featureText(
        `${entry.open_count} opens · ${featureRelativeTime(entry.last_opened_at)}`,
        `${entry.open_count}回 · ${featureRelativeTime(entry.last_opened_at)}`
      )
    )
  ).join("") || `<p class="muted">${featureText("Your listening history will appear here.", "曲を開くと視聴履歴がここに表示されます。")}</p>`;
}

async function clearListeningHistory() {
  if (!window.confirm(featureText("Clear your listening history?", "視聴履歴を削除しますか？"))) return;
  try {
    await rest(`listening_history?user_id=eq.${encodeURIComponent(currentUser.id)}`, {
      method: "DELETE", authenticated: true, headers: { Prefer: "return=minimal" }
    });
    featureState.history = [];
    renderHistory();
  } catch (error) {
    showStatus(error.message, "error", true);
  }
}

const baseSongArtwork = songArtwork;
songArtwork = function (song, extraClass = "") {
  const thumbnail = youtubeThumbnailUrl(song?.youtube_url);
  const classes = ["song-artwork", extraClass].filter(Boolean).join(" ");
  const title = escapeHtml(songTitle(song));
  const id = Number(song?.id);

  return thumbnail
    ? `<button type="button" class="${classes}" onclick="window.openSongDetail?.(${id})" aria-label="${title}"><img src="${thumbnail}" alt="" loading="lazy" decoding="async"><span class="artwork-play" aria-hidden="true">▶</span></button>`
    : `<button type="button" class="${classes} artwork-fallback" onclick="window.openSongDetail?.(${id})" aria-label="${title}"><span>JHG</span></button>`;
};

const baseOpenRating = window.openRating;
window.openRating = function (songId) {
  recordSongOpen(songId);
  baseOpenRating(songId);
};
window.openSongDetail = openSongDetail;
window.openArtistPage = openArtistPage;
window.openArtistIndex = openArtistIndex;
window.filterByFeatureTag = filterByFeatureTag;
window.openPlaylist = openPlaylist;
window.openPlaylistIndex = openPlaylistIndex;
window.openPlaylistPicker = openPlaylistPicker;
window.addToPlaylist = addToPlaylist;
window.removeFromPlaylist = removeFromPlaylist;
window.deletePlaylist = deletePlaylist;

const baseRenderViewForFeatures = renderView;
renderView = function (view, options = {}) {
  baseRenderViewForFeatures(view, options);
  const activeFeatureView = view === "history" ? "playlists" : view;
  document.querySelectorAll("[data-feature-route]").forEach((item) => {
    const active = item.dataset.featureRoute === activeFeatureView;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  renderFeatureRoute(view, options);
};

const baseLoadAllForFeatures = loadAll;
loadAll = async function () {
  await baseLoadAllForFeatures();
  await loadFeatureData();
};

window.addEventListener("popstate", () => {
  const view = routeFromLocation();
  if (["detail", "discover", "artists", "playlists", "history"].includes(view)) {
    renderFeatureRoute(view, featureRouteParams());
  }
});

document.querySelector("#languageSelect")?.addEventListener("change", () =>
  setTimeout(applyFeatureLanguage, 0)
);

installFeatureShell();
renderView(routeFromLocation(), featureRouteParams());
