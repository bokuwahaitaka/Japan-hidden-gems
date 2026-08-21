const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";

let songs = [];

async function fetchData(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status} ${errorText}`);
  }

  return response.json();
}

async function loadSongs() {
  try {
    const [songRows, ratings, recommendations] = await Promise.all([
      fetchData("songs?select=id,title,artist,year&order=id.asc"),
      fetchData("ratings?select=song_id,heard_before,rating"),
      fetchData("recommendations?select=song_id,recommended")
    ]);

    songs = songRows.map((song) => {
      const songRatings = ratings.filter(
        (r) => r.song_id === song.id
      );

      const songRecommendations = recommendations.filter(
        (r) => r.song_id === song.id
      );

      const recommendationCount = songRecommendations.filter(
        (r) => r.recommended === true
      ).length;

      const recommendationTotal = songRecommendations.length;

      const knownCount = songRatings.filter(
        (r) => r.heard_before === true
      ).length;

      const totalCount = songRatings.length;

      const rated = songRatings.filter(
        (r) => r.heard_before === false && r.rating > 0
      );

      const averageRating =
        rated.length > 0
          ? rated.reduce((sum, r) => sum + r.rating, 0) /
            rated.length
          : null;

      const japan =
        recommendationTotal > 0
          ? Math.round(
              (recommendationCount / recommendationTotal) * 100
            )
          : null;

      const awareness =
        totalCount > 0
          ? Math.round(
              (knownCount / totalCount) * 100
            )
          : null;

      const overseas =
        averageRating !== null
          ? Number(averageRating.toFixed(1))
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

      return {
        ...song,
        japan,
        awareness,
        overseas,
        score
      };
    });

    render();
  } catch (error) {
    console.error("Failed to load site data:", error);
    alert("Failed to load site data. Please try again.");
  }
}

const cards = document.querySelector("#cards");
const sortSelect = document.querySelector("#sortSelect");

function safeValue(value, fallback) {
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
        safeValue(b.japan, -1) -
        safeValue(a.japan, -1)
    );
  } else if (mode === "overseas") {
    sorted.sort(
      (a, b) =>
        safeValue(a.awareness, 101) -
        safeValue(b.awareness, 101)
    );
  } else {
    sorted.sort(
      (a, b) =>
        safeValue(b.score, -1) -
        safeValue(a.score, -1)
    );
  }

  return sorted;
}

function render() {
  const sortedSongs = getSortedSongs();

  cards.innerHTML = sortedSongs
    .map(
      (s, i) => `
        <article class="card">
          <div class="rank">
            ${String(i + 1).padStart(2, "0")}
          </div>

          <div class="card-main">
            <h3>${s.title}</h3>

            <div class="meta">
              ${s.artist} · ${s.year}
            </div>

            <div class="meters">
              <p>
                Japan recommendation:
                <strong>
                  ${
                    s.japan !== null
                      ? s.japan + "%"
                      : "Collecting data"
                  }
                </strong>
              </p>

              <p>
                Overseas awareness:
                <strong>
                  ${
                    s.awareness !== null
                      ? s.awareness + "%"
                      : "Collecting data"
                  }
                </strong>
              </p>

              <p>
                Overseas post-listening rating:
                <strong>
                  ${
                    s.overseas !== null
                      ? s.overseas + " / 5"
                      : "Collecting data"
                  }
                </strong>
              </p>
            </div>

            <div class="score">
              <strong>
                ${
                  s.score !== null
                    ? s.score
                    : "Pending"
                }
              </strong>

              <span>
                Hidden Gem Score
                ${
                  s.score !== null
                    ? " / 100"
                    : ""
                }
              </span>
            </div>

            <div class="card-actions">
              <button
                class="action-button listen"
                onclick="openRating(${s.id})"
              >
                Listen & Rate
              </button>

              <button
                class="action-button"
                onclick="submitRecommendation(${s.id}, true)"
              >
                Recommend
              </button>

              <button
                class="action-button muted-action"
                onclick="submitRecommendation(${s.id}, false)"
              >
                Not for me
              </button>
            </div>
          </div>
        </article>
      `
    )
    .join("");

  const ratingSections =
    document.querySelector("#ratingSections");

  ratingSections.innerHTML = sortedSongs
    .map(
      (s) => `
        <section
          class="section rating-section"
          data-song-id="${s.id}"
        >
          <p class="eyebrow dark">
            RATE ${s.title}
          </p>

          <h2>
            Have you heard this song before?
          </h2>

          <div class="rating-actions">
            <button
              class="action-button"
              onclick="submitRating(${s.id}, true, 0)"
            >
              Yes, I knew it
            </button>
          </div>

          <h3>
            If not, how would you rate it?
          </h3>

          <div class="rating-actions">
            <button
              class="action-button"
              onclick="submitRating(${s.id}, false, 1)"
            >
              1
            </button>

            <button
              class="action-button"
              onclick="submitRating(${s.id}, false, 2)"
            >
              2
            </button>

            <button
              class="action-button"
              onclick="submitRating(${s.id}, false, 3)"
            >
              3
            </button>

            <button
              class="action-button"
              onclick="submitRating(${s.id}, false, 4)"
            >
              4
            </button>

            <button
              class="action-button"
              onclick="submitRating(${s.id}, false, 5)"
            >
              5
            </button>
          </div>
        </section>
      `
    )
    .join("");

  document.querySelector("#songCount").textContent =
    songs.length;
}

sortSelect?.addEventListener("change", render);

async function submitRating(
  songId,
  heardBefore,
  rating
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/ratings`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        heard_before: heardBefore,
        rating,
        song_id: songId
      })
    }
  );

  if (response.ok) {
    alert("Rating submitted!");
    await loadSongs();
  } else {
    const errorText = await response.text();
    console.error(errorText);
    alert("Failed to submit rating.");
  }
}

