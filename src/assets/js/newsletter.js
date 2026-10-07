(() => {
  const mount = document.querySelector("[data-kit-newsletter]");
  if (!mount) return;

  const note = mount.querySelector("[data-kit-note]");
  const config = window.BLOGIN_CONFIG?.kit || {};
  const formUid = String(config.formUid || "").trim();
  const embedSrc = String(config.embedSrc || "").trim();
  let viewReady = false;

  const configured =
    formUid &&
    embedSrc &&
    /^https:\/\//i.test(embedSrc);

  const setConsentMessage = () => {
    if (!note || mount.dataset.loaded === "true") return;
    note.hidden = false;
    note.innerHTML = 'Newsletter signup is off until you allow <strong>Newsletter — Kit</strong> in your privacy settings. <button class="consent-inline-button" type="button" data-cookie-settings>Manage cookies</button>';
  };

  if (!configured) {
    if (note) {
      note.textContent =
        "Newsletter setup is incomplete. Add your Kit form UID and JavaScript embed URL in config/site.json.";
    }
    return;
  }

  const showError = () => {
    if (note) {
      note.hidden = false;
      note.textContent = "The newsletter form could not load. Please try again later.";
    }
  };

  const hideStatusWhenFormAppears = () => {
    if (mount.querySelector(".formkit-form")) {
      if (note) note.hidden = true;
      return true;
    }
    return false;
  };

  const loadKit = () => {
    if (mount.dataset.loaded === "true") return;
    if (!window.RIZWAN_CONSENT?.allows("newsletter")) {
      setConsentMessage();
      return;
    }
    if (!viewReady) return;

    mount.dataset.loaded = "true";

    const observer = new MutationObserver(() => {
      if (hideStatusWhenFormAppears()) observer.disconnect();
    });
    observer.observe(mount, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.async = true;
    script.dataset.uid = formUid;
    script.src = embedSrc;
    script.addEventListener("load", () => {
      hideStatusWhenFormAppears();
      setTimeout(hideStatusWhenFormAppears, 300);
      setTimeout(hideStatusWhenFormAppears, 1000);
    });
    script.addEventListener("error", () => {
      observer.disconnect();
      showError();
    });

    mount.append(script);
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        viewReady = true;
        loadKit();
      }
    }, { rootMargin: "500px" });
    observer.observe(mount);
  } else {
    viewReady = true;
  }

  if (!window.RIZWAN_CONSENT?.allows("newsletter")) {
    setConsentMessage();
  } else {
    loadKit();
  }

  window.addEventListener("rizwan:consent-changed", () => {
    if (window.RIZWAN_CONSENT?.allows("newsletter")) loadKit();
    else setConsentMessage();
  });
})();
