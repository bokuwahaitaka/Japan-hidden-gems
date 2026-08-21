
const songs = [
  {title:"Sample Song A", artist:"Japanese Artist", year:2000, japan:91, awareness:7, overseas:92},
  {title:"Sample Song B", artist:"Japanese Artist", year:2016, japan:88, awareness:11, overseas:90},
  {title:"Sample Song C", artist:"Japanese Artist", year:1998, japan:84, awareness:5, overseas:88},
  {title:"Sample Song D", artist:"Japanese Artist", year:2004, japan:82, awareness:13, overseas:94},
  {title:"Sample Song E", artist:"Japanese Artist", year:2011, japan:79, awareness:4, overseas:86},
  {title:"Sample Song F", artist:"Japanese Artist", year:1987, japan:75, awareness:9, overseas:91}
];

songs.forEach(s => {
  s.score = Math.round((s.japan/100) * (s.overseas/100) * (1-s.awareness/100) * 100);
});

const cards = document.querySelector("#cards");
const sortSelect = document.querySelector("#sortSelect");

function bar(value){
  return `<div class="bar"><span style="width:${value}%"></span></div>`;
}

function render(mode="score"){
  let arr = [...songs];
  if(mode==="score") arr.sort((a,b)=>b.score-a.score);
  if(mode==="japan") arr.sort((a,b)=>b.japan-a.japan);
  if(mode==="overseas") arr.sort((a,b)=>a.awareness-b.awareness);

  cards.innerHTML = arr.map((s,i)=>`
    <article class="card">
      <div class="rank">${String(i+1).padStart(2,"0")}</div>
      <div>
        <h3>${s.title}</h3>
        <div class="meta">${s.artist} · ${s.year}</div>
        <div class="meters">
          <div class="meter-row"><span>Japan recommendation</span>${bar(s.japan)}<b>${s.japan}</b></div>
          <div class="meter-row"><span>Overseas awareness</span>${bar(s.awareness)}<b>${s.awareness}</b></div>
          <div class="meter-row"><span>Post-listening rating</span>${bar(s.overseas)}<b>${s.overseas}</b></div>
        </div>
        <span class="score">Hidden Gem Score ${s.score}</span>
      </div>
    </article>
  `).join("");
}
render();

sortSelect.addEventListener("change",e=>render(e.target.value));

const rating = document.querySelector("#rating");
const ratingValue = document.querySelector("#ratingValue");
rating.addEventListener("input",()=>ratingValue.textContent=`${rating.value} / 5`);

document.querySelector("#ratingForm").addEventListener("submit",e=>{
  e.preventDefault();
  document.querySelector("#thanks").hidden=false;
});

const dialog = document.querySelector("#aboutDialog");
document.querySelector("#aboutBtn").addEventListener("click",()=>dialog.showModal());
document.querySelector("#closeDialog").addEventListener("click",()=>dialog.close());
