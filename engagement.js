(() => {
  "use strict";
  const VIEW="curator";
  let dashboard=null,worldFeed=[],activeTab="japan";
  const ja=()=>window.interfaceLanguage==="ja"||typeof interfaceLanguage!=="undefined"&&interfaceLanguage==="ja";
  const text=(en,jp)=>ja()?jp:en;
  const e=(v)=>String(v??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
  const rpc=async(name,args={})=>rest(`rpc/${name}`,{method:"POST",authenticated:true,body:JSON.stringify(args)});
  const featureSets={
    japan:[
      ["01","My recommendations","自分の推薦曲","推薦した曲と現在の海外反応をまとめて確認します。","ranking"],
      ["02","World response dashboard","海外反応ダッシュボード","発見・保存・評価がどの程度届いたかを可視化します。","reactions"],
      ["03","Reaction notifications","反応通知","推薦曲に届いた反応を見逃さない受信箱です。","notifications"],
      ["04","Curator profile","推薦者プロフィール","選曲テーマと実績を公開プロフィールにまとめます。","profile-v2"],
      ["05","First recommender","最初の発掘者","最初に推薦した曲を記録し、発掘実績として残します。","first"],
      ["06","Global milestones","海外到達記録","海外10・50・100発見などの到達を追跡します。","milestones"],
      ["07","Weekly missions","週次ミッション","推薦・翻訳・修正・共有から今週の目標を選びます。","missions"],
      ["08","World reaction feed","海外反応フィード","世界のどこで曲が発見・保存されたかを表示します。","world"],
      ["09","Rediscover J-POP","日本人向け再発見","年代やタグを横断して国内の隠れた曲を発見します。","swipe"],
      ["10","Quality curator level","品質ベースの称号","量ではなく海外発見と情報品質から成長を示します。","progress"],
      ["11","Shareable collection","共有コレクション","世界に届けたい曲をまとめて共有します。","playlists"]
    ],
    loop1:[
      ["12","Weekly listening snapshot","週間活動スナップショット","Spotifyの週間統計を参考に、今週の発見と貢献を要約します。","recap"],
      ["13","Taste controls","好み調整","Spotify Taste Profileのように推薦への影響度を調整します。","taste"],
      ["14","Mood discovery","気分から発見","daylist型の気分チップから曲を探します。","mood"],
      ["15","Collaborative picks","共同選曲","共同プレイリスト型で友人と発見曲を集めます。","playlists"],
      ["16","Taste blend","好みブレンド","友人との共通点から新しい曲を探します。","community"],
      ["17","Send a gem","曲を直接シェア","メッセージ機能の代わりに安全な共有リンクを生成します。","share"],
      ["18","Why this song","推薦理由","おすすめ理由を曲と一緒に明示します。","personalized"],
      ["19","Discovery distance","冒険度","馴染み重視・バランス・冒険重視を選択できます。","distance"],
      ["20","Gentle streak","ゆるい継続記録","途切れを罰しない形で継続日数を表示します。","progress"],
      ["21","Next best action","次にやること","現在の活動から価値の高い次の一手を1つ提案します。","next"]
    ],
    loop2:[
      ["22","Contribution XP","貢献XP","有益な行動だけを合計し、進捗として表示します。","progress"],
      ["23","Flexible daily goal","柔軟なデイリー目標","短時間で終わる目標を自分で選びます。","missions"],
      ["24","Curator league","推薦者リーグ","投稿量ではなく発見への貢献を週単位で比較します。","community"],
      ["25","Achievement passport","実績パスポート","Reddit型の非金銭バッジをプロフィールに整理します。","badges"],
      ["26","Activity reactions","活動へのリアクション","海外の発見や推薦活動へ簡単な反応を送ります。","world"],
      ["27","Follow curators","推薦者をフォロー","信頼する選曲者の新しい推薦を追跡します。","community"],
      ["28","Ranked editorial lists","テーマ別ランキングリスト","Letterboxd型のテーマ別・年代別リストを作成します。","playlists"],
      ["29","Prompt of the day","今日の選曲テーマ","毎日1つの選曲テーマを提示します。","prompt"],
      ["30","Comeback digest","再訪ダイジェスト","不在中に推薦曲へ届いた変化をまとめます。","recap"],
      ["31","Curator roadmap","推薦者ロードマップ","次の称号までの進捗と具体的な行動を示します。","roadmap"]
    ]
  };
  const englishDescriptions={
    "01":"Review your recommendations and their current overseas response.","02":"Track discoveries, saves, and ratings generated abroad.","03":"See new activity on your recommended songs in one inbox.","04":"Present your selection theme and impact on your public profile.","05":"Keep a record of songs you introduced first.","06":"Track milestones such as 10, 50, and 100 overseas discoveries.","07":"Choose a weekly goal from recommending, translating, correcting, or sharing.","08":"See where songs are being discovered and saved around the world.","09":"Rediscover lesser-known Japanese music across eras and tags.","10":"Show growth through discovery quality instead of posting volume.","11":"Build and share a collection of songs worth sending worldwide.",
    "12":"Summarize this week’s discoveries and contributions.","13":"Control how strongly your listening affects recommendations.","14":"Discover music through a daily mood prompt.","15":"Collect discoveries together with friends.","16":"Find songs through shared taste with another curator.","17":"Create a safe link for sharing a gem directly.","18":"Show the reason behind every recommendation.","19":"Choose familiar, balanced, or adventurous discovery.","20":"Show continuity without punishing missed days.","21":"Suggest one valuable next action from your current activity.",
    "22":"Count only useful contributions as visible progress.","23":"Choose a small daily goal that fits your available time.","24":"Compare weekly discovery impact rather than posting volume.","25":"Organize non-monetary achievement badges on your profile.","26":"Send lightweight reactions to discoveries and recommendations.","27":"Follow trusted curators and their latest recommendations.","28":"Create ranked lists by theme, genre, or era.","29":"Receive one optional selection prompt each day.","30":"Summarize meaningful changes that happened while you were away.","31":"See progress toward the next curator milestone and what helps reach it."
  };
  function toast(message){document.querySelector(".curator-toast")?.remove();const n=document.createElement("div");n.className="curator-toast";n.textContent=message;document.body.append(n);setTimeout(()=>n.remove(),2600);}
  function metric(value,label){return `<div class="curator-stat"><strong>${Number(value||0).toLocaleString()}</strong><span>${e(label)}</span></div>`;}
  function render(){const root=document.querySelector("#curatorRoot");if(!root)return;const d=dashboard||{};root.innerHTML=`
    <div class="curator-stats">${metric(d.recommended_count,text("Picks","推薦曲"))}${metric(d.first_recommender_count,text("First finds","初回発掘"))}${metric(d.overseas_discoveries,text("World discoveries","海外発見"))}${metric(d.overseas_saves,text("World saves","海外保存"))}${metric(d.actions_this_week,text("This week","今週の貢献"))}${metric(d.streak,text("Gentle streak","継続日数"))}</div>
    <nav class="curator-tabs">${[["japan",text("Japan value","日本人向け11")],["loop1",text("Discovery loop","改善ループ1")],["loop2",text("Community loop","改善ループ2")],["data",text("Live data","実データ")]].map(([k,l])=>`<button class="${activeTab===k?"is-on":""}" data-eng-tab="${k}">${e(l)}</button>`).join("")}</nav>
    ${activeTab==="data"?renderData(d):`<div class="curator-grid">${featureSets[activeTab].map(card).join("")}</div>`}
    <p class="healthy-note">${e(text("JHG uses gentle progress and user-controlled notifications. It avoids loss-based streak pressure and infinite autoplay.","JHGは、途切れを責めない進捗表示と利用者が制御できる通知を採用し、損失不安や無限自動再生には依存しません。"))}</p>`;}
  function card(f){return `<article class="engagement-card"><small>${f[0]}</small><h3>${e(text(f[1],f[2]))}</h3><p>${e(text(englishDescriptions[f[0]],f[3]))}</p><button data-eng-action="${f[4]}">${e(text("Open","開く"))}</button></article>`;}
  function renderData(d){const items=d.songs||[],notes=d.notifications||[];return `<section class="curator-panel"><h2>${e(text("Your songs abroad","推薦曲の海外反応"))}</h2>${items.length?items.slice(0,20).map(s=>`<div class="curator-song-row"><div><b>${e(ja()?s.title:(s.title_en||s.title))}</b><br><small>${e(ja()?s.artist:(s.artist_en||s.artist))}${s.first_recommender?" · First recommender":""}</small></div><div>${s.overseas_discoveries||0} ${e(text("discoveries","発見"))}<br>${s.overseas_saves||0} Save</div></div>`).join(""):`<p>${e(text("Recommend a song to begin tracking its journey.","曲を推薦すると、ここで海外への広がりを追跡できます。"))}</p>`}</section><section class="curator-panel"><h2>${e(text("World activity","世界の反応"))}</h2>${worldFeed.length?worldFeed.map(x=>`<div class="world-event"><span>${e(x.region)} · ${e(x.event_type)} · ${e(ja()?x.title:(x.title_en||x.title))}</span><b>${x.event_count}</b></div>`).join(""):`<p>${e(text("No recent overseas activity yet.","最近の海外反応はまだありません。"))}</p>`}</section><section class="curator-panel"><h2>${e(text("Notifications","通知"))}</h2>${notes.length?notes.map(n=>`<div class="curator-note"><span>${e(n.message)}</span><button data-note-read="${n.id}">${n.is_read?"✓":text("Read","既読")}</button></div>`).join(""):`<p>${e(text("You are all caught up.","未読通知はありません。"))}</p>`}</section>`;}
  async function record(action,songId=null,metadata={}){try{await rpc("record_curator_action",{p_action_key:action,p_song_id:songId,p_metadata:metadata});}catch{}}
  async function savePreference(changes){const current=dashboard?.preferences||{};await rest("engagement_preferences?on_conflict=user_id",{method:"POST",authenticated:true,headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify({user_id:currentUser.id,discovery_mode:changes.discovery_mode||current.discovery_mode||"balanced",preferred_moods:changes.preferred_moods||current.preferred_moods||[],excluded_song_ids:current.excluded_song_ids||[],quiet_mode:current.quiet_mode||false,weekly_digest:current.weekly_digest!==false})});await load();}
  async function action(key){
    const routes=new Set(["ranking","profile-v2","swipe","playlists","community","personalized"]);if(routes.has(key)){await record(key==="swipe"?"discover":"reaction_check");navigateTo(key);return;}
    if(key==="reactions"||key==="notifications"||key==="world"||key==="first"||key==="milestones"){activeTab="data";render();return;}
    if(key==="taste"||key==="distance"){const current=dashboard?.preferences?.discovery_mode||"balanced",next=current==="balanced"?"adventurous":current==="adventurous"?"familiar":"balanced";await savePreference({discovery_mode:next});toast(text(`Discovery mode: ${next}`,`発見モード：${next}`));return;}
    if(key==="mood"||key==="prompt"){const moods=["late-night","uplifting","nostalgic","focused"],m=moods[new Date().getDate()%moods.length];await savePreference({preferred_moods:[m]});await record("daily_prompt",null,{mood:m});toast(text(`Today’s theme: ${m}`,`今日のテーマ：${m}`));navigateTo("genres");return;}
    if(key==="share"){const url=new URL(location.href);url.searchParams.set("view","curator");await navigator.clipboard?.writeText(url.href);await record("share");toast(text("Curator link copied.","推薦者リンクをコピーしました。"));return;}
    if(key==="missions"){await rest("curator_weekly_focus?on_conflict=user_id,week_start,focus_key",{method:"POST",authenticated:true,headers:{Prefer:"resolution=ignore-duplicates,return=minimal"},body:JSON.stringify({user_id:currentUser.id,week_start:new Date(Date.now()-((new Date().getDay()+6)%7)*86400000).toISOString().slice(0,10),focus_key:"recommend",target_count:3})});await record("mission");toast(text("Weekly mission set: recommend 3 gems.","今週の目標：3曲を推薦する"));await load();return;}
    if(key==="recap"||key==="progress"||key==="roadmap"||key==="badges"||key==="next"){activeTab="data";render();toast(text(`This week: ${dashboard?.actions_this_week||0} contributions, ${dashboard?.overseas_discoveries||0} discoveries.`,`今週の貢献 ${dashboard?.actions_this_week||0}件・海外発見 ${dashboard?.overseas_discoveries||0}件`));return;}
    toast(text("Connected to an existing JHG feature.","既存のJHG機能へ接続されています。"));
  }
  async function load(){try{[dashboard,worldFeed]=await Promise.all([rpc("get_curator_command_center"),rpc("get_curator_world_feed",{p_limit:20})]);render();}catch(error){document.querySelector("#curatorRoot").innerHTML=`<div class="curator-panel"><p>${e(error.message)}</p><button class="button" data-route="request">${e(text("Recommend a song","曲を推薦する"))}</button></div>`;}}
  function localizeShell(){const values={curatorNavLabel:text("Curator Hub","推薦者ハブ"),curatorEyebrow:text("CURATOR COMMAND CENTER","推薦者コマンドセンター"),curatorTitle:text("Send J-POP worldwide.","J-POPを世界へ。"),curatorIntro:text("See where your recommendations are discovered, saved, and discussed.","あなたの推薦がどこで発見され、保存され、語られたかを見届けよう。"),curatorRecommendLabel:text("Recommend a song","曲を推薦する")};Object.entries(values).forEach(([id,value])=>{const node=document.getElementById(id);if(node)node.textContent=value;});}
  function wire(){VALID_VIEWS.add(VIEW);localizeShell();document.addEventListener("jhg:languagechange",()=>{localizeShell();if(dashboard)render();});document.addEventListener("click",async(ev)=>{const tab=ev.target.closest("[data-eng-tab]");if(tab){activeTab=tab.dataset.engTab;render();return;}const a=ev.target.closest("[data-eng-action]");if(a){a.disabled=true;try{await action(a.dataset.engAction);}finally{a.disabled=false;}}const n=ev.target.closest("[data-note-read]");if(n){await rest(`curator_notifications?id=eq.${n.dataset.noteRead}&user_id=eq.${currentUser.id}`,{method:"PATCH",authenticated:true,headers:{Prefer:"return=minimal"},body:JSON.stringify({is_read:true})});await load();}});document.querySelector('[data-route="curator"]')?.addEventListener("click",()=>setTimeout(load,0));if(new URLSearchParams(location.search).get("view")===VIEW)setTimeout(load,0);}
  document.addEventListener("DOMContentLoaded",wire);window.JHGEngagement={load};
})();
