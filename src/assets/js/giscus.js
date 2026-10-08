(() => {
  const mount = document.querySelector("[data-giscus]");
  if (!mount) return;

  const note = document.querySelector("[data-giscus-note]");
  const config = window.BLOGIN_CONFIG?.giscus || {};
  const ready = config.repo && config.repoId && config.category && config.categoryId;
  let viewReady = false;

  const setConsentMessage = () => {
    if (!note || mount.dataset.loaded === "true") return;
    note.hidden = false;
    note.innerHTML = 'Comments are off until you allow <strong>Comments - Giscus / GitHub</strong> in your privacy settings. <button class="consent-inline-button" type="button" data-cookie-settings>Manage cookies</button>';
  };

  if (!ready) {
    if (note) {
      note.hidden = false;
      note.textContent = "Giscus is not configured. Add your repository values in config/site.json, then rebuild.";
    }
    return;
  }

  const load = () => {
    if (mount.dataset.loaded === "true") return;
    if (!window.RIZWAN_CONSENT?.allows("comments")) {
      setConsentMessage();
      return;
    }
    if (!viewReady) return;

    mount.dataset.loaded = "true";
    if (note) note.hidden = true;

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.repo = config.repo;
    script.dataset.repoId = config.repoId;
    script.dataset.category = config.category;
    script.dataset.categoryId = config.categoryId;
    script.dataset.mapping = "pathname";
    script.dataset.strict = "0";
    script.dataset.reactionsEnabled = config.reactionsEnabled === false ? "0" : "1";
    script.dataset.emitMetadata = "0";
    script.dataset.inputPosition = "bottom";
    script.dataset.theme = "light";
    script.dataset.lang = "en";
    script.dataset.loading = "lazy";
    mount.append(script);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        viewReady = true;
        load();
      }
    }, { rootMargin: "600px" });
    observer.observe(mount);
  } else {
    viewReady = true;
  }

  if (!window.RIZWAN_CONSENT?.allows("comments")) {
    setConsentMessage();
  } else {
    load();
  }

  window.addEventListener("rizwan:consent-changed", () => {
    if (window.RIZWAN_CONSENT?.allows("comments")) load();
    else setConsentMessage();
  });
})();
