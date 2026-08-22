const SONGS_PER_PAGE = 20;
let visibleSongCount = SONGS_PER_PAGE;

function performanceSortedSongs() {
  const sorted = [...songs];
  const mode = document.querySelector("#sortSelect")?.value || "score";

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

function performanceCard(song, index) {
  const recommended = song.myRecommendation?.recommended;
  const scoreText = song.score === null ? ui("Pending", "集計待ち") : song.score;
  const scoreSuffix = song.score === null ? "" : " / 100";

  return `
    <article class="card">
      <div class="rank">${String(index + 1).padStart(2, "0")}</div>
      <div>
        <h3>${escapeHtml(song.title)}</h3>
        <div class="meta">
          ${escapeHtml(song.artist)}
          ${song.year ? " · " + escapeHtml(song.year) : ""}
        </div>

        <div class="metrics">
          <p>${ui("Japan recommendation:", "日本での推薦率：")} <strong>${metric(song.japan, "%")}</strong></p>
          <p>${ui("Overseas awareness:", "海外での認知度：")} <strong>${metric(song.awareness, "%")}</strong></p>
          <p>${ui("Overseas post-listening rating:", "海外での視聴後評価：")} <strong>${metric(song.overseas, " / 5")}</strong></p>
        </div>

        <div class="score-row">
          <strong>${scoreText}</strong>
          <span>${ui("Hidden Gem Score", "隠れた名曲スコア")} ${scoreSuffix}</span>
          ${song.score !== null && song.provisional ? '<span class="badge">Provisional</span>' : ""}
        </div>

        <p class="sample-note">
          ${song.recommendationTotal} ${ui("Japan votes", "件の日本投票")} ·
          ${song.overseasTotal} ${ui("overseas responses", "件の海外回答")} ·
          ${song.postListenRatingCount} ${ui("post-listening ratings", "件の視聴後評価")}
        </p>

        <div class="actions">
          <button class="action primary overseas-action" onclick="window.openRating(${song.id})">
            Listen & Rate
          </button>

          <button
            class="action japan-action ${recommended === true ? "selected" : ""}"
            onclick="window.submitRecommendation(${song.id}, true)"
          >
            ${recommended === true ? ui("Recommended ✓", "推薦済み ✓") : ui("Recommend", "推薦する")}
          </button>

          <button
            class="action japan-action ${recommended === false ? "selected" : ""}"
            onclick="window.submitRecommendation(${song.id}, false)"
          >
            ${recommended === false ? ui("Not for me ✓", "推薦しない ✓") : ui("Not for me", "推薦しない")}
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
        <p class="eyebrow dark">RATE ${escapeHtml(song.title)}</p>
        <h2>Have you heard this song before?</h2>

        ${embed ? `
          <div class="preview">
            <iframe
              src="${embed}"
              loading="lazy"
              title="${escapeHtml(song.title)}"
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
  ratingSections
    .querySelector(`[data-song-id="${songId}"]`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.openRating = openRating;

const performanceSortSelect = document.querySelector("#sortSelect");
performanceSortSelect?.addEventListener("change", () => {
  visibleSongCount = SONGS_PER_PAGE;
  render();
});
