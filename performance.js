const SONGS_PER_PAGE = 20;
let visibleSongCount = SONGS_PER_PAGE;

function performanceSortedSongs() {
  const sorted = [...songs];
  const mode = document.querySelector("#sortSelect")?.value || "score";

  if (mode === "awareness") {
    sorted.sort((a, b) => safe(a.awareness, 101) - safe(b.awareness, 101));
  } else if (mode === "rating") {
    sorted.sort((a, b) => safe(b.overseas, -1) - safe(a.overseas, -1));
  } else {
    sorted.sort((a, b) => safe(b.score, -1) - safe(a.score, -1));
  }

  return sorted;
}

function performanceCard(song, index) {
  const scoreText = song.score === null ? ui("Pending", "集計待ち") : song.score;
  const scoreSuffix = song.score === null ? "" : " / 100";

  return `
    <article class="card editorial-ranking-card">
      <div class="ranking-artwork-wrap">
        ${songArtwork(song, "ranking-artwork")}
        <span class="rank">${String(index + 1).padStart(2, "0")}</span>
        <div class="artwork-score">
          <strong>${scoreText}</strong>
          <span>${ui("Hidden Gem Score", "隠れた名曲スコア")}${scoreSuffix}</span>
        </div>
      </div>
      <div class="ranking-card-copy">
        <p class="eyebrow dark">${ui("JAPAN HIDDEN GEM", "日本の隠れた名曲")}</p>
        <h3>${escapeHtml(songTitle(song))}</h3>
        <div class="meta">
          ${escapeHtml(songArtist(song))}
          ${song.year ? " · " + escapeHtml(song.year) : ""}
        </div>

        <div class="metrics">
          <p><span>${ui("Overseas awareness", "海外での認知度")}</span><strong>${metric(song.awareness, "%")}</strong></p>
          <p><span>${ui("Post-listening rating", "視聴後評価")}</span><strong>${metric(song.overseas, " / 5")}</strong></p>
        </div>

        <div class="score-row">
          ${song.score !== null && song.provisional ? '<span class="badge">Provisional</span>' : ""}
        </div>

        <p class="sample-note">
          ${song.overseasTotal} ${ui("overseas responses", "件の海外回答")} ·
          ${song.postListenRatingCount} ${ui("ratings", "件の評価")}
        </p>

        <div class="actions">
          <button class="action primary overseas-action" onclick="window.openRating(${song.id})">
            ${ui("Listen & Rate", "聴いて評価")}
          </button>
        </div>
      </div>
    </article>
  `;
}

function performanceRatingSection(song) {
  const embed = youtubeEmbedUrl(song.youtube_url);
  const my = song.myRating;

  return `
    <section class="rating-section" data-song-id="${song.id}">
      <div class="rating-inner">
        <p class="eyebrow dark">${ui("RATE", "評価")} ${escapeHtml(songTitle(song))}</p>
        <h2>${ui("Have you heard this song before?", "この曲を以前から知っていましたか？")}</h2>

        ${embed ? `
          <div class="preview">
            <iframe
              src="${embed}"
              loading="lazy"
              title="${escapeHtml(songTitle(song))}"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
            ></iframe>
          </div>
        ` : `
          <div class="no-preview">
            ${ui("A listening preview has not been added for this song yet.", "この曲にはまだ試聴動画が登録されていません。")}
          </div>
        `}

        <div class="rating-actions" role="group" aria-label="${ui("Prior awareness", "視聴前の認知")}">
          <button
            class="action ${my?.heard_before === true ? "selected" : ""}"
            type="button"
            aria-pressed="${my?.heard_before === true}"
            onclick="window.submitRating(${song.id}, true, null)"
          >
            ${my?.heard_before === true ? `${ui("Yes, I knew it", "はい、知っていました")} ✓` : ui("Yes, I knew it", "はい、知っていました")}
          </button>
          <button
            class="action ${my?.heard_before === false ? "selected" : ""}"
            type="button"
            aria-pressed="${my?.heard_before === false}"
            onclick="document.getElementById('rating-${song.id}-1')?.focus()"
          >
            ${ui("No, this is my first listen", "いいえ、初めて聴きました")}
          </button>
        </div>

        <h3 id="rating-${song.id}-label">${ui("First listen: how would you rate it?", "初めて聴いた評価を教えてください。")}</h3>

        <div class="rating-actions" role="radiogroup" aria-labelledby="rating-${song.id}-label">
          ${[1, 2, 3, 4, 5].map((value) => `
            <button
              id="rating-${song.id}-${value}"
              type="button"
              role="radio"
              aria-checked="${my?.heard_before === false && Number(my.rating) === value}"
              aria-label="${ui(`${value} out of 5`, `5段階中${value}`)}"
              class="action ${my?.heard_before === false && Number(my.rating) === value ? "selected" : ""}"
              onclick="window.submitRating(${song.id}, false, ${value})"
            >
              ${value}${my?.heard_before === false && Number(my.rating) === value ? " ✓" : ""}
            </button>
          `).join("")}
        </div>

        ${my ? `<p class="sample-note">${ui("Choosing again updates your previous response.", "もう一度選ぶと以前の回答が更新されます。")}</p>` : ""}
      </div>
    </section>
  `;
}

renderRatingSections = function () {
  ratingSections.innerHTML = "";
};

function restorePerformanceRating(songId) {
  const numericSongId = Number(songId);
  const song = songs.find((item) => Number(item.id) === numericSongId);
  if (!song) return false;

  activeRatingSongId = numericSongId;
  ratingSections.innerHTML = performanceRatingSection(song);
  syncListenView();
  return true;
}

render = function () {
  const sortedSongs = performanceSortedSongs();

  if (!sortedSongs.length) {
    cards.innerHTML = '<p class="muted">No songs found.</p>';
    ratingSections.innerHTML = "";
    return;
  }

  const visibleSongs = sortedSongs.slice(0, visibleSongCount);
  cards.innerHTML = visibleSongs.map(performanceCard).join("");

  if (visibleSongCount < sortedSongs.length) {
    cards.insertAdjacentHTML(
      "beforeend",
      `<div style="display:flex;justify-content:center;padding:20px 0 8px;">
        <button id="loadMoreSongs" class="button" type="button">
          ${ui("Show", "さらに")} ${Math.min(SONGS_PER_PAGE, sortedSongs.length - visibleSongCount)} ${ui("more", "曲を表示")}
        </button>
      </div>`
    );

    document.querySelector("#loadMoreSongs")?.addEventListener("click", () => {
      visibleSongCount += SONGS_PER_PAGE;
      render();
    });
  }

  const routeSongId = routeFromLocation() === "listen" ? songFromLocation() : null;
  if (!routeSongId || !restorePerformanceRating(routeSongId)) {
    ratingSections.innerHTML = "";
  }
};

openRating = function (songId) {
  if (!restorePerformanceRating(songId)) return;
  navigateTo("listen", { songId });
};

window.openRating = openRating;

const performanceSortSelect = document.querySelector("#sortSelect");
performanceSortSelect?.addEventListener("change", () => {
  visibleSongCount = SONGS_PER_PAGE;
  render();
});
