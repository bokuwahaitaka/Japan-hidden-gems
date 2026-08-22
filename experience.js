/* Japan Hidden Gems — World Cup, extended locales and feedback box */
const EXPERIENCE_LANGUAGES = ["ja", "en", "ko", "zh", "ru", "es", "fr"];

const EXPERIENCE_COPY = {
  ja: {
    cupNav: "J-POP杯", feedbackNav: "目安箱", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "一曲ずつ選んで、あなたの優勝曲を決めよう。",
    cupCopy: "ランダム、または好きなジャンル・タグから8曲を選び、トーナメント形式で比べます。",
    mode: "出場曲", random: "ランダム", tag: "ジャンル・タグ指定", tagLabel: "ジャンル・タグ",
    start: "8曲で開始", choose: "この曲を選ぶ", listen: "聴いてみる", champion: "あなたの優勝曲",
    again: "もう一度遊ぶ", needSongs: "この条件ではYouTubeリンク付きの曲が8曲必要です。",
    saving: "結果を保存中…", saved: "トーナメント結果を保存しました。",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "運営への目安箱",
    feedbackCopy: "追加してほしい機能、不具合、曲や内容についての要望を送れます。",
    category: "種類", feature: "機能の要望", bug: "不具合", song: "曲について", content: "内容について", other: "その他",
    message: "要望", placeholder: "10〜2000文字で入力してください", send: "運営へ送る",
    sent: "要望を受け付けました。ありがとうございます。", sendError: "送信できませんでした。しばらくしてから再度お試しください。",
    japanHero: "好きなJ-POPを、世界へ。", japanLead: "あなたの好きなJ-POPを海外のリスナーに教えてあげよう！推薦した曲は世界のリスナーの評価につながります。",
    round1: "準々決勝", round2: "準決勝", round3: "決勝"
  },
  en: {
    cupNav: "J-POP Cup", feedbackNav: "Feedback", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "Pick one song at a time. Crown your champion.",
    cupCopy: "Compare eight random songs—or filter them by genre and tag—in a knockout tournament.",
    mode: "Entrants", random: "Random", tag: "Genre or tag", tagLabel: "Genre or tag",
    start: "Start with 8 songs", choose: "Pick this song", listen: "Listen", champion: "Your champion",
    again: "Play again", needSongs: "This selection needs at least eight songs with YouTube links.",
    saving: "Saving result…", saved: "Tournament result saved.",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "Send a suggestion",
    feedbackCopy: "Tell the team about a feature request, bug, song, or content improvement.",
    category: "Category", feature: "Feature request", bug: "Bug", song: "Song", content: "Content", other: "Other",
    message: "Message", placeholder: "Write 10–2000 characters", send: "Send to the team",
    sent: "Thanks—your suggestion was received.", sendError: "Could not send your suggestion. Please try again.",
    japanHero: "Share the J-pop you love.", japanLead: "Recommend your favorite J-pop to listeners around the world.",
    round1: "Quarterfinal", round2: "Semifinal", round3: "Final"
  },
  ko: {
    cupNav: "J-POP 컵", feedbackNav: "의견함", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "한 곡씩 선택해 나만의 우승곡을 정하세요.", cupCopy: "무작위 또는 장르·태그별 8곡을 토너먼트로 비교합니다.",
    mode: "참가곡", random: "무작위", tag: "장르·태그", tagLabel: "장르·태그", start: "8곡으로 시작",
    choose: "이 곡 선택", listen: "듣기", champion: "나의 우승곡", again: "다시 하기",
    needSongs: "이 조건에는 YouTube 링크가 있는 곡이 8곡 이상 필요합니다.", saving: "결과 저장 중…", saved: "토너먼트 결과를 저장했습니다.",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "운영팀에 의견 보내기", feedbackCopy: "기능 요청, 오류, 곡 또는 콘텐츠에 대한 의견을 보내세요.",
    category: "종류", feature: "기능 요청", bug: "오류", song: "곡", content: "콘텐츠", other: "기타",
    message: "의견", placeholder: "10~2000자로 입력하세요", send: "운영팀에 보내기", sent: "의견이 접수되었습니다. 감사합니다.", sendError: "전송하지 못했습니다. 다시 시도해 주세요.",
    japanHero: "좋아하는 J-POP을 세계로.", japanLead: "당신이 좋아하는 J-POP을 해외 리스너에게 추천해 보세요.",
    round1: "8강", round2: "준결승", round3: "결승"
  },
  zh: {
    cupNav: "J-POP杯", feedbackNav: "意见箱", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "逐首选择，选出你的冠军歌曲。", cupCopy: "从随机歌曲或指定曲风、标签中选出8首，进行淘汰赛。",
    mode: "参赛歌曲", random: "随机", tag: "曲风或标签", tagLabel: "曲风或标签", start: "以8首歌曲开始",
    choose: "选择这首", listen: "试听", champion: "你的冠军歌曲", again: "再玩一次",
    needSongs: "此条件下至少需要8首带YouTube链接的歌曲。", saving: "正在保存结果…", saved: "比赛结果已保存。",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "给运营团队留言", feedbackCopy: "可提交功能建议、错误、歌曲或内容方面的意见。",
    category: "类别", feature: "功能建议", bug: "错误", song: "歌曲", content: "内容", other: "其他",
    message: "意见", placeholder: "请输入10至2000个字符", send: "发送给运营团队", sent: "已收到你的意见，谢谢。", sendError: "发送失败，请稍后重试。",
    japanHero: "把你喜欢的J-POP分享给世界。", japanLead: "向世界各地的听众推荐你喜欢的J-POP。",
    round1: "四分之一决赛", round2: "半决赛", round3: "决赛"
  },
  ru: {
    cupNav: "Кубок J-POP", feedbackNav: "Отзывы", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "Выбирайте по одной песне и определите чемпиона.", cupCopy: "Сравните восемь случайных песен или выберите жанр и тег.",
    mode: "Участники", random: "Случайно", tag: "Жанр или тег", tagLabel: "Жанр или тег", start: "Начать с 8 песен",
    choose: "Выбрать эту песню", listen: "Слушать", champion: "Ваш чемпион", again: "Сыграть ещё раз",
    needSongs: "Нужно не менее восьми песен со ссылками YouTube.", saving: "Сохранение…", saved: "Результат сохранён.",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "Отправить предложение", feedbackCopy: "Сообщите о функции, ошибке, песне или улучшении контента.",
    category: "Категория", feature: "Новая функция", bug: "Ошибка", song: "Песня", content: "Контент", other: "Другое",
    message: "Сообщение", placeholder: "От 10 до 2000 символов", send: "Отправить команде", sent: "Спасибо, предложение получено.", sendError: "Не удалось отправить. Попробуйте ещё раз.",
    japanHero: "Поделитесь любимым J-pop с миром.", japanLead: "Рекомендуйте любимые J-pop песни слушателям по всему миру.",
    round1: "Четвертьфинал", round2: "Полуфинал", round3: "Финал"
  },
  es: {
    cupNav: "Copa J-POP", feedbackNav: "Sugerencias", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "Elige canción por canción y corona a tu campeona.", cupCopy: "Compara ocho canciones aleatorias o filtra por género y etiqueta.",
    mode: "Participantes", random: "Aleatorio", tag: "Género o etiqueta", tagLabel: "Género o etiqueta", start: "Empezar con 8 canciones",
    choose: "Elegir esta canción", listen: "Escuchar", champion: "Tu campeona", again: "Jugar otra vez",
    needSongs: "Se necesitan ocho canciones con enlace de YouTube.", saving: "Guardando…", saved: "Resultado guardado.",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "Enviar una sugerencia", feedbackCopy: "Cuéntanos una función, error, canción o mejora de contenido.",
    category: "Categoría", feature: "Nueva función", bug: "Error", song: "Canción", content: "Contenido", other: "Otro",
    message: "Mensaje", placeholder: "Escribe entre 10 y 2000 caracteres", send: "Enviar al equipo", sent: "Gracias, recibimos tu sugerencia.", sendError: "No se pudo enviar. Inténtalo de nuevo.",
    japanHero: "Comparte el J-pop que amas.", japanLead: "Recomienda tu J-pop favorito a oyentes de todo el mundo.",
    round1: "Cuartos de final", round2: "Semifinal", round3: "Final"
  },
  fr: {
    cupNav: "Coupe J-POP", feedbackNav: "Suggestions", cupEyebrow: "J-POP WORLD CUP",
    cupTitle: "Choisissez chanson par chanson et couronnez votre gagnante.", cupCopy: "Comparez huit chansons au hasard ou filtrez par genre et étiquette.",
    mode: "Participants", random: "Aléatoire", tag: "Genre ou étiquette", tagLabel: "Genre ou étiquette", start: "Commencer avec 8 chansons",
    choose: "Choisir ce titre", listen: "Écouter", champion: "Votre gagnante", again: "Rejouer",
    needSongs: "Il faut huit chansons avec un lien YouTube.", saving: "Enregistrement…", saved: "Résultat enregistré.",
    feedbackEyebrow: "SUGGESTION BOX", feedbackTitle: "Envoyer une suggestion", feedbackCopy: "Signalez une fonctionnalité, un bug, une chanson ou une amélioration.",
    category: "Catégorie", feature: "Fonctionnalité", bug: "Bug", song: "Chanson", content: "Contenu", other: "Autre",
    message: "Message", placeholder: "Écrivez entre 10 et 2000 caractères", send: "Envoyer à l’équipe", sent: "Merci, votre suggestion a été reçue.", sendError: "Envoi impossible. Réessayez.",
    japanHero: "Partagez le J-pop que vous aimez.", japanLead: "Recommandez votre J-pop préféré aux auditeurs du monde entier.",
    round1: "Quart de finale", round2: "Demi-finale", round3: "Finale"
  }
};

