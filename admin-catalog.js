/* Catalog coverage dashboard. Uses the existing admin RPC payload; no public data is exposed. */
(function () {
  "use strict";

  const GENRE_TARGETS = [
    ["J-Pop", 120], ["J-Rock", 60], ["Rock", 50], ["Idol Pop", 40],
    ["Electronic / Dance", 35], ["R&B / Soul", 30], ["Hip-hop / Rap", 30],
    ["City Pop", 25], ["Vocaloid", 25], ["Anime Song", 25],
    ["Indie / Alternative", 20], ["Metal", 15], ["Punk", 15],
    ["Jazz", 12], ["Folk / Traditional", 12], ["Classical", 8]
  ];
  const ERAS = [
    ["1970s", 1970, 1979, 30], ["1980s", 1980, 1989, 100],
    ["1990s", 1990, 1999, 100], ["2000s", 2000, 2009, 100],
    ["2010s", 2010, 2019, 100], ["2020s", 2020, 2029, 70]
  ];

  const number = (value) => Number(value || 0);
  const percent = (value, total) => total ? Math.round(value / total * 100) : 0;
  const genreTags = () => (Array.isArray(adminTags) ? adminTags : []).filter((tag) => tag.category === "genre");
  const tagLabel = (tag) => tag.label_en || tag.label_ja || tag.slug || `Tag ${tag.id}`;
  const songTagIds = (song) => new Set((song.tag_ids || []).map(Number));
  const genreCount = (label, songs) => {
    const ids = genreTags().filter((tag) => tagLabel(tag) === label).map((tag) => Number(tag.id));
    return songs.filter((song) => ids.some((id) => songTagIds(song).has(id))).length;
  };
  const level = (count, target) => count === 0 ? 0 : count < Math.max(5, target * .35) ? 1 : 2;

  function renderBars(container, rows) {
    if (!container) return;
    container.innerHTML = rows.map(({ label, count, target }) => {
      const ratio = Math.min(100, percent(count, target));
      const state = count === 0 ? "is-empty" : count < Math.max(5, target * .35) ? "is-low" : "";
      return `<div class="coverage-row ${state}">
        <span class="coverage-label">${escapeHtml(label)}</span>
        <span class="coverage-bar" title="目標 ${target}曲"><i style="width:${ratio}%"></i></span>
        <span class="coverage-count">${count} / ${target}</span>
      </div>`;
    }).join("");
  }

  function renderCatalogCoverage() {
    const root = document.querySelector("#catalogCoverage");
    if (!root || !Array.isArray(adminSongs)) return;
    const songs = adminSongs.filter((song) => !song.is_hidden);
    const tagged = songs.filter((song) => genreTags().some((tag) => songTagIds(song).has(Number(tag.id)))).length;
    const withVideo = songs.filter((song) => song.youtube_url || song.youtube_video_id).length;
    const verifiedVideo = songs.filter((song) => ["valid", "verified", "matched", "official"].includes(song.youtube_status)).length;
    const previewReady = songs.filter((song) => song.apple_preview_status === "matched" || song.preview_provider === "youtube").length;
    const catalogSeeds = songs.filter((song) => song.is_catalog_seed).length;

    document.querySelector("#catalogCoverageSummary").innerHTML = [
      [songs.length, "公開曲"], [catalogSeeds, "年代カタログ"],
      [`${percent(tagged, songs.length)}%`, "ジャンル分類済み"],
      [`${percent(withVideo, songs.length)}%`, "YouTube URLあり"],
      [`${percent(previewReady, songs.length)}%`, "プレビュー準備済み"]
    ].map(([value, label]) => `<div class="catalog-stat"><strong>${value}</strong><span>${label}</span></div>`).join("");

    const genres = GENRE_TARGETS.map(([label, target]) => ({ label, target, count: genreCount(label, songs) }));
    const eras = ERAS.map(([label, from, to, target]) => ({
      label, target, count: songs.filter((song) => number(song.year) >= from && number(song.year) <= to).length
    }));
    renderBars(document.querySelector("#catalogGenreCoverage"), genres);
    renderBars(document.querySelector("#catalogEraCoverage"), eras);

    const matrixGenres = genres.filter((row) => row.count > 0 || row.target >= 15).slice(0, 12);
    document.querySelector("#catalogCoverageMatrix").innerHTML = `<table class="coverage-matrix">
      <thead><tr><th>ジャンル</th>${ERAS.map(([label]) => `<th>${label}</th>`).join("")}</tr></thead>
      <tbody>${matrixGenres.map((genre) => `<tr><th>${escapeHtml(genre.label)}</th>${ERAS.map(([, from, to]) => {
        const ids = genreTags().filter((tag) => tagLabel(tag) === genre.label).map((tag) => Number(tag.id));
        const count = songs.filter((song) => number(song.year) >= from && number(song.year) <= to && ids.some((id) => songTagIds(song).has(id))).length;
        return `<td class="coverage-cell" data-level="${level(count, 8)}">${count}</td>`;
      }).join("")}</tr>`).join("")}</tbody>
    </table>`;

    const missingGenres = genres.filter((row) => row.count < Math.max(5, row.target * .35)).sort((a, b) => a.count - b.count);
    const noGenre = songs.length - tagged;
    const noVideo = songs.length - withVideo;
    const unverified = Math.max(0, withVideo - verifiedVideo);
    document.querySelector("#catalogNextActions").innerHTML = [
      [`不足ジャンル ${missingGenres.length}件`, missingGenres.slice(0, 5).map((row) => row.label).join("、") || "基準達成"],
      [`ジャンル未分類 ${noGenre}曲`, "既存曲を分類すると、重複追加せず充実度を改善できます。"],
      [`動画要確認 ${noVideo + unverified}曲`, `URLなし ${noVideo}曲・未検証 ${unverified}曲`]
    ].map(([title, body]) => `<div class="catalog-action"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(body)}</span></div>`).join("");
  }

  async function loadYoutubeCandidates() {
    const container = document.querySelector("#youtubeLinkCandidates");
    if (!container || !accessToken) return;
    try {
      const rows = await rpc("admin_list_youtube_link_candidates");
      container.innerHTML = (rows || []).map((candidate) => `<article class="song-row">
        <div class="song-copy">
          <span class="badge">確認待ち</span>
          <span class="candidate-confidence">一致度 ${Math.round(Number(candidate.confidence || 0) * 100)}%</span>
          <h3>${escapeHtml(candidate.song_title)}</h3>
          <p>${escapeHtml(candidate.song_artist)}</p>
          <p><strong>候補：</strong>${escapeHtml(candidate.video_title)}</p>
          <small>${escapeHtml(candidate.channel_name)} · ${escapeHtml((candidate.official_signals || []).join(" / "))}</small>
        </div>
        <div class="song-actions">
          <a href="${escapeHtml(candidate.youtube_url)}" target="_blank" rel="noopener">動画を確認</a>
          <button type="button" data-youtube-candidate="${candidate.id}" data-accept="true">採用</button>
          <button class="secondary" type="button" data-youtube-candidate="${candidate.id}" data-accept="false">却下</button>
        </div>
      </article>`).join("") || '<p class="empty">確認待ちの候補はありません。</p>';
    } catch (error) {
      container.innerHTML = `<p class="error">候補を取得できません：${escapeHtml(error.message)}</p>`;
    }
  }

  document.querySelector("#youtubeLinkCandidates")?.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-youtube-candidate]");
    if (!button) return;
    button.disabled = true;
    try {
      await rpc("admin_review_youtube_link_candidate", {
        p_candidate_id: Number(button.dataset.youtubeCandidate),
        p_accept: button.dataset.accept === "true"
      });
      await loadSongs();
    } catch (error) {
      document.querySelector("#adminStatus").textContent = "YouTube候補の処理に失敗しました：" + error.message;
      button.disabled = false;
    }
  });

  document.querySelector("#refreshCatalogCoverage")?.addEventListener("click", () => loadSongs());
  const originalLoadSongs = loadSongs;
  loadSongs = async function () {
    await originalLoadSongs();
    renderCatalogCoverage();
    await loadYoutubeCandidates();
  };
})();
