(() => {
  const KEY = "rizwan3d-consent-v1";
  const VERSION = 1;
  const basePath = document.documentElement.dataset.basePath || "/";

  const emptyPrefs = () => ({
    version: VERSION,
    decided: false,
    newsletter: false,
    comments: false,
    analytics: false,
    updatedAt: null
  });

  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      if (!value || value.version !== VERSION) return emptyPrefs();
      return {
        version: VERSION,
        decided: Boolean(value.decided),
        newsletter: Boolean(value.newsletter),
        comments: Boolean(value.comments),
        analytics: Boolean(value.analytics),
        updatedAt: value.updatedAt || null
      };
    } catch {
      return emptyPrefs();
    }
  };

  let prefs = read();

  const emit = () => {
    window.dispatchEvent(new CustomEvent("rizwan:consent-changed", {
      detail: { ...prefs }
    }));
  };

  const store = (next) => {
    const previous = { ...prefs };
    prefs = {
      version: VERSION,
      decided: true,
      newsletter: Boolean(next.newsletter),
      comments: Boolean(next.comments),
      analytics: Boolean(next.analytics),
      updatedAt: new Date().toISOString()
    };
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch {}
    emit();

    const revoked =
      (previous.newsletter && !prefs.newsletter) ||
      (previous.comments && !prefs.comments) ||
      (previous.analytics && !prefs.analytics);

    return revoked;
  };

  const markup = `
    <aside class="cookie-banner" data-cookie-banner hidden aria-label="Cookie consent">
      <div class="cookie-banner-copy">
        <strong>Your privacy choices</strong>
        <p>Rizwan3d uses only essential browser storage by default. With your permission, Matomo can measure site usage, Kit can load the newsletter form, and Giscus can load GitHub-powered comments.</p>
        <div class="cookie-policy-links">
          <a href="${basePath}privacy.html">Privacy</a>
          <a href="${basePath}cookies.html">Cookie policy</a>
        </div>
      </div>
      <div class="cookie-actions">
        <button class="cookie-btn cookie-btn-secondary" type="button" data-consent-reject>Reject optional</button>
        <button class="cookie-btn cookie-btn-secondary" type="button" data-consent-manage>Manage</button>
        <button class="cookie-btn cookie-btn-primary" type="button" data-consent-accept>Accept all</button>
      </div>
    </aside>

    <div class="cookie-modal" data-cookie-modal hidden>
      <div class="cookie-modal-backdrop" data-cookie-close></div>
      <section class="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
        <div class="cookie-dialog-head">
          <div>
            <p class="eyebrow">PRIVACY SETTINGS</p>
            <h2 id="cookie-title">Cookie preferences</h2>
          </div>
          <button class="cookie-close" type="button" aria-label="Close cookie preferences" data-cookie-close>×</button>
        </div>
        <p class="cookie-dialog-intro">Choose which optional third-party features may load. Essential site features stay available either way.</p>

        <div class="cookie-choice">
          <div>
            <strong>Essential</strong>
            <p>Required for core site behavior and remembering your privacy choice. No advertising or analytics cookies are used by this site.</p>
          </div>
          <label class="cookie-switch"><input type="checkbox" checked disabled><span>Always on</span></label>
        </div>

        <div class="cookie-choice">
          <div>
            <strong>Analytics - Matomo</strong>
            <p>Allows self-hosted Matomo analytics from analytics.rizwan3d.xyz to measure visits and site usage.</p>
          </div>
          <label class="cookie-switch"><input type="checkbox" data-consent-analytics><span>Allow</span></label>
        </div>

        <div class="cookie-choice">
          <div>
            <strong>Newsletter - Kit</strong>
            <p>Allows the Kit signup form to load. Kit may use cookies or similar technologies as described in its own privacy information.</p>
          </div>
          <label class="cookie-switch"><input type="checkbox" data-consent-newsletter><span>Allow</span></label>
        </div>

        <div class="cookie-choice">
          <div>
            <strong>Comments - Giscus / GitHub</strong>
            <p>Allows GitHub-powered comments to load. GitHub may use cookies or similar technologies when the comments widget is enabled.</p>
          </div>
          <label class="cookie-switch"><input type="checkbox" data-consent-comments><span>Allow</span></label>
        </div>

        <div class="cookie-dialog-actions">
          <a href="${basePath}cookies.html" class="cookie-policy-link">Read cookie policy</a>
          <div>
            <button class="cookie-btn cookie-btn-secondary" type="button" data-consent-reject-modal>Reject optional</button>
            <button class="cookie-btn cookie-btn-primary" type="button" data-consent-save>Save choices</button>
          </div>
        </div>
      </section>
    </div>`;

  document.body.insertAdjacentHTML("beforeend", markup);

  const banner = document.querySelector("[data-cookie-banner]");
  const modal = document.querySelector("[data-cookie-modal]");
  const analyticsInput = document.querySelector("[data-consent-analytics]");
  const newsletterInput = document.querySelector("[data-consent-newsletter]");
  const commentsInput = document.querySelector("[data-consent-comments]");

  const syncInputs = () => {
    analyticsInput.checked = prefs.analytics;
    newsletterInput.checked = prefs.newsletter;
    commentsInput.checked = prefs.comments;
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("cookie-modal-open");
  };

  const openModal = () => {
    syncInputs();
    modal.hidden = false;
    document.body.classList.add("cookie-modal-open");
    requestAnimationFrame(() => newsletterInput.focus());
  };

  const finish = (next) => {
    const revoked = store(next);
    banner.hidden = true;
    closeModal();
    if (revoked) window.location.reload();
  };

  document.querySelector("[data-consent-accept]")?.addEventListener("click", () => {
    finish({ analytics: true, newsletter: true, comments: true });
  });

  document.querySelector("[data-consent-reject]")?.addEventListener("click", () => {
    finish({ analytics: false, newsletter: false, comments: false });
  });

  document.querySelector("[data-consent-manage]")?.addEventListener("click", openModal);

  document.querySelector("[data-consent-save]")?.addEventListener("click", () => {
    finish({
      analytics: analyticsInput.checked,
      newsletter: newsletterInput.checked,
      comments: commentsInput.checked
    });
  });

  document.querySelector("[data-consent-reject-modal]")?.addEventListener("click", () => {
    finish({ analytics: false, newsletter: false, comments: false });
  });

  document.querySelectorAll("[data-cookie-close]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  document.querySelectorAll("[data-cookie-settings]").forEach((button) => {
    button.addEventListener("click", openModal);
  });

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-cookie-settings]");
    if (trigger) {
      event.preventDefault();
      openModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  window.RIZWAN_CONSENT = {
    get: () => ({ ...prefs }),
    allows: (category) => Boolean(prefs.decided && prefs[category]),
    openPreferences: openModal
  };

  if (!prefs.decided) banner.hidden = false;
  emit();
})();