const EXPERIENCE_UI = {
  "Explore": { ko:"둘러보기", zh:"探索", ru:"Обзор", es:"Explorar", fr:"Explorer" },
  "Artists": { ko:"아티스트", zh:"艺人", ru:"Исполнители", es:"Artistas", fr:"Artistes" },
  "Playlists": { ko:"플레이리스트", zh:"播放列表", ru:"Плейлисты", es:"Listas", fr:"Playlists" },
  "History": { ko:"감상 기록", zh:"收听记录", ru:"История", es:"Historial", fr:"Historique" },
  "Listen": { ko:"듣기", zh:"试听", ru:"Слушать", es:"Escuchar", fr:"Écouter" },
  "+ Playlist": { ko:"＋플레이리스트", zh:"＋播放列表", ru:"＋Плейлист", es:"＋Lista", fr:"＋Playlist" },
  "All artists": { ko:"모든 아티스트", zh:"所有艺人", ru:"Все исполнители", es:"Todos los artistas", fr:"Tous les artistes" },
  "registered songs": { ko:"곡 등록", zh:"首已收录", ru:"треков", es:"canciones registradas", fr:"titres enregistrés" },
  "songs": { ko:"곡", zh:"首歌曲", ru:"песен", es:"canciones", fr:"titres" },
  "Open ranking →": { ko:"랭킹 열기 →", zh:"打开排行榜 →", ru:"Открыть рейтинг →", es:"Abrir clasificación →", fr:"Voir le classement →" },
  "Loading…": { ko:"불러오는 중…", zh:"加载中…", ru:"Загрузка…", es:"Cargando…", fr:"Chargement…" }
};

