(() => {
  const list = document.querySelector("[data-blog-list]");
  const sentinel = document.querySelector("[data-blog-sentinel]");
  const status = document.querySelector("[data-blog-status]");
  if (!list || !sentinel || !status) return;

  const basePath = document.documentElement.dataset.basePath || "/";
  const totalPages = Number(list.dataset.blogTotalPages || 1);
  let nextPage = 2;
  let loading = false;
  let finished = totalPages <= 1;

  const formatDate = (value) => {
    if (!value) return "Archive";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Archive";
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(date);
  };

  const makeCard = (post) => {
    const article = document.createElement("article");
    article.className = "blog-card";

    if (post.featuredImage) {
      const imageLink = document.createElement("a");
      imageLink.className = "blog-card-image";
      imageLink.href = post.url;

      const image = document.createElement("img");
      image.src = post.featuredImage;
      image.alt = post.featuredImageAlt || post.title;
      image.loading = "lazy";
      image.decoding = "async";

      imageLink.append(image);
      article.append(imageLink);
    }

    const meta = document.createElement("div");
    meta.className = "blog-card-meta";

    const source = document.createElement("span");
    source.className = `blog-source blog-source-${String(post.source || "article").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    source.textContent = post.source || "Article";

    const date = document.createElement("time");
    if (post.createdAt || post.publishedAt) date.dateTime = post.createdAt || post.publishedAt;
    date.textContent = `Created ${formatDate(post.createdAt || post.publishedAt)}`;

    meta.append(source, date);

    if (post.updatedAt && post.updatedAt !== post.createdAt) {
      const updated = document.createElement("span");
      updated.className = "blog-updated";
      updated.textContent = `Updated ${formatDate(post.updatedAt)}`;
      meta.append(updated);
    }

    const title = document.createElement("a");
    title.className = "blog-card-title";
    title.href = post.url;
    title.textContent = post.title;

    if (post.external) {
      title.target = "_blank";
      title.rel = "noopener noreferrer";
    }

    const description = document.createElement("p");
    description.textContent = post.description || "";

    const action = document.createElement("span");
    action.className = "blog-card-action";
    action.textContent = post.external ? "Read on publisher ↗" : "Read article →";

    article.append(meta, title, description, action);
    return article;
  };

  const markFinished = () => {
    finished = true;
    status.textContent = "You’ve reached the end.";
    sentinel.classList.add("is-finished");
  };

  const loadNext = async () => {
    if (loading || finished) return;
    if (nextPage > totalPages) {
      markFinished();
      return;
    }

    loading = true;
    status.textContent = "Loading more…";

    try {
      const response = await fetch(`${basePath}assets/data/blog/page-${nextPage}.json`, {
        cache: "force-cache"
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const posts = await response.json();
      const fragment = document.createDocumentFragment();

      for (const post of posts) fragment.append(makeCard(post));
      list.append(fragment);

      nextPage += 1;

      if (nextPage > totalPages || posts.length === 0) {
        markFinished();
      } else {
        status.textContent = "Scroll to load more";
      }
    } catch {
      status.textContent = "Couldn’t load more articles. Scroll or refresh to try again.";
    } finally {
      loading = false;
    }
  };

  if (finished) {
    markFinished();
    return;
  }

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadNext();
    }, { rootMargin: "700px 0px" });

    observer.observe(sentinel);
  } else {
    const onScroll = () => {
      if (sentinel.getBoundingClientRect().top < window.innerHeight + 700) loadNext();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }
})();
