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
})();