const originalExperienceUi = ui;
ui = function(en, ja) {
  if (interfaceLanguage === "ja") return ja;
  return EXPERIENCE_UI[en]?.[interfaceLanguage] || en;
};

const EXPERIENCE_STATIC = {
  "#homeNavLabel": { ko:"홈", zh:"首页", ru:"Главная", es:"Inicio", fr:"Accueil" },
  "#rankingNavLabel": { ko:"랭킹", zh:"排行榜", ru:"Рейтинг", es:"Clasificación", fr:"Classement" },
  "#genresNavLabel": { ko:"장르", zh:"曲风", ru:"Жанры", es:"Géneros", fr:"Genres" },
  "#personalizedNavLabel": { ko:"추천", zh:"为你推荐", ru:"Для вас", es:"Para ti", fr:"Pour vous" },
  "#favoritesBtn": { ko:"내 숨은 명곡", zh:"我的珍藏", ru:"Избранное", es:"Mis joyas", fr:"Mes pépites" },
  "#accountBtn": { ko:"계정", zh:"账户", ru:"Аккаунт", es:"Cuenta", fr:"Compte" },
  "#aboutBtn": { ko:"이용 방법", zh:"使用方法", ru:"Как это работает", es:"Cómo funciona", fr:"Fonctionnement" },
  "#languageLabel": { ko:"언어", zh:"语言", ru:"Язык", es:"Idioma", fr:"Langue" },
  "#heroTitle": { ko:"다음에 좋아할 일본 음악.", zh:"你的下一首日本心头好。", ru:"Ваш следующий любимый трек из Японии.", es:"Tu próxima canción japonesa favorita.", fr:"Votre prochain coup de cœur japonais." },
  "#heroLead": { ko:"숨은 일본 히트곡을 발견하고 평가해 보세요.", zh:"发现被低估的日本歌曲，并帮助佳作脱颖而出。", ru:"Открывайте недооценённые японские хиты и помогайте лучшим подняться.", es:"Descubre éxitos japoneses poco conocidos y ayuda a destacar a los mejores.", fr:"Découvrez des titres japonais méconnus et faites monter les meilleurs." },
  "#rankingTitle": { ko:"숨은 명곡 랭킹", zh:"隐藏名曲排行榜", ru:"Рейтинг скрытых жемчужин", es:"Índice de joyas ocultas", fr:"Classement des pépites" },
  "#genresTitle": { ko:"취향에 맞는 사운드를 찾으세요.", zh:"找到你的声音。", ru:"Найдите своё звучание.", es:"Encuentra tu sonido.", fr:"Trouvez votre son." }
};