function openRating(songId) {
  const section = document.querySelector(
    `[data-song-id="${songId}"]`
  );

  if (section) {
    section.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }
}

async function submitRecommendation(
  songId,
  recommended
) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/recommendations`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        song_id: songId,
        recommended
      })
    }
  );

  if (response.ok) {
    alert("Recommendation submitted!");
    await loadSongs();
  } else {
    const errorText = await response.text();
    console.error(errorText);
    alert("Failed to submit recommendation.");
  }
}

const aboutDialog =
  document.querySelector("#aboutDialog");

const aboutBtn =
  document.querySelector("#aboutBtn");

const closeDialog =
  document.querySelector("#closeDialog");

aboutBtn?.addEventListener("click", () => {
  aboutDialog?.showModal();
});

closeDialog?.addEventListener("click", () => {
  aboutDialog?.close();
});
const japanListener =
  document.querySelector("#japanListener");

const overseasListener =
  document.querySelector("#overseasListener");

function setAudience(type) {
  document.body.dataset.audience = type;

  localStorage.setItem(
    "japanHiddenGemsAudience",
    type
  );

  japanListener?.classList.toggle(
    "is-selected",
    type === "japan"
  );

  overseasListener?.classList.toggle(
    "is-selected",
    type === "overseas"
  );

  if (type === "japan") {
    document
      .querySelector("#ranking")
      ?.scrollIntoView({
        behavior: "smooth"
      });
  }

  if (type === "overseas") {
    document
      .querySelector("#ratingSections")
      ?.scrollIntoView({
        behavior: "smooth"
      });
  }
}

japanListener?.addEventListener(
  "click",
  () => setAudience("japan")
);

overseasListener?.addEventListener(
  "click",
  () => setAudience("overseas")
);

const savedAudience =
  localStorage.getItem(
    "japanHiddenGemsAudience"
  );

if (
  savedAudience === "japan" ||
  savedAudience === "overseas"
) {
  setAudience(savedAudience);
}
loadSongs();

  
