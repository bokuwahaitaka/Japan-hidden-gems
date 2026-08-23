(() => {
  "use strict";
  async function load(){
    const root=document.querySelector("#betaReadiness");if(!root||!accessToken)return;
    try{const d=await rpc("get_beta_readiness_snapshot");const rows=[
      ["公開曲",d.visible_songs],["初期参考スコア付き",d.reference_score_songs],["実回答",d.real_responses],
      ["未確認YouTube",d.unchecked_videos],["未対応の曲報告",d.open_quality_reports],["未対応タグ報告",d.open_tag_reports],
      ["未対応要望",d.open_feedback],["直近24時間のブラウザエラー",d.client_errors_24h]
    ];root.innerHTML='<div class="song-list">'+rows.map(([k,v])=>'<article class="song-row"><strong>'+escapeHtml(k)+'</strong><span class="badge">'+Number(v||0).toLocaleString("ja-JP")+'</span></article>').join("")+'</div><p>公開判定：'+(d.launch_blockers===0?'<b>重大ブロッカーなし</b>':'<b class="error">'+d.launch_blockers+'件を確認してください</b>')+'</p>';
    }catch(e){root.innerHTML='<p class="error">'+escapeHtml(e.message)+'</p>';}
  }
  function install(){const panel=document.querySelector("#adminPanel");if(!panel)return;panel.insertAdjacentHTML("afterbegin",'<section class="panel"><h2>β版 公開判定</h2><p>実データ、仮データ、通報、動画確認、ブラウザ障害を一画面で確認します。</p><div id="betaReadiness"></div><button id="reloadBetaReadiness" type="button">公開判定を更新</button></section>');document.querySelector("#reloadBetaReadiness")?.addEventListener("click",load);}
  const old=loadSongs;loadSongs=async function(){await old();await load();};install();
})();