VALID_VIEWS.add("cup");
VALID_VIEWS.add("feedback");
let cupState = null;

function experienceText(key) {
  return (EXPERIENCE_COPY[interfaceLanguage] || EXPERIENCE_COPY.en)[key] || EXPERIENCE_COPY.en[key] || key;
}

function experienceLocale() {
  const lang = EXPERIENCE_LANGUAGES.includes(interfaceLanguage) ? interfaceLanguage : "en";
  document.documentElement.lang = lang === "zh" ? "zh-CN" : lang;
  Object.entries(EXPERIENCE_STATIC).forEach(([selector, translations]) => {
    if (translations[lang] && document.querySelector(selector)) document.querySelector(selector).textContent = translations[lang];
  });
  const cupNav = document.querySelector("[data-experience-route='cup']");
  const feedbackNav = document.querySelector("[data-experience-route='feedback']");
  if (cupNav) cupNav.textContent = experienceText("cupNav");
  if (feedbackNav) feedbackNav.textContent = experienceText("feedbackNav");
  const ids = {
    cupEyebrow:"cupEyebrow", cupTitle:"cupTitle", cupCopy:"cupCopy", cupModeLabel:"mode",
    cupRandomOption:"random", cupTagOption:"tag", cupTagLabel:"tagLabel", cupStart:"start",
    feedbackEyebrow:"feedbackEyebrow", feedbackTitle:"feedbackTitle", feedbackCopy:"feedbackCopy",
    feedbackCategoryLabel:"category", feedbackFeatureOption:"feature", feedbackBugOption:"bug",
    feedbackSongOption:"song", feedbackContentOption:"content", feedbackOtherOption:"other",
    feedbackMessageLabel:"message", feedbackSend:"send"
  };
  Object.entries(ids).forEach(([id,key]) => {
    const el=document.getElementById(id); if(el) el.textContent=experienceText(key);
  });
  const msg=document.getElementById("feedbackMessage"); if(msg) msg.placeholder=experienceText("placeholder");
  if ((audience || document.body.dataset.audience) === "japan") {
    const title=document.getElementById("heroTitle"); const lead=document.getElementById("heroLead");
    if(title) title.textContent=experienceText("japanHero");
    if(lead) lead.textContent=experienceText("japanLead");
  }
  renderCup();
}

