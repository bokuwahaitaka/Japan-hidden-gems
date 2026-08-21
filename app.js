const songs = [
  {
    title: "不協和音",
    englishTitle: "Fukyouwaon",
    artist: "欅坂46",
    year: 2017,
    japan: null,
    awareness: null,
    overseas: null
  }
];

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
            <strong>Collecting data</strong>
          </p>

          <p>
            Overseas post-listening rating:
            <strong>Collecting data</strong>
          </p>
        </div>
      </div>

      <div class="score">
        <strong>Pending</strong>
        <span>Hidden Gem Score</span>
      </div>
    </article>
  `).join("");
}

render();
