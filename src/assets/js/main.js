(() => {
  const basePath = document.documentElement.dataset.basePath || "/";
  const modal = document.querySelector("[data-search-modal]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const helper = document.querySelector("[data-search-helper]");
  let pagefindPromise;

  const loadPagefind = async () => {
    if (!pagefindPromise) {
      pagefindPromise = import(`${basePath}pagefind/pagefind.js`).then(async (pagefind) => {
        await pagefind.options({ baseUrl: basePath });
        await pagefind.init();
        return pagefind;
      });
    }
    return pagefindPromise;
  };

  const openSearch = () => {
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("search-open");
    requestAnimationFrame(() => input?.focus());
    loadPagefind().catch(() => {});
  };

  const closeSearch = () => {
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("search-open");
    if (input) input.value = "";
    if (results) results.replaceChildren();
    if (helper) helper.textContent = "Start typing to search articles.";
  };

  const renderResults = async (query) => {
    const term = query.trim();
    if (!results || !helper) return;
    if (!term) {
      results.replaceChildren();
      helper.textContent = "Start typing to search articles.";
      return;
    }

    helper.textContent = "Searching…";
    try {
      const pagefind = await loadPagefind();
      const search = await pagefind.debouncedSearch(term, {}, 180);
      if (search === null) return;
      const items = await Promise.all(search.results.slice(0, 8).map((result) => result.data()));
      results.replaceChildren();
      helper.textContent = items.length ? `${items.length} ${items.length === 1 ? "article" : "articles"} found` : "No articles found.";

      for (const item of items) {
        const link = document.createElement("a");
        link.className = "search-result-item";
        link.href = item.url;

        const category = document.createElement("span");
        category.className = "search-result-category";
        category.textContent = item.meta?.category || "Article";

        const title = document.createElement("strong");
        title.textContent = item.meta?.title || "Untitled";

        const snippet = document.createElement("span");
        snippet.className = "search-result-snippet";
        snippet.innerHTML = item.excerpt || "";

        link.append(category, title, snippet);
        results.append(link);
      }
    } catch (error) {
      try {
        const response = await fetch(`${basePath}search-fallback.json`);
        const fallback = await response.json();
        const words = term.toLowerCase().split(/\s+/).filter(Boolean);
        const items = fallback.filter((item) => {
          const haystack = `${item.title} ${item.category} ${item.description} ${item.text}`.toLowerCase();
          return words.every((word) => haystack.includes(word));
        }).slice(0, 8);
        results.replaceChildren();
        helper.textContent = items.length ? `${items.length} ${items.length === 1 ? "article" : "articles"} found` : "No articles found.";
        for (const item of items) {
          const link = document.createElement("a");
          link.className = "search-result-item";
          link.href = item.url;
          const category = document.createElement("span");
          category.className = "search-result-category";
          category.textContent = item.category;
          const title = document.createElement("strong");
          title.textContent = item.title;
          const snippet = document.createElement("span");
          snippet.className = "search-result-snippet";
          snippet.textContent = item.description;
          link.append(category, title, snippet);
          results.append(link);
        }
      } catch {
        results.replaceChildren();
        helper.textContent = "Search is temporarily unavailable.";
      }
    }
  };

  document.querySelectorAll("[data-search-open]").forEach((button) => button.addEventListener("click", openSearch));
  document.querySelectorAll("[data-search-close]").forEach((button) => button.addEventListener("click", closeSearch));
  input?.addEventListener("input", (event) => renderResults(event.target.value));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && modal?.classList.contains("is-open")) closeSearch();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });

  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = document.querySelector(button.dataset.copyTarget);
      if (!target) return;
      try {
        await navigator.clipboard.writeText(target.innerText);
        const label = button.querySelector("[data-copy-label]");
        if (label) label.textContent = "Copied";
        setTimeout(() => { if (label) label.textContent = "Copy"; }, 1400);
      } catch {}
    });
  });

  const contactForm = document.querySelector("[data-contact-form]");
  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(contactForm);
    const email = contactForm.dataset.email;
    const subject = encodeURIComponent(data.get("subject") || "Rizwan3d contact");
    const body = encodeURIComponent(`Name: ${data.get("name")}\nEmail: ${data.get("email")}\n\n${data.get("message")}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    const status = document.querySelector("[data-form-status]");
    if (status) status.textContent = "Opening your email app…";
  });
})();
