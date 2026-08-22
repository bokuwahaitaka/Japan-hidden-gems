/* Admin feedback queue */
let adminFeedbackRows=[];

async function adminFeedbackRequest(path,options={}){
  const response=await fetch(SUPABASE_URL+"/rest/v1/"+path,{
    ...options,
    headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+accessToken,"Content-Type":"application/json",...(options.headers||{})}
  });
  return parseResponse(response);
}

async function loadAdminFeedback(){
  const target=document.querySelector("#adminFeedback");
  if(!target||!accessToken)return;
  try{
    adminFeedbackRows=await adminFeedbackRequest("feedback_box?select=id,category,message,locale,page_context,status,admin_note,created_at&order=created_at.desc&limit=200");
    renderAdminFeedback();
  }catch(error){target.innerHTML='<p class="error">'+escapeHtml(error.message)+'</p>';}
}

function renderAdminFeedback(){
  const target=document.querySelector("#adminFeedback");if(!target)return;
  if(!adminFeedbackRows.length){target.innerHTML="<p>利用者からの要望はまだありません。</p>";return;}
  const labels={feature:"機能要望",bug:"不具合",song:"曲",content:"内容",other:"その他"};
  target.innerHTML=adminFeedbackRows.map(row=>`
    <article class="song-row feedback-admin-row">
      <div class="song-copy">
        <span class="badge">${escapeHtml(labels[row.category]||row.category)}</span>
        <span class="badge">${escapeHtml(row.locale.toUpperCase())}</span>
        <h2>${escapeHtml(row.message)}</h2>
        <small>${escapeHtml(new Date(row.created_at).toLocaleString("ja-JP"))}${row.page_context?" · "+escapeHtml(row.page_context):""}</small>
      </div>
      <div class="song-actions">
        <select data-feedback-status="${row.id}">
          ${["pending","reviewed","planned","resolved","closed"].map(s=>`<option value="${s}" ${row.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
        <button type="button" data-feedback-save="${row.id}">状態を保存</button>
      </div>
    </article>
  `).join("");
}

async function saveFeedbackStatus(button){
  const id=Number(button.dataset.feedbackSave);
  const select=document.querySelector('[data-feedback-status="'+id+'"]');
  button.disabled=true;
  try{
    await adminFeedbackRequest("feedback_box?id=eq."+id,{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({status:select.value,updated_at:new Date().toISOString()})});
    const row=adminFeedbackRows.find(r=>Number(r.id)===id);if(row)row.status=select.value;
  }catch(error){document.querySelector("#adminFeedbackStatus").textContent=error.message;}
  finally{button.disabled=false;}
}

function installAdminFeedback(){
  const panel=document.querySelector("#adminPanel");if(!panel)return;
  const songsHeading=[...panel.children].find(el=>el.tagName==="H2"&&el.textContent.includes("登録曲"));
  songsHeading?.insertAdjacentHTML("beforebegin",`<section class="panel"><h2>利用者からの目安箱</h2><p id="adminFeedbackStatus" class="status"></p><div id="adminFeedback" class="song-list"></div></section>`);
  document.querySelector("#adminFeedback")?.addEventListener("click",e=>{const b=e.target.closest("[data-feedback-save]");if(b)saveFeedbackStatus(b);});
}

const originalAdminLoadSongs=loadSongs;
loadSongs=async function(){await originalAdminLoadSongs();await loadAdminFeedback();};
installAdminFeedback();
