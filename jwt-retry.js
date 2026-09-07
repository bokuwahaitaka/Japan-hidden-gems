// Retry transient Supabase REST failures when a freshly issued JWT is briefly
// considered to be in the future by another Supabase service.
(() => {
  const nativeFetch = window.fetch.bind(window);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const isSupabaseRest = url.includes(".supabase.co/rest/v1/");
    const maxAttempts = isSupabaseRest ? 4 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const response = await nativeFetch(input, init);
      if (response.ok || !isSupabaseRest || attempt === maxAttempts) return response;

      let text = "";
      try {
        text = await response.clone().text();
      } catch {
        return response;
      }

      if (!/JWT issued at future/i.test(text)) return response;

      // Small clock skew between auth and REST services normally clears quickly.
      await sleep(1000 * attempt);
    }
  };

  // Production UX hardening. Kept in the earliest bootstrap so direct URLs and
  // navigation clicks are guarded before feature modules handle them.
  const requestedView = () => new URLSearchParams(location.search).get("view");
  const profileCopy = {
    ko: ["익명 리스너 프로필", "음악 감상 취향을 알려주세요", "지역", "거주 중인 대략적인 지역을 선택하세요.", "연령대", "좋아하는 장르", "1~5개를 선택하세요.", "익명 설문 프로필에 저장됩니다. 이름이나 정확한 나이는 묻지 않습니다.", "저장하고 계속"],
    zh: ["匿名听众资料", "告诉我们你的收听偏好", "地区", "请选择你居住的大致地区。", "年龄段", "喜欢的音乐类型", "请选择 1–5 个。", "将保存到匿名调查资料中。我们不会询问姓名或准确年龄。", "保存并继续"],
    ru: ["АНОНИМНЫЙ ПРОФИЛЬ СЛУШАТЕЛЯ", "Расскажите о своих музыкальных привычках", "Регион", "Выберите регион, в котором вы живёте.", "Возрастная группа", "Любимые жанры", "Выберите 1–5.", "Сохраняется в анонимном профиле. Мы не спрашиваем имя или точный возраст.", "Сохранить и продолжить"],
    es: ["PERFIL ANÓNIMO DEL OYENTE", "Cuéntanos cómo escuchas música", "Región", "Elige la región general donde vives.", "Franja de edad", "Géneros que te gustan", "Elige entre 1 y 5.", "Se guarda en tu perfil anónimo. No pedimos tu nombre ni tu edad exacta.", "Guardar y continuar"],
    fr: ["PROFIL D’AUDITEUR ANONYME", "Parlez-nous de vos habitudes d’écoute", "Région", "Choisissez la grande région où vous vivez.", "Tranche d’âge", "Genres que vous aimez", "Choisissez-en 1 à 5.", "Enregistré dans votre profil anonyme. Nous ne demandons ni votre nom ni votre âge exact.", "Enregistrer et continuer"]
  };

  function forceRequestAudience() {
    if (requestedView() === "request") document.body.dataset.audience = "japan";
  }

  // This script is loaded after the DOM and before app.js, so direct-route state
  // can be established before the main router performs its first render.
  forceRequestAudience();
  if (requestedView() === "listen") {
    const loading = document.getElementById("ratingSections");
    if (loading && !loading.textContent.trim()) {
      loading.innerHTML = '<p class="muted" role="status" aria-live="polite">Loading song…</p>';
    }
  }

  function applyProfileCopy() {
    const lang = document.documentElement.dataset.language || document.documentElement.lang?.split("-")[0] || "en";
    const values = profileCopy[lang];
    if (!values) return;
    const ids = ["profileEyebrow", "profileTitle", "profileCountryLabel", "profileCountryHint", "profileAgeLabel", "profileGenresLabel", "profileGenresHint", "profilePrivacy", "profileSubmitButton"];
    ids.forEach((id, index) => { const node = document.getElementById(id); if (node) node.textContent = values[index]; });
  }

  function openProfileForDiscover() {
    const dialog = document.getElementById("profileDialog");
    if (!dialog) return false;
    sessionStorage.setItem("jhg_pending_discover_profile", "1");
    if (typeof dialog.showModal === "function" && !dialog.open) dialog.showModal();
    return true;
  }

  function needsDiscoverProfile() {
    try {
      return typeof audience !== "undefined" && audience === "overseas" && typeof listenerProfile !== "undefined" && !listenerProfile;
    } catch {
      return false;
    }
  }

  document.addEventListener("click", (event) => {
    const discover = event.target.closest?.('[data-route="swipe"]');
    if (discover && needsDiscoverProfile()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openProfileForDiscover();
      return;
    }

    const blend = event.target.closest?.('[data-growth-route="retention"]');
    if (blend) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (typeof navigateTo === "function") {
        navigateTo("retention");
        setTimeout(() => document.querySelector('[data-retention-tab="blend"]')?.click(), 0);
      }
    }
  }, true);

  window.addEventListener("popstate", () => setTimeout(forceRequestAudience, 0));

  document.addEventListener("DOMContentLoaded", () => {
    forceRequestAudience();
    applyProfileCopy();

    // Avoid layout/paint work for off-screen route panels while preserving SEO DOM.
    const style = document.createElement("style");
    style.textContent = '.screen-panel:not(.is-active){content-visibility:auto;contain-intrinsic-size:1px 900px}';
    document.head.appendChild(style);

    document.getElementById("languageSelect")?.addEventListener("change", () => setTimeout(applyProfileCopy, 0));
    document.getElementById("profileForm")?.addEventListener("submit", () => {
      if (sessionStorage.getItem("jhg_pending_discover_profile") !== "1") return;
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        let ready = false;
        try { ready = typeof listenerProfile !== "undefined" && Boolean(listenerProfile); } catch {}
        if (ready || attempts >= 40) {
          clearInterval(timer);
          if (ready) {
            sessionStorage.removeItem("jhg_pending_discover_profile");
            if (typeof navigateTo === "function") navigateTo("swipe");
          }
        }
      }, 250);
    });

    if (requestedView() === "swipe" && needsDiscoverProfile()) openProfileForDiscover();
  });
})();
