(() => {
  const translations = {
    ja: {
      eyebrow: "今週のJ-POP", title: "毎週、新しい名曲に出会おう。", copy: "毎週月曜日にあなた向けの選曲を更新。聴いて、投票して、保存して、発見を共有できます。", open: "今週の名曲を開く",
      weekly: "週間 Hidden Gems", weeklyCopy: "毎週月曜日に新しい選曲", replay: "My JHG Replay", replayCopy: "発見履歴を共有できるまとめに", blend: "JHG Blend", blendCopy: "音楽の好みを比べて一緒に発見", listen: "続きを聴く", listenCopy: "YouTube・Spotify・Apple Musicで再生",
      ritual: "毎週月曜更新", mix: "週間 Hidden Gems", share: "この選曲を共有", ranking: "ランキングを見る", refresh: "次回更新", vote: "推薦する", no: "推薦しない", rate: "聴いて評価", empty: "曲を読み込めませんでした。"
    },
    en: { eyebrow:"YOUR WEEK IN J-POP",title:"A fresh reason to return.",copy:"A personal set refreshes every Monday. Listen, vote, save, and share what you discover.",open:"Open this week's gems",weekly:"Weekly Hidden Gems",weeklyCopy:"A new personal selection every Monday",replay:"My JHG Replay",replayCopy:"Turn discoveries into a shareable recap",blend:"JHG Blend",blendCopy:"Compare taste and discover together",listen:"Keep listening",listenCopy:"Continue on YouTube, Spotify, or Apple Music",ritual:"MONDAY DISCOVERY RITUAL",mix:"Weekly Hidden Gems",share:"Share this mix",ranking:"View full ranking",refresh:"Refreshes",vote:"Recommend",no:"Not for me",rate:"Listen & Rate",empty:"No songs are available yet." },
    ko: { eyebrow:"이번 주 J-POP",title:"매주 새로운 명곡을 만나보세요.",copy:"매주 월요일 맞춤 선곡이 새로워집니다. 듣고, 평가하고, 저장하고, 발견을 공유하세요.",open:"이번 주 음악 열기",weekly:"주간 Hidden Gems",weeklyCopy:"매주 월요일 새로운 맞춤 선곡",replay:"나의 JHG Replay",replayCopy:"발견 기록을 공유 가능한 요약으로",blend:"JHG Blend",blendCopy:"취향을 비교하며 함께 발견",listen:"계속 듣기",listenCopy:"YouTube, Spotify, Apple Music에서 듣기",ritual:"매주 월요일 업데이트",mix:"주간 Hidden Gems",share:"믹스 공유",ranking:"전체 랭킹",refresh:"다음 업데이트",vote:"추천",no:"추천 안 함",rate:"듣고 평가",empty:"아직 곡이 없습니다." },
    zh: { eyebrow:"本周 J-POP",title:"每周发现新的好歌。",copy:"每周一更新个性化歌单。试听、投票、收藏并分享你的发现。",open:"打开本周歌单",weekly:"每周 Hidden Gems",weeklyCopy:"每周一更新个性化选择",replay:"我的 JHG Replay",replayCopy:"把发现记录变成可分享总结",blend:"JHG Blend",blendCopy:"比较品味，一起发现",listen:"继续收听",listenCopy:"在 YouTube、Spotify 或 Apple Music 收听",ritual:"每周一更新",mix:"每周 Hidden Gems",share:"分享歌单",ranking:"查看完整排行",refresh:"下次更新",vote:"推荐",no:"不推荐",rate:"试听并评分",empty:"暂无歌曲。" },
    ru: { eyebrow:"J-POP НА ЭТОЙ НЕДЕЛЕ",title:"Новая музыка каждую неделю.",copy:"Персональная подборка обновляется по понедельникам. Слушайте, голосуйте, сохраняйте и делитесь.",open:"Открыть подборку",weekly:"Еженедельные Hidden Gems",weeklyCopy:"Новая подборка каждый понедельник",replay:"Мой JHG Replay",replayCopy:"Поделитесь итогами своих открытий",blend:"JHG Blend",blendCopy:"Сравните вкусы и ищите вместе",listen:"Продолжить слушать",listenCopy:"Слушать в YouTube, Spotify или Apple Music",ritual:"ОБНОВЛЕНИЕ ПО ПОНЕДЕЛЬНИКАМ",mix:"Еженедельные Hidden Gems",share:"Поделиться",ranking:"Весь рейтинг",refresh:"Обновление",vote:"Рекомендовать",no:"Не моё",rate:"Слушать и оценить",empty:"Песен пока нет." },
    es: { eyebrow:"TU SEMANA EN J-POP",title:"Una nueva razón para volver.",copy:"Tu selección personal se renueva cada lunes. Escucha, vota, guarda y comparte.",open:"Abrir las joyas de esta semana",weekly:"Hidden Gems semanales",weeklyCopy:"Una selección nueva cada lunes",replay:"Mi JHG Replay",replayCopy:"Convierte tus descubrimientos en un resumen",blend:"JHG Blend",blendCopy:"Compara gustos y descubre en compañía",listen:"Seguir escuchando",listenCopy:"Continúa en YouTube, Spotify o Apple Music",ritual:"RITUAL DE LOS LUNES",mix:"Hidden Gems semanales",share:"Compartir selección",ranking:"Ver ranking",refresh:"Se renueva",vote:"Recomendar",no:"No es para mí",rate:"Escuchar y valorar",empty:"Aún no hay canciones." },
    fr: { eyebrow:"VOTRE SEMAINE J-POP",title:"Une nouvelle raison de revenir.",copy:"Une sélection personnelle arrive chaque lundi. Écoutez, votez, sauvegardez et partagez.",open:"Ouvrir les pépites de la semaine",weekly:"Hidden Gems de la semaine",weeklyCopy:"Une nouvelle sélection chaque lundi",replay:"Mon JHG Replay",replayCopy:"Transformez vos découvertes en bilan partageable",blend:"JHG Blend",blendCopy:"Comparez vos goûts et découvrez ensemble",listen:"Continuer l'écoute",listenCopy:"Écouter sur YouTube, Spotify ou Apple Music",ritual:"RENDEZ-VOUS DU LUNDI",mix:"Hidden Gems de la semaine",share:"Partager la sélection",ranking:"Voir le classement",refresh:"Actualisation",vote:"Recommander",no:"Pas pour moi",rate:"Écouter et noter",empty:"Aucun titre disponible." }
  };

  function language() { const value = document.documentElement.dataset.language || document.documentElement.lang || "en"; return translations[value] ? value : "en"; }
  function copy() { return translations[language()]; }
  function weekKey(date = new Date()) { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - day + 1); return d.toISOString().slice(0,10); }
  function hash(value) { let h = 2166136261; for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h,16777619); } return h >>> 0; }
  function seededSelection(list, limit = 12) {
    const user = typeof currentUser !== "undefined" && currentUser?.id ? currentUser.id : "guest";
    const seed = hash(`${weekKey()}:${user}`);
    const pool = [...list].sort((a,b) => hash(`${seed}:${a.id}`)-hash(`${seed}:${b.id}`));
    const selected = [], artists = new Set(), buckets = new Set();
    const bucket = song => `${song.year ? Math.floor(Number(song.year)/10)*10 : "unknown"}:${song.tags?.[0] || "untagged"}`;
    for (const song of pool) {
      const artist = String(songArtist(song)).toLocaleLowerCase();
      const key = bucket(song);
      if (artists.has(artist) || buckets.has(key)) continue;
      selected.push(song); artists.add(artist); buckets.add(key);
      if (selected.length === limit) return selected;
    }
    for (const song of pool) {
      if (selected.some(item => item.id === song.id)) continue;
      const artist = String(songArtist(song)).toLocaleLowerCase();
      if (artists.has(artist) && pool.length > limit * 2) continue;
      selected.push(song); artists.add(artist);
      if (selected.length === limit) break;
    }
    return selected;
  }
  function nextMonday() { const d = new Date(); const days = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate()+days); d.setHours(0,0,0,0); return new Intl.DateTimeFormat(language(),{month:"short",day:"numeric"}).format(d); }
  function set(id, value) { const node = document.getElementById(id); if (node) node.textContent = value; }
  function applyCopy() { const t=copy(); [["growthLoopEyebrow",t.eyebrow],["growthLoopTitle",t.title],["growthLoopCopy",t.copy],["openWeeklyMix",t.open],["weeklyShortcutTitle",t.weekly],["weeklyShortcutCopy",t.weeklyCopy],["replayShortcutTitle",t.replay],["replayShortcutCopy",t.replayCopy],["blendShortcutTitle",t.blend],["blendShortcutCopy",t.blendCopy],["listenShortcutTitle",t.listen],["listenShortcutCopy",t.listenCopy],["weeklyMixEyebrow",t.ritual],["weeklyMixTitle",t.mix],["shareWeeklyMix",t.share]].forEach(([id,value])=>set(id,value)); const ranking=document.querySelector('#weeklyMixSection [data-route="ranking"]'); if(ranking) ranking.textContent=t.ranking; set("weeklyMixMeta",`${t.refresh}: ${nextMonday()}`); }
  function renderMix() {
    const grid=document.getElementById("weeklyMixGrid"); if(!grid) return;
    const list=typeof songs!=="undefined" ? seededSelection(songs.filter(song=>song && song.id)) : [];
    if(!list.length){ grid.innerHTML=`<p class="muted">${copy().empty}</p>`; return; }
    const t=copy();
    grid.innerHTML=list.map((song,index)=>{
      const controls=`<button class="action primary" data-weekly-rate="${song.id}">${t.rate}</button>`;
      return `<article class="weekly-gem-card"><div class="ranking-artwork-wrap">${songArtwork(song,"ranking-artwork")}<span class="rank">${String(index+1).padStart(2,"0")}</span></div><div class="weekly-gem-card-copy"><p class="eyebrow dark">${t.weekly}</p><h3>${escapeHtml(songTitle(song))}</h3><p class="meta">${escapeHtml(songArtist(song))}${song.year?` · ${escapeHtml(song.year)}`:""}</p><div class="weekly-gem-actions">${controls}</div></div></article>`;
    }).join("");
  }
  function openRoute(route){ if(typeof navigateTo==="function" && VALID_VIEWS.has(route)) navigateTo(route); else { const url=new URL(location.href); url.searchParams.set("view",route); location.href=url; } }
  async function shareMix(){ const t=copy(); const url=new URL(location.href); url.searchParams.set("view","weekly-mix"); const payload={title:`JHG — ${t.mix}`,text:t.copy,url:url.toString()}; try{ if(navigator.share) await navigator.share(payload); else { await navigator.clipboard.writeText(`${payload.text} ${payload.url}`); if(typeof showStatus==="function") showStatus(language()==="ja"?"共有リンクをコピーしました。":"Share link copied."); } }catch(error){ if(error?.name!=="AbortError" && typeof showStatus==="function") showStatus(error.message,"error"); } }
  document.addEventListener("click",event=>{ const routeButton=event.target.closest("[data-growth-route]"); if(routeButton){ openRoute(routeButton.dataset.growthRoute); return; } if(event.target.closest("#openWeeklyMix")){ openRoute("weekly-mix"); return; } const rate=event.target.closest("[data-weekly-rate]"); if(rate) window.openRating?.(Number(rate.dataset.weeklyRate)); });
  document.getElementById("shareWeeklyMix")?.addEventListener("click",shareMix);
  document.getElementById("languageSelect")?.addEventListener("change",()=>setTimeout(()=>{applyCopy();renderMix();},0));
  const timer=setInterval(()=>{ if(typeof songs!=="undefined" && songs.length){ clearInterval(timer); applyCopy(); renderMix(); } },250);
  setTimeout(()=>{clearInterval(timer);applyCopy();renderMix();},8000);
})();
