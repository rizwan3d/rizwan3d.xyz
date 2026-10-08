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

  document.querySelectorAll("[data-blog-filter-list]").forEach((list) => {
    const limit = Number(list.dataset.blogFilterLimit || 8);
    const items = Array.from(list.querySelectorAll("a"));
    if (!Number.isFinite(limit) || limit < 1 || items.length <= limit) return;

    const activeItem = items.find((item) => item.getAttribute("aria-current") === "page");
    const hiddenCount = items.filter((item, index) => index >= limit && item !== activeItem).length;
    if (hiddenCount < 1) return;

    const updateItems = (expanded) => {
      items.forEach((item, index) => {
        const shouldHide = !expanded && index >= limit && item !== activeItem;
        item.classList.toggle("is-filter-hidden", shouldHide);
      });
    };

    const button = document.createElement("button");
    button.className = "blog-filter-more";
    button.type = "button";
    button.setAttribute("aria-expanded", "false");

    const setButtonLabel = (expanded) => {
      button.textContent = expanded ? "Show less" : `Show ${hiddenCount} more`;
    };

    updateItems(false);
    setButtonLabel(false);

    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      updateItems(expanded);
      setButtonLabel(expanded);
    });

    list.append(button);
  });

  const progressBar = document.querySelector("[data-reading-progress]");
  if (progressBar) {
    let ticking = false;
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      progressBar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
      ticking = false;
    };
    const requestProgressUpdate = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    };
    window.addEventListener("scroll", requestProgressUpdate, { passive: true });
    window.addEventListener("resize", requestProgressUpdate);
    updateProgress();
  }

  const tocLinks = Array.from(document.querySelectorAll("[data-toc-link]"));
  if (tocLinks.length) {
    const toc = tocLinks[0].closest(".article-toc");
    const article = document.querySelector(".article-content");
    const layout = document.querySelector(".article-layout");
    const tocById = new Map(tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]));
    const headings = Array.from(tocById.keys())
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const updateTocStop = () => {
      if (!toc || !article || !layout || window.matchMedia("(max-width: 1249px)").matches) {
        toc?.removeAttribute("style");
        return;
      }

      const fixedTop = 300;
      const fixedLeft = Math.max(24, window.innerWidth * 0.5 - 646);
      const articleBottom = article.getBoundingClientRect().bottom + window.scrollY;
      const layoutLeft = layout.getBoundingClientRect().left + window.scrollX;
      const tocHeight = toc.offsetHeight;
      const shouldStop = window.scrollY + fixedTop + tocHeight >= articleBottom;

      if (shouldStop) {
        toc.style.position = "absolute";
        toc.style.top = `${articleBottom - (layout.getBoundingClientRect().top + window.scrollY) - tocHeight}px`;
        toc.style.left = `${fixedLeft - layoutLeft}px`;
      } else {
        toc.removeAttribute("style");
      }
    };

    let tocStopTicking = false;
    const requestTocStopUpdate = () => {
      if (tocStopTicking) return;
      tocStopTicking = true;
      requestAnimationFrame(() => {
        updateTocStop();
        tocStopTicking = false;
      });
    };

    window.addEventListener("scroll", requestTocStopUpdate, { passive: true });
    window.addEventListener("resize", requestTocStopUpdate);
    updateTocStop();

    if ("IntersectionObserver" in window && headings.length) {
      const setActiveTocLink = (id) => {
        tocLinks.forEach((link) => link.classList.toggle("is-active", link === tocById.get(id)));
      };

      const observer = new IntersectionObserver((entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible?.target?.id) setActiveTocLink(visible.target.id);
      }, { rootMargin: "-20% 0px -65% 0px", threshold: 0 });

      headings.forEach((heading) => observer.observe(heading));
      setActiveTocLink(headings[0].id);
    }
  }

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

  document.querySelectorAll("[data-share-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const label = button.querySelector("[data-share-label]");
      const url = new URL(button.dataset.shareUrl || window.location.href, window.location.origin).href;
      try {
        await navigator.clipboard.writeText(url);
        if (label) label.textContent = "Copied";
        setTimeout(() => { if (label) label.textContent = "Copy link"; }, 1400);
      } catch {
        if (label) label.textContent = "Copy failed";
        setTimeout(() => { if (label) label.textContent = "Copy link"; }, 1400);
      }
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
