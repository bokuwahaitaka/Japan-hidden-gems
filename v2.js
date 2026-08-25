(() => {
  "use strict";

  const VIEW = "swipe";
  const PROFILE_VIEW = "profile-v2";
  const DISCOVERY_SECONDS = 8;
  const SEEN_KEY = "jhg:v2:swipe-seen";
  const SOUND_KEY = "jhg:v2:sound-on";
  const state = {
    catalog: [], queue: [], likes: new Set(), knew: new Set(), activeId: null,
    players: new Map(), appleAudio: new Map(), playback: new Map(), commentsSongId: null, replyTo: null,
    profile: null, profileTab: "discovered", soundOn: sessionStorage.getItem(SOUND_KEY) === "true"
  };

  const copy = {
    en: { discover:"Discover", like:"Like", comments:"Comments", save:"Save", knew:"Knew it", preview:"Play preview", stop:"Stop preview", soundOn:"Sound on", soundOff:"Sound off", noSongs:"No preview-ready songs yet.", appleCredit:"Preview provided courtesy of Apple Music", appleListen:"Listen on Apple Music", commentTitle:"Comments", reply:"Reply", post:"Post", placeholder:"Add a comment…", discovered:"Gems Discovered", liked:"Liked songs", saved:"Saved songs", profileComments:"Comments", genres:"Favorite genres", eras:"Favorite eras" },
    ja: { discover:"見つける", like:"好き", comments:"コメント", save:"保存", knew:"知ってた", preview:"プレビュー再生", stop:"停止", noSongs:"プレビュー対応曲がまだありません。", appleCredit:"Apple Music提供のプレビュー", appleListen:"Apple Musicで聴く", commentTitle:"コメント", reply:"返信", post:"投稿", placeholder:"コメントを追加…", discovered:"発見したGems", liked:"Likeした曲", saved:"保存した曲", profileComments:"コメント", genres:"好きなジャンル", eras:"好きな年代" },
    ko: { discover:"발견", like:"좋아요", comments:"댓글", save:"저장", knew:"알고 있었어요", preview:"미리듣기", stop:"정지", noSongs:"미리듣기 가능한 곡이 없습니다.", appleCredit:"Apple Music 제공 미리듣기", appleListen:"Apple Music에서 듣기", commentTitle:"댓글", reply:"답글", post:"게시", placeholder:"댓글 추가…", discovered:"발견한 Gems", liked:"좋아요한 곡", saved:"저장한 곡", profileComments:"댓글", genres:"좋아하는 장르", eras:"좋아하는 시대" },
    zh: { discover:"发现", like:"喜欢", comments:"评论", save:"保存", knew:"听过", preview:"播放预览", stop:"停止", noSongs:"暂无可预览歌曲。", appleCredit:"Apple Music 提供的试听", appleListen:"在 Apple Music 中收听", commentTitle:"评论", reply:"回复", post:"发布", placeholder:"添加评论…", discovered:"已发现 Gems", liked:"喜欢的歌曲", saved:"已保存歌曲", profileComments:"评论", genres:"喜欢的流派", eras:"喜欢的年代" },
    ru: { discover:"Лента", like:"Нравится", comments:"Комментарии", save:"Сохранить", knew:"Уже знал", preview:"Превью", stop:"Стоп", noSongs:"Пока нет песен с превью.", appleCredit:"Фрагмент предоставлен Apple Music", appleListen:"Слушать в Apple Music", commentTitle:"Комментарии", reply:"Ответить", post:"Отправить", placeholder:"Добавить комментарий…", discovered:"Открыто Gems", liked:"Понравившиеся", saved:"Сохранённые", profileComments:"Комментарии", genres:"Любимые жанры", eras:"Любимые эпохи" },
    es: { discover:"Descubrir", like:"Me gusta", comments:"Comentarios", save:"Guardar", knew:"Ya la conocía", preview:"Reproducir", stop:"Detener", noSongs:"Aún no hay canciones con vista previa.", appleCredit:"Vista previa proporcionada por Apple Music", appleListen:"Escuchar en Apple Music", commentTitle:"Comentarios", reply:"Responder", post:"Publicar", placeholder:"Añade un comentario…", discovered:"Gems descubiertas", liked:"Canciones favoritas", saved:"Canciones guardadas", profileComments:"Comentarios", genres:"Géneros favoritos", eras:"Épocas favoritas" },
    fr: { discover:"Découvrir", like:"J’aime", comments:"Commentaires", save:"Enregistrer", knew:"Je connaissais", preview:"Écouter", stop:"Arrêter", noSongs:"Aucun aperçu disponible.", appleCredit:"Extrait fourni par Apple Music", appleListen:"Écouter sur Apple Music", commentTitle:"Commentaires", reply:"Répondre", post:"Publier", placeholder:"Ajouter un commentaire…", discovered:"Gems découvertes", liked:"Titres aimés", saved:"Titres enregistrés", profileComments:"Commentaires", genres:"Genres favoris", eras:"Époques favorites" }
  };
  const t = (key) => (copy[window.interfaceLanguage || interfaceLanguage] || copy.en)[key] || copy.en[key] || key;
  const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
  const uid = () => currentUser?.id;
  const byId = (id) => state.catalog.find(song => Number(song.id) === Number(id));
  const seen = () => { try { return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]").map(Number)); } catch { return new Set(); } };
  const persistSeen = (set) => sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-2000)));
  const shuffle = (items) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const videoId = (song) => {
    if (song?.youtube_video_id) return String(song.youtube_video_id);
    try { const u=new URL(song?.youtube_url); return u.hostname.includes("youtu.be") ? u.pathname.split("/").filter(Boolean)[0] : u.searchParams.get("v") || u.pathname.match(/\/(?:shorts|embed)\/([^/?]+)/)?.[1] || null; } catch { return null; }
  };
  const usesApple = (song) => song?.apple_preview_status === "matched" && Boolean(song?.apple_preview_url && song?.apple_music_url);
  const hasPreview = (song) => song?.preview_enabled !== false && (usesApple(song) || Boolean(videoId(song)));
  const artwork = (song) => song.apple_artwork_url || song.youtube_thumbnail_url || (videoId(song) ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId(song))}/hqdefault.jpg` : "");
  const avatarStyle = (seed="jhg") => { let h=0; for(const c of seed) h=(h*31+c.charCodeAt(0))%360; return `background:linear-gradient(135deg,hsl(${h} 70% 45%),hsl(${(h+70)%360} 70% 36%))`; };

  // Recommendation sources can later replace this object without changing the feed UI.
  const randomSource = {
    async nextBatch({ limit = 30 } = {}) {
      const used = seen();
      let candidates = state.catalog.filter(s => hasPreview(s) && !used.has(Number(s.id)));
      if (!candidates.length) { used.clear(); candidates = state.catalog.filter(hasPreview); }
      const batch = shuffle(candidates).slice(0, limit);
      batch.forEach(s => used.add(Number(s.id))); persistSeen(used);
      return batch;
    }
  };

  async function loadCatalog() {
    const rows = await rest("songs?select=id,title,artist,title_en,artist_en,year,youtube_url,youtube_video_id,youtube_thumbnail_url,artist_image_url,preview_provider,preview_start_seconds,preview_duration_seconds,preview_enabled,apple_track_id,apple_music_url,apple_preview_url,apple_artwork_url,apple_preview_status,is_hidden&is_hidden=eq.false&order=id", { authenticated:true });
    const aggregate = new Map((songs || []).map(s => [Number(s.id), s]));
    state.catalog = (rows || []).map(row => ({ ...aggregate.get(Number(row.id)), ...row }));
    state.queue = await randomSource.nextBatch({ limit: Math.min(50, state.catalog.length) });
  }

  async function loadOwnStates() {
    if (!uid()) return;
    const [likes, awareness] = await Promise.all([
      rest(`song_likes?select=song_id&user_id=eq.${uid()}`, { authenticated:true }).catch(()=>[]),
      rest(`song_awareness?select=song_id,knew_before&user_id=eq.${uid()}&knew_before=eq.true`, { authenticated:true }).catch(()=>[])
    ]);
    state.likes = new Set(likes.map(x=>Number(x.song_id)));
    state.knew = new Set(awareness.map(x=>Number(x.song_id)));
  }

  function actionButton(type, id, on=false) {
    const icons={like:"♥",comments:"💬",save:"💎",knew:"✓"};
    return `<button class="v2-action ${on?"is-on":""}" type="button" data-v2-action="${type}" data-song-id="${id}" aria-pressed="${on}"><span class="v2-icon">${icons[type]}</span><span>${esc(t(type))}</span></button>`;
  }

  function card(song) {
    const id=Number(song.id), img=artwork(song), title=songTitle(song), artist=songArtist(song);
    const appleCredit=usesApple(song)?`<span class="v2-apple-credit">${esc(t("appleCredit"))} · <a href="${esc(song.apple_music_url)}" target="_blank" rel="noopener noreferrer">${esc(t("appleListen"))} ↗</a></span>`:"";
    return `<article class="v2-swipe-card" data-v2-card data-song-id="${id}">
      ${img?`<img class="v2-swipe-bg" src="${esc(img)}" alt=""><img class="v2-swipe-cover" src="${esc(img)}" alt="${esc(title)}">`:`<div class="v2-swipe-cover artwork-fallback">JHG</div>`}
      <div class="v2-swipe-shade"></div><div class="v2-player-host" id="v2-player-${id}"></div>
      <div class="v2-swipe-copy"><h1>${esc(title)}</h1><p>${esc(artist)}${song.year?` · ${esc(song.year)}`:""}</p><small>${esc((song.tags||[]).slice(0,3).map(x=>x.label_en||x.label_ja).filter(Boolean).join(" · "))}</small><br><button class="v2-preview" type="button" data-v2-sound="${id}" aria-pressed="${state.soundOn}">${state.soundOn?"🔊":"🔇"} ${esc(t(state.soundOn?"soundOn":"soundOff"))}</button>${appleCredit}</div>
      <aside class="v2-swipe-actions">${actionButton("like",id,state.likes.has(id))}${actionButton("comments",id,false)}${actionButton("save",id,favoriteSongIds?.has(id))}${actionButton("knew",id,state.knew.has(id))}</aside>
    </article>`;
  }

  function renderFeed() {
    const root=document.querySelector("#v2SwipeFeed"); if(!root)return;
    root.innerHTML=state.queue.length?state.queue.map(card).join(""):`<div class="v2-empty"><p>${esc(t("noSongs"))}</p></div>`;
    observeCards();
  }

  let cardObserver;
  function observeCards() {
    cardObserver?.disconnect();
    cardObserver=new IntersectionObserver(entries=>{
      const active=entries.filter(x=>x.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];
      if(active?.intersectionRatio>=.6) activateSong(Number(active.target.dataset.songId));
    },{root:document.querySelector("#v2SwipeFeed"),threshold:[.6,.85]});
    document.querySelectorAll("[data-v2-card]").forEach(x=>cardObserver.observe(x));
  }

  function activateSong(id) {
    if(state.activeId!==id){stopAllPlayers(id);state.activeId=id;}
    prepareAdjacent(id);
    prunePlayers(id);
    autoplaySong(id).catch(()=>{});
  }

  function cardFor(id) {
    return document.querySelector(`[data-v2-card][data-song-id="${id}"]`);
  }

  function advanceToNext(id) {
    if(Number(state.activeId)!==Number(id)||document.hidden||currentView!==VIEW)return;
    const current=cardFor(id), next=current?.nextElementSibling;
    if(!next?.matches?.("[data-v2-card]"))return;
    stopAllPlayers();
    state.activeId=null;
    next.scrollIntoView({behavior:"smooth",block:"start"});
  }

  function prepareAdjacent(id) {
    const current=cardFor(id), next=current?.nextElementSibling;
    if(!next?.matches?.("[data-v2-card]"))return;
    const song=byId(Number(next.dataset.songId));
    if(usesApple(song)&&!state.appleAudio.has(Number(song.id))){
      const audio=new Audio();audio.preload="metadata";audio.src=song.apple_preview_url;
      state.appleAudio.set(Number(song.id),audio);
    }
    const img=next.querySelector(".v2-swipe-cover");
    if(img)img.loading="eager";
  }

  function prunePlayers(activeId) {
    const cards=[...document.querySelectorAll("[data-v2-card]")], activeIndex=cards.findIndex(card=>Number(card.dataset.songId)===Number(activeId));
    state.players.forEach((player,id)=>{
      const index=cards.findIndex(card=>Number(card.dataset.songId)===Number(id));
      if(index>=0&&Math.abs(index-activeIndex)>1){try{player.destroy?.();}catch{}state.players.delete(id);const host=document.querySelector(`#v2-player-${id}`);if(host)host.textContent="";}
    });
    state.appleAudio.forEach((audio,id)=>{
      const index=cards.findIndex(card=>Number(card.dataset.songId)===Number(id));
      if(index>=0&&Math.abs(index-activeIndex)>1){try{audio.pause();audio.removeAttribute("src");audio.load();}catch{}state.appleAudio.delete(id);}
    });
  }

  let ytReady;
  function youtubeReady() {
    if(window.YT?.Player)return Promise.resolve(window.YT);
    if(ytReady)return ytReady;
    ytReady=new Promise(resolve=>{
      const previous=window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady=()=>{ previous?.(); resolve(window.YT); };
      if(!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')){const s=document.createElement("script");s.src="https://www.youtube.com/iframe_api";document.head.appendChild(s);}
    }); return ytReady;
  }

  async function autoplaySong(id) {
    const song=byId(id); if(!song||!hasPreview(song))return;
    if(document.hidden||currentView!==VIEW)return;
    if(videoId(song)&&!usesApple(song)){
      const existing=state.players.get(id);
      if(existing){
        const start=Number(song.preview_start_seconds)||0,duration=Math.max(15,Math.min(30,Number(song.preview_duration_seconds)||20));
        const position=existing.getCurrentTime?.()||0;
        if(position<start||position>=start+duration-.5)existing.seekTo?.(start,true);
        state.soundOn?existing.unMute?.():existing.mute?.();
        existing.playVideo?.();
        return;
      }
      const YT=await youtubeReady();
      if(state.activeId!==id||document.hidden||currentView!==VIEW)return;
      const player=new YT.Player(`v2-player-${id}`,{height:"100%",width:"100%",videoId:videoId(song),playerVars:{autoplay:1,mute:1,playsinline:1,controls:0,disablekb:1,rel:0,start:Number(song.preview_start_seconds)||0,origin:location.origin},events:{
        onReady:e=>{state.players.set(id,e.target);if(state.activeId!==id||currentView!==VIEW){e.target.pauseVideo?.();return;}e.target.seekTo(Number(song.preview_start_seconds)||0,true);e.target.mute?.();e.target.playVideo();if(state.soundOn)e.target.unMute?.();},
        onStateChange:e=>handlePlayerState(id,e.data)
      }});
      state.players.set(id,player);
      return;
    }
    if(usesApple(song)){
      let audio=state.appleAudio.get(id);
      if(!audio){
        audio=new Audio(song.apple_preview_url);audio.preload="none";state.appleAudio.set(id,audio);
        audio.addEventListener("play",()=>handlePlaybackState(id,true));
        audio.addEventListener("pause",()=>handlePlaybackState(id,false));
        audio.addEventListener("ended",()=>{handlePlaybackState(id,false);advanceToNext(id);});
        audio.addEventListener("error",()=>{
          handlePlaybackState(id,false);state.appleAudio.delete(id);song.apple_preview_status="failed";
          showStatus("Apple preview is temporarily unavailable.","error");
        });
      }
      audio.muted=!state.soundOn;
      if(audio.ended)audio.currentTime=0;
      if(audio.paused)await audio.play().catch(()=>{});
    }
  }

  function toggleSound() {
    state.soundOn=!state.soundOn;
    sessionStorage.setItem(SOUND_KEY,String(state.soundOn));
    state.players.forEach(player=>state.soundOn?player.unMute?.():player.mute?.());
    state.appleAudio.forEach(audio=>{audio.muted=!state.soundOn;});
    document.querySelectorAll("[data-v2-sound]").forEach(button=>{
      button.setAttribute("aria-pressed",String(state.soundOn));
      button.textContent=`${state.soundOn?"🔊":"🔇"} ${t(state.soundOn?"soundOn":"soundOff")}`;
    });
    if(state.activeId)autoplaySong(state.activeId).catch(()=>{});
  }

  function handlePlayerState(id, playerState) {
    document.querySelector(`[data-v2-card][data-song-id="${id}"]`)?.classList.toggle("is-playing",playerState===1);
    handlePlaybackState(id,playerState===1);
    if(playerState===0)advanceToNext(id);
  }

  function handlePlaybackState(id, playing) {
    const info=state.playback.get(id)||{seconds:0,token:crypto.randomUUID(),qualified:false,timer:null,lastTick:0};
    state.playback.set(id,info);
    if(playing){info.lastTick=performance.now();clearInterval(info.timer);info.timer=setInterval(()=>playbackTick(id),500);}
    else {clearInterval(info.timer);info.timer=null;persistPreview(id).catch(()=>{});}
  }

  function playbackTick(id) {
    const info=state.playback.get(id), song=byId(id); if(!info||!song)return;
    const now=performance.now(); info.seconds+=Math.min(1,(now-info.lastTick)/1000); info.lastTick=now;
    if(!info.qualified&&info.seconds>=DISCOVERY_SECONDS){info.qualified=true;persistDiscovery(id).catch(err=>showStatus(err.message,"error"));}
    if(!usesApple(song)){
      const player=state.players.get(id);if(!player)return;
      const start=Number(song.preview_start_seconds)||0,duration=Math.max(15,Math.min(30,Number(song.preview_duration_seconds)||20));
      if((player.getCurrentTime?.()||start)-start>=duration)advanceToNext(id);
    }
  }

  function stopAllPlayers(exceptId=null) {
    state.players.forEach((player,id)=>{if(id!==exceptId){try{player.pauseVideo?.();}catch{} persistPreview(id).catch(()=>{});}});
    state.appleAudio.forEach((audio,id)=>{if(id!==exceptId){try{audio.pause();audio.currentTime=0;}catch{} persistPreview(id).catch(()=>{});}});
    document.querySelectorAll("[data-v2-card]").forEach(card=>{if(Number(card.dataset.songId)!==Number(exceptId))card.classList.remove("is-playing");});
  }

  async function persistPreview(id) {
    const info=state.playback.get(id); if(!info||info.seconds<.5||info.savedSeconds===Math.floor(info.seconds))return;
    const seconds=Math.min(1800,Number(info.seconds.toFixed(2))); info.savedSeconds=Math.floor(info.seconds);
    await rest("song_preview_events?on_conflict=user_id,session_token",{method:"POST",authenticated:true,headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:uid(),song_id:id,session_token:info.token,source:"swipe",seconds_listened:seconds,qualified:seconds>=DISCOVERY_SECONDS,knew_before:state.knew.has(id),last_updated_at:new Date().toISOString()})});
  }

  async function persistDiscovery(id) {
    const info=state.playback.get(id); if(!info)return;
    await Promise.all([
      persistPreview(id),
      rest("song_discoveries?on_conflict=user_id,song_id",{method:"POST",authenticated:true,headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:uid(),song_id:id,preview_seconds:Number(info.seconds.toFixed(2)),source:"swipe",last_listened_at:new Date().toISOString()})}),
      state.knew.has(id)?Promise.resolve():rest("song_awareness?on_conflict=user_id,song_id",{method:"POST",authenticated:true,headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:uid(),song_id:id,knew_before:false})})
    ]);
  }

  async function toggleOwn(table,id,setName,column="song_id") {
    const set=state[setName],on=set.has(id);
    if(on)await rest(`${table}?user_id=eq.${uid()}&${column}=eq.${id}`,{method:"DELETE",authenticated:true,headers:{Prefer:"return=minimal"}});
    else await rest(`${table}?on_conflict=user_id,${column}`,{method:"POST",authenticated:true,headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:uid(),[column]:id})});
    on?set.delete(id):set.add(id); return !on;
  }

  async function toggleAction(type,id,button) {
    button.disabled=true;
    try {
      let on=false;
      if(type==="like")on=await toggleOwn("song_likes",id,"likes");
      if(type==="save"){await window.toggleFavorite(id);on=favoriteSongIds.has(id);}
      if(type==="knew"){
        const active=state.knew.has(id);
        if(active)await rest(`song_awareness?user_id=eq.${uid()}&song_id=eq.${id}`,{method:"DELETE",authenticated:true,headers:{Prefer:"return=minimal"}});
        else await rest("song_awareness?on_conflict=user_id,song_id",{method:"POST",authenticated:true,headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:uid(),song_id:id,knew_before:true,updated_at:new Date().toISOString()})});
        active?state.knew.delete(id):state.knew.add(id);on=!active;
      }
      button.classList.toggle("is-on",on);button.setAttribute("aria-pressed",String(on));
    } finally {button.disabled=false;}
  }

  function ensureSheet() {
    if(document.querySelector("#v2CommentSheet"))return;
    document.body.insertAdjacentHTML("beforeend",`<aside id="v2CommentSheet" class="v2-comment-sheet" aria-hidden="true"><header class="v2-sheet-head"><h2>${esc(t("commentTitle"))}</h2><button class="v2-sheet-close" type="button" data-v2-close>×</button></header><div id="v2CommentList" class="v2-comment-list"></div><form id="v2CommentForm" class="v2-comment-form"><input name="body" maxlength="1000" required placeholder="${esc(t("placeholder"))}"><button type="submit">${esc(t("post"))}</button></form></aside>`);
  }

  async function ensurePublicProfile() {
    const rows=await rest(`public_profiles?select=*&user_id=eq.${uid()}&limit=1`,{authenticated:true}); if(rows[0])return rows[0];
    const short=uid().replace(/-/g,"").slice(0,10),payload={user_id:uid(),handle:`listener_${short}`,display_name:`JHG Listener ${short.slice(0,4)}`,locale:interfaceLanguage||"en",avatar_seed:short};
    const made=await rest("public_profiles",{method:"POST",authenticated:true,headers:{Prefer:"return=representation"},body:JSON.stringify(payload)}); return made[0];
  }

  async function openComments(id) {
    ensureSheet();state.commentsSongId=id;state.replyTo=null;
    const sheet=document.querySelector("#v2CommentSheet");sheet.classList.add("is-open");sheet.setAttribute("aria-hidden","false");await renderComments();
  }

  async function renderComments() {
    const root=document.querySelector("#v2CommentList");root.innerHTML="<p>Loading…</p>";
    const comments=await rest(`v2_comments?select=id,user_id,parent_id,body,created_at&song_id=eq.${state.commentsSongId}&status=eq.published&order=created_at.asc`,{authenticated:true});
    const ids=[...new Set(comments.map(x=>x.user_id))], commentIds=comments.map(x=>x.id);
    const [profiles,reactions]=await Promise.all([
      ids.length?rest(`public_profiles?select=user_id,handle,display_name,avatar_seed&user_id=in.(${ids.join(",")})`,{authenticated:true}):[],
      commentIds.length?rest(`v2_comment_reactions?select=comment_id,user_id,reaction&comment_id=in.(${commentIds.join(",")})&reaction=eq.like`,{authenticated:true}):[]
    ]);
    const pm=new Map(profiles.map(x=>[x.user_id,x])),children=new Map();comments.forEach(c=>{const key=c.parent_id||"root";children.set(key,[...(children.get(key)||[]),c]);});
    const renderOne=(c,depth=0)=>{const p=pm.get(c.user_id)||{handle:"listener",display_name:"JHG Listener",avatar_seed:c.user_id};const likes=reactions.filter(x=>x.comment_id===c.id),mine=likes.some(x=>x.user_id===uid());return `<article class="v2-comment" style="margin-left:${Math.min(depth,2)*24}px"><button class="v2-avatar" style="${avatarStyle(p.avatar_seed)}" data-v2-profile="${esc(p.handle)}">${esc((p.display_name||"J")[0])}</button><div><div class="v2-comment-meta"><button data-v2-profile="${esc(p.handle)}">@${esc(p.handle)}</button><time>${esc(new Date(c.created_at).toLocaleString())}</time></div><p>${esc(c.body)}</p><div class="v2-comment-tools"><button class="${mine?"is-on":""}" data-v2-comment-like="${c.id}">♥ ${likes.length}</button><button data-v2-reply="${c.id}">${esc(t("reply"))}</button></div>${(children.get(c.id)||[]).map(x=>renderOne(x,depth+1)).join("")}</div></article>`;};
    root.innerHTML=(children.get("root")||[]).map(x=>renderOne(x)).join("")||"<p>No comments yet.</p>";
  }

  async function submitComment(form) {
    const body=form.elements.body.value.trim();if(!body)return;await ensurePublicProfile();
    await rest("v2_comments",{method:"POST",authenticated:true,headers:{Prefer:"return=minimal"},body:JSON.stringify({song_id:state.commentsSongId,user_id:uid(),parent_id:state.replyTo,body})});
    form.reset();state.replyTo=null;await renderComments();
  }

  async function toggleCommentLike(commentId,button) {
    const rows=await rest(`v2_comment_reactions?select=comment_id&comment_id=eq.${commentId}&user_id=eq.${uid()}&reaction=eq.like`,{authenticated:true});
    if(rows.length)await rest(`v2_comment_reactions?comment_id=eq.${commentId}&user_id=eq.${uid()}&reaction=eq.like`,{method:"DELETE",authenticated:true,headers:{Prefer:"return=minimal"}});
    else await rest("v2_comment_reactions",{method:"POST",authenticated:true,headers:{Prefer:"return=minimal"},body:JSON.stringify({comment_id:commentId,user_id:uid(),reaction:"like"})});
    await renderComments();
  }

  async function renderProfile(handle=null) {
    const root=document.querySelector("#v2Profile");if(!root)return;root.innerHTML="<p>Loading…</p>";
    if(!state.catalog.length)await loadCatalog();
    const filter=handle?`handle=eq.${encodeURIComponent(handle)}`:`user_id=eq.${uid()}`;
    let profiles=await rest(`public_profiles?select=*&${filter}&limit=1`,{authenticated:true});
    if(!profiles[0]&&!handle)profiles=[await ensurePublicProfile()];
    const profile=profiles[0];if(!profile){root.innerHTML="<p>Profile not found.</p>";return;}state.profile=profile;
    const own=profile.user_id===uid();
    const [discoveries,likes,saves,comments]=own?await Promise.all([
      rest(`song_discoveries?select=song_id,first_discovered_at&user_id=eq.${uid()}&order=first_discovered_at.desc`,{authenticated:true}),
      rest(`song_likes?select=song_id,created_at&user_id=eq.${uid()}&order=created_at.desc`,{authenticated:true}),
      rest(`favorite_songs?select=song_id,created_at&user_id=eq.${uid()}&order=created_at.desc`,{authenticated:true}),
      rest(`v2_comments?select=id,song_id,body,created_at&user_id=eq.${uid()}&status=eq.published&order=created_at.desc`,{authenticated:true})
    ]):[[],[],[],[]];
    state.profileData={discovered:discoveries,liked:likes,saved:saves,comments};
    root.innerHTML=`<header class="v2-profile-head"><span class="v2-avatar" style="${avatarStyle(profile.avatar_seed)}">${esc((profile.display_name||"J")[0])}</span><div><h1>${esc(profile.display_name)}</h1><p>@${esc(profile.handle)}</p><p>${esc(profile.bio||"")}</p></div></header><div class="v2-profile-stats"><div><strong>${discoveries.length}</strong>${esc(t("discovered"))}</div><div><strong>${likes.length}</strong>${esc(t("liked"))}</div><div><strong>${saves.length}</strong>${esc(t("saved"))}</div></div><p><b>${esc(t("genres"))}</b></p><div class="v2-profile-tags">${(profile.favorite_genres||[]).map(x=>`<span>${esc(x)}</span>`).join("")||"—"}</div><p><b>${esc(t("eras"))}</b></p><div class="v2-profile-tags">${(profile.favorite_eras||[]).map(x=>`<span>${esc(x)}</span>`).join("")||"—"}</div>${own?`<nav class="v2-profile-tabs"><button data-v2-profile-tab="discovered" class="is-on">${esc(t("discovered"))}</button><button data-v2-profile-tab="liked">${esc(t("liked"))}</button><button data-v2-profile-tab="saved">${esc(t("saved"))}</button><button data-v2-profile-tab="comments">${esc(t("profileComments"))}</button></nav><div id="v2ProfileGrid" class="v2-profile-grid"></div>`:""}`;
    if(own)renderProfileTab("discovered");
  }

  function renderProfileTab(tab) {
    state.profileTab=tab;document.querySelectorAll("[data-v2-profile-tab]").forEach(x=>x.classList.toggle("is-on",x.dataset.v2ProfileTab===tab));
    const root=document.querySelector("#v2ProfileGrid"),items=state.profileData?.[tab]||[];
    if(tab==="comments"){root.innerHTML=items.map(x=>`<button class="v2-profile-song" data-v2-song="${x.song_id}"><span><b>${esc(songTitle(byId(x.song_id)||{}))}</b><br>${esc(x.body)}<br><small>${new Date(x.created_at).toLocaleDateString()}</small></span></button>`).join("")||"<p>—</p>";return;}
    root.innerHTML=items.map(x=>{const s=byId(x.song_id);if(!s)return"";const img=artwork(s);return `<button class="v2-profile-song" data-v2-song="${s.id}">${img?`<img src="${esc(img)}" alt="">`:""}<span><b>${esc(songTitle(s))}</b><br>${esc(songArtist(s))}</span></button>`;}).join("")||"<p>—</p>";
  }

  function goProfile(handle=null) {
    const url=new URL(location.href);url.searchParams.set("view",PROFILE_VIEW);if(handle)url.searchParams.set("profile",handle);else url.searchParams.delete("profile");history.pushState({jhgRoute:true,view:PROFILE_VIEW},"",url);renderView(PROFILE_VIEW);renderProfile(handle).catch(err=>showStatus(err.message,"error"));
  }

  async function enterSwipe() {
    if(!state.catalog.length){await loadCatalog();await loadOwnStates();renderFeed();}
  }

  function wire() {
    VALID_VIEWS.add(VIEW);VALID_VIEWS.add(PROFILE_VIEW);ensureSheet();
    document.addEventListener("click",async e=>{
      const route=e.target.closest('[data-route="swipe"]');if(route)setTimeout(()=>enterSwipe().catch(err=>showStatus(err.message,"error")),0);
      if(e.target.closest("[data-route]")&&!route)setTimeout(()=>stopAllPlayers(),0);
      const sound=e.target.closest("[data-v2-sound]");if(sound)toggleSound();
      const action=e.target.closest("[data-v2-action]");if(action){const type=action.dataset.v2Action,id=Number(action.dataset.songId);if(type==="comments")await openComments(id);else await toggleAction(type,id,action);}
      if(e.target.closest("[data-v2-close]")){const s=document.querySelector("#v2CommentSheet");s.classList.remove("is-open");s.setAttribute("aria-hidden","true");}
      const reply=e.target.closest("[data-v2-reply]");if(reply){state.replyTo=reply.dataset.v2Reply;document.querySelector("#v2CommentForm input").focus();}
      const like=e.target.closest("[data-v2-comment-like]");if(like)await toggleCommentLike(like.dataset.v2CommentLike,like);
      const profile=e.target.closest("[data-v2-profile]");if(profile)goProfile(profile.dataset.v2Profile);
      const tab=e.target.closest("[data-v2-profile-tab]");if(tab)renderProfileTab(tab.dataset.v2ProfileTab);
      const song=e.target.closest("[data-v2-song]");if(song)openSongDetail(Number(song.dataset.v2Song));
    });
    document.addEventListener("submit",e=>{if(e.target.id==="v2CommentForm"){e.preventDefault();submitComment(e.target).catch(err=>showStatus(err.message,"error"));}});
    window.addEventListener("popstate",()=>{const v=new URLSearchParams(location.search).get("view");if(v===VIEW)enterSwipe().catch(()=>{});if(v===PROFILE_VIEW)renderProfile(new URLSearchParams(location.search).get("profile")).catch(()=>{});else stopAllPlayers();});
    document.addEventListener("visibilitychange",()=>{if(document.hidden)stopAllPlayers();else if(currentView===VIEW&&state.activeId)autoplaySong(state.activeId).catch(()=>{});});
    const baseSet=window.setInterfaceLanguage || setInterfaceLanguage;
    window.setInterfaceLanguage=setInterfaceLanguage=function(language,persist=true){const result=baseSet(language,persist);const label=document.querySelector("#v2DiscoverNavLabel");if(label)label.textContent=t("discover");if(currentView===VIEW&&state.catalog.length)renderFeed();return result;};
    const requested=new URLSearchParams(location.search).get("view");if(requested===VIEW)setTimeout(()=>enterSwipe().catch(err=>showStatus(err.message,"error")),0);if(requested===PROFILE_VIEW)setTimeout(()=>renderProfile(new URLSearchParams(location.search).get("profile")).catch(err=>showStatus(err.message,"error")),0);
    const label=document.querySelector("#v2DiscoverNavLabel");if(label)label.textContent=t("discover");
  }

  document.addEventListener("DOMContentLoaded",wire);
  window.JHGV2={ enterSwipe, randomSource, openProfile:goProfile };
})();
