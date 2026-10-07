(() => {
  const config = window.BLOGIN_CONFIG?.matomo || {};
  const url = String(config.url || "").trim();
  const siteId = String(config.siteId || "").trim();

  if (!url || !siteId) return;

  const normalizedUrl = url.endsWith("/") ? url : `${url}/`;

  const loadMatomo = () => {
    if (window.__RIZWAN_MATOMO_LOADED__) return;
    if (!window.RIZWAN_CONSENT?.allows("analytics")) return;

    window.__RIZWAN_MATOMO_LOADED__ = true;

    const _paq = window._paq = window._paq || [];

    // Privacy-friendly defaults.
    _paq.push(["setDoNotTrack", true]);
    _paq.push(["trackPageView"]);
    _paq.push(["enableLinkTracking"]);
    _paq.push(["setTrackerUrl", `${normalizedUrl}matomo.php`]);
    _paq.push(["setSiteId", siteId]);

    const script = document.createElement("script");
    script.async = true;
    script.src = `${normalizedUrl}matomo.js`;
    script.referrerPolicy = "strict-origin-when-cross-origin";

    document.head.appendChild(script);
  };

  loadMatomo();

  window.addEventListener("rizwan:consent-changed", () => {
    if (window.RIZWAN_CONSENT?.allows("analytics")) {
      loadMatomo();
    }
  });
})();
