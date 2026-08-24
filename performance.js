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
        <p class="eyebrow dark">RATE ${escapeHtml(songTitle(song))}</p>
        <h2>Have you heard this song before?</h2>

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
            A listening preview has not been added for this song yet.
          </div>
        `}

        <div class="rating-actions">
          <button
            class="action ${my?.heard_before === true ? "selected" : ""}"
            onclick="window.submitRating(${song.id}, true, null)"
          >
            ${my?.heard_before === true ? "Yes, I knew it ✓" : "Yes, I knew it"}
          </button>
        </div>

        <h3>If not, how would you rate it after listening?</h3>

        <div class="rating-actions">
          ${[1, 2, 3, 4, 5].map((value) => `
            <button
              class="action ${my?.heard_before === false && Number(my.rating) === value ? "selected" : ""}"
              onclick="window.submitRating(${song.id}, false, ${value})"
            >
              ${value}${my?.heard_before === false && Number(my.rating) === value ? " ✓" : ""}
            </button>
          `).join("")}
        </div>

        ${my ? '<p class="sample-note">Choosing again updates your previous response.</p>' : ""}
      </div>
    </section>
  `;
}

renderRatingSections = function () {
  ratingSections.innerHTML = "";
};

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

  ratingSections.innerHTML = "";
};

openRating = function (songId) {
  const song = songs.find((item) => item.id === songId);
  if (!song) return;

  ratingSections.innerHTML = performanceRatingSection(song);
  navigateTo("listen", { songId });
};

window.openRating = openRating;

const performanceSortSelect = document.querySelector("#sortSelect");
performanceSortSelect?.addEventListener("change", () => {
  visibleSongCount = SONGS_PER_PAGE;
  render();
});