function installExperienceShell() {
  VALID_VIEWS.add("cup"); VALID_VIEWS.add("feedback");
  const nav=document.querySelector(".primary-nav");
  const language=document.querySelector(".language-control");
  [["cup","cupNav"],["feedback","feedbackNav"]].forEach(([route,key])=>{
    if(nav?.querySelector("[data-experience-route='"+route+"']")) return;
    const b=document.createElement("button"); b.type="button"; b.className="nav-item";
    b.dataset.experienceRoute=route; b.textContent=experienceText(key);
    b.addEventListener("click",()=>navigateTo(route));
    nav?.insertBefore(b,language);
  });
  document.querySelector("main")?.insertAdjacentHTML("beforeend", `
    <section class="shell section screen-panel cup-screen" data-screen="cup">
      <p id="cupEyebrow" class="eyebrow dark"></p><h2 id="cupTitle"></h2><p id="cupCopy" class="section-copy"></p>
      <div class="cup-setup">
        <label class="filter-field"><span id="cupModeLabel"></span><select id="cupMode" class="select"><option id="cupRandomOption" value="random"></option><option id="cupTagOption" value="tag"></option></select></label>
        <label id="cupTagField" class="filter-field hidden"><span id="cupTagLabel"></span><select id="cupTag" class="select"></select></label>
        <button id="cupStart" class="button action primary" type="button"></button>
      </div>
      <p id="cupStatus" class="section-copy" aria-live="polite"></p><div id="cupArena"></div>
    </section>
    <section class="shell section screen-panel feedback-screen" data-screen="feedback">
      <p id="feedbackEyebrow" class="eyebrow dark"></p><h2 id="feedbackTitle"></h2><p id="feedbackCopy" class="section-copy"></p>
      <form id="feedbackForm" class="feedback-form">
        <label class="form-field"><span id="feedbackCategoryLabel"></span><select id="feedbackCategory" class="select"><option id="feedbackFeatureOption" value="feature"></option><option id="feedbackBugOption" value="bug"></option><option id="feedbackSongOption" value="song"></option><option id="feedbackContentOption" value="content"></option><option id="feedbackOtherOption" value="other"></option></select></label>
        <label class="form-field"><span id="feedbackMessageLabel"></span><textarea id="feedbackMessage" class="text-input feedback-message" minlength="10" maxlength="2000" required></textarea></label>
        <button id="feedbackSend" class="button action primary" type="submit"></button><p id="feedbackStatus" class="section-copy" aria-live="polite"></p>
      </form>
    </section>
  `);
  document.querySelector("#cupMode")?.addEventListener("change", (e)=>document.querySelector("#cupTagField")?.classList.toggle("hidden",e.target.value!=="tag"));
  document.querySelector("#cupStart")?.addEventListener("click", startCup);
  document.querySelector("#feedbackForm")?.addEventListener("submit", submitFeedback);
  document.querySelectorAll("#japanListener,#overseasListener,#changeAudienceBtn").forEach(el=>el.addEventListener("click",()=>setTimeout(experienceLocale,0)));
  const observer=new MutationObserver(()=>experienceLocale()); observer.observe(document.body,{attributes:true,attributeFilter:["data-audience"]});
  populateCupTags(); experienceLocale();
}

function populateCupTags() {
  const select=document.querySelector("#cupTag"); if(!select) return;
  select.innerHTML=(songTagOptions||[]).filter(t=>t.category==="genre" || t.category==="mood").map(t=>`<option value="${Number(t.id)}">${escapeHtml(interfaceLanguage==="ja"?(t.label_ja||t.label_en):t.label_en)}</option>`).join("");
}

function shuffled(items) {
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}

async function startCup() {
  const mode=document.querySelector("#cupMode")?.value || "random";
  const tagId=mode==="tag"?Number(document.querySelector("#cupTag")?.value):null;
  let eligible=[...songs];
  if(tagId) eligible=eligible.filter(s=>(s.tags||[]).some(t=>Number(t.id)===tagId));
  const status=document.querySelector("#cupStatus");
  if(eligible.length<8){if(status) status.textContent=experienceText("needSongs");return;}
  const entrants=shuffled(eligible).slice(0,8);
  try {
    const rows=await rest("tournament_runs?select=id",{method:"POST",authenticated:true,headers:{Prefer:"return=representation"},body:JSON.stringify({user_id:currentUser.id,mode,tag_id:tagId,bracket_size:8})});
    cupState={runId:rows?.[0]?.id,round:1,roundSongs:entrants,winners:[],matchIndex:0};
    if(status) status.textContent=""; renderCup();
  } catch(error){if(status) status.textContent=error.message;}
}

function currentCupPair(){return cupState?.roundSongs?.slice(cupState.matchIndex*2,cupState.matchIndex*2+2)||[];}

