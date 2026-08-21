const SUPABASE_URL = "https://erfidvsxhhxogthyikgr.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZFx5EEhesI7GfwX9eWyYpQ_4NKrb2Ge";
let songs = [];

async function loadSongs() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/songs?select=id,title,artist,year&order=id.asc`,
    {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    }
  );

  if (!response.ok) {
    console.error("Failed to load songs");
    return;
  }

  songs = await response.json();
  const ratingsResponse = await fetch(
  `${SUPABASE_URL}/rest/v1/ratings?select=song_id,heard_before,rating`,
  {
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`
    }
  }
);

if (!ratingsResponse.ok) {
  console.error("Failed to load ratings");
  
}

const ratings = await ratingsResponse.json();
  

  render();
}

const cards = document.querySelector("#cards");
const sortSelect = document.querySelector("#sortSelect");

function render() {
  cards.innerHTML = songs.map((s, i) => `
    <article class="card">
      <div class="rank">${String(i + 1).padStart(2, "0")}</div>

      <div>
        <h3>${s.title}</h3>
        <div class="meta">
          ${s.englishTitle} · ${s.artist} · ${s.year}
        </div>

        <div class="meters">
          <p>
            Japan recommendation:
            <strong>Collecting data</strong>
          </p>

          <p>
            Overseas awareness:
<strong>${s.awareness !== null ? s.awareness + "%" : "Collecting data"}</strong>
          </p>

          <p>
            Overseas post-listening rating:
<strong>${s.overseas !== null ? s.overseas + " / 5" : "Collecting data"}</strong>
          </p>
        </div>
      </div>
<div class="score">
  <strong>Pending</strong>
  <span>Hidden Gem Score</span>

  <button onclick="openRating(${s.id})">
    Listen & Rate
  </button>
</div>
      
    </article>
  `).join("");
  const ratingSections = document.querySelector("#ratingSections");

ratingSections.innerHTML = songs.map((s) => `
  <section class="section" data-song-id="${s.id}">
    <p class="eyebrow dark">RATE ${s.title}</p>

    <h2>Have you heard this song before?</h2>

    <button onclick="submitRating(${s.id}, true, 0)">
      Yes, I knew it
    </button>

    <h2>If not, how would you rate it?</h2>

    <button onclick="submitRating(${s.id}, false, 1)">1</button>
    <button onclick="submitRating(${s.id}, false, 2)">2</button>
    <button onclick="submitRating(${s.id}, false, 3)">3</button>
    <button onclick="submitRating(${s.id}, false, 4)">4</button>
    <button onclick="submitRating(${s.id}, false, 5)">5</button>
  </section>
`).join("");
  }
document.querySelector("#songCount").textContent = songs.length;
loadSongs();
async function submitRating(songId, heardBefore, rating) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/ratings`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
  heard_before: heardBefore,
  rating: rating,
  song_id: songId
})
  });

  if (response.ok) {
    alert("Rating submitted!");
  } else {
    alert("Failed to submit rating.");
  }
}
function openRating(songId) {
  const section = document.querySelector(`[data-song-id="${songId}"]`);
  if (section) {
    section.scrollIntoView({ behavior: "smooth" });
  }
}
