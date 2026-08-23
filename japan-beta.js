(() => {
  "use strict";
  const selected = new Set();
  const byId = (id) => document.getElementById(id);
  const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));

  function youtubeId(value) {
    try {
      const url = new URL(value.trim());
      const host = url.hostname.replace(/^www\./, "");
      let id = host === "youtu.be" ? url.pathname.split("/").filter(Boolean)[0] : url.searchParams.get("v");
      if (!id && ["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
        const parts = url.pathname.split("/").filter(Boolean);
        if (["shorts", "embed", "live"].includes(parts[0])) id = parts[1];
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id || "") ? id : null;
    } catch { return null; }
  }

  function visibleSongs() {
    return (Array.isArray(songs) ? songs : []).filter((song) => !song.isHidden && !song.is_hidden);
  }

  function artwork(song) {
    return song.appleArtworkUrl || song.apple_artwork_url || song.youtubeThumbnailUrl || song.youtube_thumbnail_url || (song.youtubeVideoId || song.youtube_video_id ? `https://i.ytimg.com/vi/${song.youtubeVideoId || song.youtube_video_id}/mqdefault.jpg` : "");
  }

  function renderPicker() {
    const catalog = byId("japanBetaCatalog");
    if (!catalog) return;
    const query = (byId("japanBetaSearch")?.value || "").trim().toLocaleLowerCase();
    const matches = visibleSongs().filter((song) => `${song.title || ""} ${song.artist || ""}`.toLocaleLowerCase().includes(query)).slice(0, 100);
    catalog.innerHTML = matches.map((song) => {
      const id = Number(song.id);
      const image = artwork(song);
      return `<button class="beta-song-option${selected.has(id) ? " is-selected" : ""}" type="button" data-beta-song="${id}">${image ? `<img src="${esc(image)}" alt="" loading="lazy">` : "<span></span>"}<span><strong>${esc(song.title)}</strong><span>${esc(song.artist)}${song.year ? ` · ${song.year}` : ""}</span></span></button>`;
    }).join("") || "<p>一致する曲がありません。見つからない場合は、公式MVリンクから追加してください。</p>";
    const chosen = visibleSongs().filter((song) => selected.has(Number(song.id)));
    byId("japanBetaSelected").innerHTML = chosen.map((song) => `<button type="button" data-beta-remove="${song.id}">${esc(song.title)} ×</button>`).join("");
    byId("japanBetaSelectedCount").textContent = `${selected.size}曲を推薦中`;
  }

  async function loadCampaignStatus() {
    try {
      const rows = await rest("rpc/get_japan_beta_campaign_status", {method:"POST", authenticated:true, body:"{}"});
      const status = Array.isArray(rows) ? rows[0] : rows;
      if (status && byId("japanBetaCampaignProgress")) byId("japanBetaCampaignProgress").textContent = `${status.participant_count || 0}人が参加 · 目標${status.target_count || 100}人`;
    } catch { if (byId("japanBetaCampaignProgress")) byId("japanBetaCampaignProgress").textContent = "先行推薦データを募集中"; }
  }

  async function loadMyPicks() {
    try {
      const rows = await rest("japan_beta_picks?select=song_id", {authenticated:true});
      selected.clear();
      (rows || []).forEach((row) => selected.add(Number(row.song_id)));
      renderPicker();
    } catch (error) { byId("japanBetaStatus").textContent = error.message; }
  }

  async function setPick(songId, shouldSelect) {
    const status = byId("japanBetaStatus");
    status.textContent = "保存中…";
    try {
      await rest("rpc/set_japan_beta_pick", {method:"POST",authenticated:true,body:JSON.stringify({p_song_id:Number(songId),p_selected:Boolean(shouldSelect)})});
      if (shouldSelect) selected.add(Number(songId)); else selected.delete(Number(songId));
      status.className = "beta-complete";
      status.textContent = shouldSelect ? "推薦に追加しました。" : "推薦から外しました。";
      renderPicker();
      loadCampaignStatus();
    } catch (error) { status.className = "form-error"; status.textContent = error.message; }
  }

  async function submitMv(event) {
    event.preventDefault();
    const input = byId("songMvUrl"), button = byId("songMvSubmit"), note = byId("songRequestNote");
    const videoId = youtubeId(input.value);
    if (!videoId) { note.textContent = "有効なYouTube動画リンクを貼ってください。"; return; }
    button.disabled = true; button.textContent = "動画情報を確認中…"; note.textContent = "";
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/resolve-youtube-link`, {method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${accessToken}`,"Content-Type":"application/json"},body:JSON.stringify({url:`https://www.youtube.com/watch?v=${videoId}`})});
      const metadata = await response.json();
      if (!response.ok) throw new Error(metadata.error || "動画情報を取得できませんでした。");
      const result = await rest("rpc/request_song", {method:"POST",authenticated:true,body:JSON.stringify({p_title:metadata.title,p_artist:metadata.authorName,p_youtube_url:`https://www.youtube.com/watch?v=${videoId}`,p_video_id:videoId})});
      input.value = ""; note.textContent = `「${metadata.title}」を追加しました。`; note.className = "beta-complete";
      await loadAll();
      const addedId = Number(Array.isArray(result) ? result[0] : result);
      if (addedId) await setPick(addedId, true); else renderPicker();
    } catch (error) { note.className = "form-error"; note.textContent = error.message; }
    finally { button.disabled = false; button.textContent = "リンクから追加"; }
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("prelaunch-japan");
    VALID_VIEWS.add("japan-beta");
    const url = new URL(window.location.href); url.searchParams.set("view", "japan-beta"); window.history.replaceState({jhgRoute:true,view:"japan-beta"},"",url);
    byId("japanBetaSearch")?.addEventListener("input", renderPicker);
    byId("japanBetaCatalog")?.addEventListener("click", async (event) => { const button = event.target.closest("[data-beta-song]"); if (!button || button.disabled) return; button.disabled=true; const id=Number(button.dataset.betaSong); await setPick(id,!selected.has(id)); });
    byId("japanBetaSelected")?.addEventListener("click", async (event) => { const button=event.target.closest("[data-beta-remove]"); if(button && !button.disabled){button.disabled=true;await setPick(Number(button.dataset.betaRemove),false);} });
    byId("songMvRequestForm")?.addEventListener("submit", submitMv);
    document.addEventListener("click", (event) => { if (event.target.closest('[data-route="japan-beta"]')) setTimeout(() => {renderPicker();loadCampaignStatus();},0); });
    setTimeout(async () => {
      if (listenerProfile?.listener_group !== "japan" || listenerProfile?.country_code !== "JP") openProfileDialog("japan");
      else setAudience("japan", false);
      if (typeof renderView === "function") renderView("japan-beta");
      await loadMyPicks(); renderPicker(); loadCampaignStatus();
    }, 1200);
  });
})();