function renderCup() {
  const arena=document.querySelector("#cupArena"); if(!arena) return;
  if(!cupState){arena.innerHTML="";return;}
  if(cupState.champion){
    arena.innerHTML=`<div class="cup-champion"><p class="eyebrow dark">${experienceText("champion")}</p>${songArtwork(cupState.champion,"cup-champion-artwork")}<h3>${escapeHtml(songTitle(cupState.champion))}</h3><p class="meta">${escapeHtml(songArtist(cupState.champion))}</p><button class="action primary" type="button" onclick="window.resetCup()">${experienceText("again")}</button></div>`;return;
  }
  const pair=currentCupPair(); if(pair.length<2)return;
  const roundName=experienceText("round"+cupState.round);
  const total=cupState.roundSongs.length/2;
  arena.innerHTML=`<p class="cup-progress">${roundName} · ${cupState.matchIndex+1}/${total}</p><div class="cup-match">
    ${pair.map(song=>`<article class="cup-song">${songArtwork(song,"cup-artwork")}<div><h3>${escapeHtml(songTitle(song))}</h3><p class="meta">${escapeHtml(songArtist(song))}</p><div class="actions"><button class="action" type="button" onclick="window.openRating(${song.id})">${experienceText("listen")}</button><button class="action primary" type="button" onclick="window.pickCupWinner(${song.id})">${experienceText("choose")}</button></div></div></article>`).join('<div class="cup-vs">VS</div>')}
  </div>`;
}

async function pickCupWinner(songId) {
  if(!cupState)return;
  const pair=currentCupPair(); const winner=pair.find(s=>Number(s.id)===Number(songId)); if(!winner)return;
  const matchNumber=cupState.matchIndex+1;
  try {
    await rest("tournament_votes",{method:"POST",authenticated:true,body:JSON.stringify({run_id:cupState.runId,user_id:currentUser.id,round_number:cupState.round,match_number:matchNumber,song_a_id:pair[0].id,song_b_id:pair[1].id,winner_song_id:winner.id})});
    cupState.winners.push(winner); cupState.matchIndex++;
    if(cupState.matchIndex>=cupState.roundSongs.length/2){
      if(cupState.winners.length===1){
        cupState.champion=winner;
        await rest("tournament_runs?id=eq."+encodeURIComponent(cupState.runId),{method:"PATCH",authenticated:true,headers:{Prefer:"return=minimal"},body:JSON.stringify({champion_song_id:winner.id,status:"completed",completed_at:new Date().toISOString()})});
        const status=document.querySelector("#cupStatus"); if(status)status.textContent=experienceText("saved");
      } else {cupState.round++;cupState.roundSongs=cupState.winners;cupState.winners=[];cupState.matchIndex=0;}
    }
    renderCup();
  } catch(error){const status=document.querySelector("#cupStatus");if(status)status.textContent=error.message;}
}

function resetCup(){cupState=null;const s=document.querySelector("#cupStatus");if(s)s.textContent="";renderCup();}

async function submitFeedback(event) {
  event.preventDefault();
  const button=document.querySelector("#feedbackSend"); const status=document.querySelector("#feedbackStatus");
  const message=document.querySelector("#feedbackMessage")?.value.trim();
  if(!message || message.length<10)return;
  button.disabled=true; status.textContent="";
  try {
    await rest("feedback_box",{method:"POST",authenticated:true,body:JSON.stringify({user_id:currentUser.id,category:document.querySelector("#feedbackCategory").value,message,locale:interfaceLanguage,page_context:currentView})});
    event.target.reset(); status.textContent=experienceText("sent");
  } catch(error){status.textContent=experienceText("sendError");}
  finally{button.disabled=false;}
}

const originalSetInterfaceLanguage=setInterfaceLanguage;
setInterfaceLanguage=function(language,persist=true){originalSetInterfaceLanguage(language,persist);experienceLocale();populateCupTags();};
const originalRenderView=renderView;
renderView=function(view,options={}){originalRenderView(view,options);document.querySelectorAll("[data-experience-route]").forEach(el=>{const active=el.dataset.experienceRoute===view;el.classList.toggle("is-active",active);if(active)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current");});if(view==="cup")renderCup();};
window.pickCupWinner=pickCupWinner; window.resetCup=resetCup;
document.addEventListener("DOMContentLoaded",installExperienceShell);
