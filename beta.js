(() => {
  "use strict";
  const RELEASE="2026.08.23-beta.1";
  const isJa=()=>window.interfaceLanguage==="ja";
  const tx=(en,ja)=>isJa()?ja:en;
  function localize(){
    const values={betaBadge:tx("EARLY BETA","先行β版"),betaMessage:tx("Real listener data is being collected. Reference scores are clearly marked.","実際の回答を収集中です。初期参考スコアは明確に区別して表示します。"),betaFeedbackButton:tx("Send feedback","意見を送る")};
    Object.entries(values).forEach(([id,value])=>{const n=document.getElementById(id);if(n)n.textContent=value;});
  }
  function updateNotice(){
    if(localStorage.getItem("jhg_seen_release")===RELEASE)return;
    const box=document.createElement("div");box.className="beta-update-toast";box.innerHTML="<strong>"+tx("JHG beta is now live","JHG先行β版を公開しました")+"</strong><span>"+tx("Real responses are separated from reference starter scores. Reports and feedback are reviewed by the operator.","実際の回答と初期参考スコアを分離し、通報と要望を運営が確認できるようにしました。")+"</span><button type=\"button\">OK</button>";
    box.querySelector("button").addEventListener("click",()=>{localStorage.setItem("jhg_seen_release",RELEASE);box.remove();});document.body.append(box);
  }
  async function report(kind,message){
    if((typeof currentUser==="undefined"||!currentUser)&&(typeof accessToken==="undefined"||!accessToken))return;
    try{await rest("rpc/report_beta_client_error",{method:"POST",authenticated:true,body:JSON.stringify({p_error_code:kind,p_message:String(message||"").slice(0,450),p_page:location.pathname+location.search,p_app_version:RELEASE})});}catch{}
  }
  document.addEventListener("DOMContentLoaded",()=>{
    localize();updateNotice();
    document.getElementById("betaDismissButton")?.addEventListener("click",()=>document.getElementById("betaBanner")?.remove());
    document.getElementById("betaFeedbackButton")?.addEventListener("click",()=>typeof navigateTo==="function"?navigateTo("feedback"):location.assign("./?view=feedback"));
    document.addEventListener("jhg:languagechange",localize);
    window.addEventListener("error",e=>report("window_error",e.message));
    window.addEventListener("unhandledrejection",e=>report("unhandled_rejection",e.reason?.message||"Unhandled promise rejection"));
  });
  window.JHGBeta={release:RELEASE};
})();
