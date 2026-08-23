(function(){
"use strict";
const $=s=>document.querySelector(s),safe=v=>escapeHtml(String(v??""));
async function load(){
 if(!$("#communityAdminSuggestions")||!Array.isArray(adminSongs))return;
 $("#guideSongId").innerHTML=adminSongs.map(s=>`<option value="${s.id}">${safe(s.title)} — ${safe(s.artist)}</option>`).join("");
 const [suggestions,profiles]=await Promise.all([
  adminFeedbackRequest("song_data_suggestions?select=id,song_id,field_name,proposed_value,reason,status,created_at&status=eq.pending&order=created_at.asc&limit=200").catch(()=>[]),
  adminFeedbackRequest("public_profiles?select=user_id,handle,display_name,is_curator&is_public=eq.true&order=is_curator.desc,created_at.desc&limit=200").catch(()=>[])
 ]);
 $("#communityAdminSuggestions").innerHTML=suggestions.map(x=>{const s=adminSongs.find(q=>Number(q.id)===Number(x.song_id));return `<article class="song-row"><div><strong>${safe(s?.title||("曲 ID "+x.song_id))}</strong><p>${safe(x.field_name)} → ${safe(x.proposed_value)}</p><small>${safe(x.reason||"理由なし")}</small></div><div><button data-suggestion="${x.id}" data-status="accepted">採用</button><button class="secondary" data-suggestion="${x.id}" data-status="rejected">却下</button></div></article>`}).join("")||"<p>未対応の修正提案はありません。</p>";
 $("#communityAdminProfiles").innerHTML=profiles.map(p=>`<article class="song-row"><div><strong>${safe(p.display_name)}</strong><small>@${safe(p.handle)}</small></div><button data-curator="${p.user_id}" data-on="${p.is_curator}">${p.is_curator?"認定を解除":"キュレーター認定"}</button></article>`).join("")||"<p>公開プロフィールはありません。</p>";
}
document.addEventListener("click",async e=>{
 const s=e.target.closest("[data-suggestion]");if(s){await adminFeedbackRequest("song_data_suggestions?id=eq."+s.dataset.suggestion,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:s.dataset.status,reviewed_at:new Date().toISOString()})});load();}
 const c=e.target.closest("[data-curator]");if(c){await adminFeedbackRequest("public_profiles?user_id=eq."+c.dataset.curator,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({is_curator:c.dataset.on!=="true",updated_at:new Date().toISOString()})});load();}
});
$("#songGuideForm")?.addEventListener("submit",async e=>{e.preventDefault();const body={song_id:Number($("#guideSongId").value),locale:$("#guideLocale").value,summary:$("#guideSummary").value.trim(),theme:$("#guideTheme").value.trim(),cultural_context:$("#guideContext").value.trim(),title_meaning:$("#guideMeaning").value.trim(),listening_notes:$("#guideListening").value.trim(),mv_notes:$("#guideMv").value.trim(),status:"published",ai_generated:false,updated_at:new Date().toISOString()};await adminFeedbackRequest("song_guides?on_conflict=song_id,locale",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(body)});$("#adminStatus").textContent="曲ガイドを公開しました。";});
const timer=setInterval(()=>{if(!document.querySelector("#adminPanel.hidden")&&adminSongs.length){clearInterval(timer);load()}},700);
})();
