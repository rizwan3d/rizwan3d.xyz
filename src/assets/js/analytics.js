(() => {
  const config = window.BLOGIN_CONFIG?.posthog || {};
  const projectToken = String(config.projectToken || "").trim();
  const host = String(config.host || "").trim().replace(/\/$/, "");
  let loading;

  if (!projectToken || !host) {
    if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
      const missing = projectToken ? "POSTHOG_HOST" : "POSTHOG_PROJECT_TOKEN";
      console.error(`${missing} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missing} is configured`);
    }
    return;
  }

  const loadPostHog = async () => {
    if (window.__RIZWAN_POSTHOG_LOADED__) return window.posthog;
    if (!window.RIZWAN_CONSENT?.allows("analytics")) return;
    if (loading) return loading;

    loading = import("./vendor/module.mjs")
      .then(({ default: posthog }) => {
        posthog.init(projectToken, {
          api_host: host,
          defaults: "2026-05-30",
          respect_dnt: true,
          person_profiles: "identified_only",
          capture_exceptions: true
        });
        window.posthog = posthog;
        window.__RIZWAN_POSTHOG_LOADED__ = true;
        return posthog;
      })
      .catch((error) => {
        loading = undefined;
        console.error("PostHog failed to load.", error);
      });

    return loading;
  };

  loadPostHog();

  window.addEventListener("rizwan:consent-changed", () => {
    if (window.RIZWAN_CONSENT?.allows("analytics")) {
      loadPostHog();
    } else if (window.posthog) {
      window.posthog.opt_out_capturing();
    }
  });
})();
