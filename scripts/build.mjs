import { cp, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const srcDir = path.join(root, "src");
const writingDir = path.join(root, "writing");
const templatesDir = path.join(root, "templates");
const distDir = path.join(root, "dist");
const configPath = path.join(root, "config", "site.json");

const config = JSON.parse(await readFile(configPath, "utf8"));
const siteUrl = String(config.siteUrl || "").replace(/\/$/, "");
let basePath = String(config.basePath || "/");
if (!basePath.startsWith("/")) basePath = `/${basePath}`;
if (!basePath.endsWith("/")) basePath += "/";

const contactEmail = String(config.contactEmail || "hello@example.com");
const siteName = String(config.siteName || "Rizwan3d");
const ownerName = String(config.ownerName || "Muhammad Rizwan");
const githubUrl = String(config.githubUrl || "https://github.com/");
const mediumUrl = String(config.mediumUrl || "https://medium.com/");
const hackerNoonUrl = String(config.hackerNoonUrl || "https://hackernoon.com/");
const resumeUrl = String(config.resumeUrl || siteUrl);

const blogConfig = config.blog || {};
const blogPageSize = Math.max(1, Number(blogConfig.pageSize || 8));
const latestOnHome = Math.max(1, Number(blogConfig.latestOnHome || 4));

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(srcDir, distDir, { recursive: true });

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else files.push(full);
  }
  return files;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}

function parseScalar(raw = "") {
  const value = raw.trim();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "null") return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    const inner = value.slice(1, -1);
    return inner.replace(/\\"/g, '"').replace(/\\'/g, "'");
  }
  return value;
}

function parseFrontMatter(source, filename) {
  const normalized = source.replace(/\r\n?/g, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${filename}: expected YAML-style front matter beginning with ---`);
  }

  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`${filename}: front matter is missing its closing ---`);
  }

  const rawMeta = normalized.slice(4, end);
  const body = normalized.slice(end + 5).trim();
  const meta = {};

  for (const line of rawMeta.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) throw new Error(`${filename}: invalid front matter line: ${line}`);
    meta[match[1]] = parseScalar(match[2]);
  }

  return { meta, body };
}

function validateDate(value, field, filename) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    throw new Error(`${filename}: ${field} must use YYYY-MM-DD`);
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${filename}: ${field} is not a valid date`);
  }
  return date;
}

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inlineMarkdown(value = "") {
  const codeSpans = [];
  let text = String(value).replace(/`([^`]+)`/g, (_, code) => {
    const token = `@@INLINE_CODE_${codeSpans.length}@@`;
    codeSpans.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = escapeHtml(text);

  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, href, title) => {
    const safeHref = /^(https?:\/\/|mailto:|\/|#)/i.test(href) ? href : "#";
    const external = /^https?:\/\//i.test(safeHref);
    const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
    return `<a class="inline-link" href="${escapeAttr(safeHref)}"${titleAttr}${attrs}>${label}</a>`;
  });

  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  codeSpans.forEach((html, index) => {
    text = text.replace(`@@INLINE_CODE_${index}@@`, html);
  });

  return text;
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^```/.test(line)) {
      flushParagraph();
      closeList();

      const language = line.slice(3).trim().toLowerCase();
      const codeLines = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }

      const langClass = language ? ` class="language-${escapeAttr(language)}"` : "";
      const label = language ? escapeHtml(language) : "code";
      out.push(
        `<div class="code-card"><div class="code-toolbar"><span>${label}</span></div>` +
        `<pre><code${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre></div>`
      );
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      flushParagraph();
      closeList();
      out.push("<hr>");
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      flushParagraph();
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      flushParagraph();
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(`<blockquote><p>${inlineMarkdown(quote[1])}</p></blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  closeList();

  // Wrap sections beginning at each h2 for the existing article spacing.
  const html = out.join("\n");
  const parts = html.split(/(?=<h2>)/g);
  if (parts.length <= 1) return html;

  return parts.map((part, index) => {
    if (index === 0 && !part.startsWith("<h2>")) return part;
    return `<section class="article-section">${part}</section>`;
  }).join("\n");
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function isoDate(value) {
  return `${String(value).slice(0, 10)}T00:00:00.000Z`;
}

function sourceClass(source) {
  return String(source || "article").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function replaceSiteTokens(text) {
  return text
    .replaceAll("{{SITE_URL}}", siteUrl)
    .replaceAll("{{BASE_PATH}}", basePath)
    .replaceAll("{{CONTACT_EMAIL}}", contactEmail)
    .replaceAll("{{SITE_NAME}}", siteName)
    .replaceAll("{{OWNER_NAME}}", ownerName)
    .replaceAll("{{GITHUB_URL}}", githubUrl)
    .replaceAll("{{MEDIUM_URL}}", mediumUrl)
    .replaceAll("{{HACKERNOON_URL}}", hackerNoonUrl)
    .replaceAll("{{RESUME_URL}}", resumeUrl);
}


const SUPPORTED_IMAGE_EXTENSIONS = new Set([".avif", ".gif", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);

function isHttpsUrl(value = "") {
  return /^https:\/\//i.test(String(value).trim());
}

function safeCreditUrl(value = "") {
  const url = String(value || "").trim();
  return !url || isHttpsUrl(url) ? url : "";
}

function safeImageFileName(sourceImage) {
  const ext = path.extname(sourceImage).toLowerCase();
  if (!SUPPORTED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error(`featuredImage must use one of: ${[...SUPPORTED_IMAGE_EXTENSIONS].join(", ")}`);
  }

  const stem = path.basename(sourceImage, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "featured";

  return `${stem}${ext}`;
}

async function resolveFeaturedImage(post) {
  const raw = String(post.featuredImage || "").trim();
  if (!raw) return null;

  const alt = String(post.featuredImageAlt || post.title || "").trim();
  const credit = String(post.featuredImageCredit || "").trim();
  const creditUrl = safeCreditUrl(post.featuredImageCreditUrl);

  // Remote images are allowed over HTTPS, including images.unsplash.com URLs.
  if (isHttpsUrl(raw)) {
    return {
      publicUrl: raw,
      absoluteUrl: raw,
      alt,
      credit,
      creditUrl
    };
  }

  // Root-relative image already living under src/, for example /assets/images/cover.webp.
  if (raw.startsWith("/")) {
    const publicUrl = `${basePath}${raw.replace(/^\/+/, "")}`;
    return {
      publicUrl,
      absoluteUrl: `${siteUrl}${publicUrl.startsWith("/") ? "" : "/"}${publicUrl}`,
      alt,
      credit,
      creditUrl
    };
  }

  // Relative local image beside the Markdown file.
  const sourceImage = path.resolve(path.dirname(post.sourceFilePath), raw);
  const writingRoot = path.resolve(writingDir);
  const relativeToWriting = path.relative(writingRoot, sourceImage);
  if (relativeToWriting.startsWith("..") || path.isAbsolute(relativeToWriting)) {
    throw new Error(`${post.sourceFile}: featuredImage must stay inside writing/ when using a relative path`);
  }

  const fileName = safeImageFileName(sourceImage);
  const outputDir = path.join(distDir, "assets", "images", "posts", post.slug);
  const outputFile = path.join(outputDir, fileName);
  await mkdir(outputDir, { recursive: true });

  try {
    await copyFile(sourceImage, outputFile);
  } catch {
    throw new Error(`${post.sourceFile}: featuredImage not found: ${raw}`);
  }

  const publicUrl = `${basePath}assets/images/posts/${post.slug}/${fileName}`;
  return {
    publicUrl,
    absoluteUrl: `${siteUrl}${publicUrl.startsWith("/") ? "" : "/"}${publicUrl}`,
    alt,
    credit,
    creditUrl
  };
}

function featuredImageHtml(image) {
  if (!image?.publicUrl) return "";

  const creditHtml = image.credit
    ? `<figcaption>${image.creditUrl
        ? `<a href="${escapeAttr(image.creditUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(image.credit)}</a>`
        : escapeHtml(image.credit)}</figcaption>`
    : "";

  return `<figure class="article-featured-image">
    <img src="${escapeAttr(image.publicUrl)}" alt="${escapeAttr(image.alt)}" loading="eager" decoding="async">
    ${creditHtml}
  </figure>`;
}

async function loadWritingPosts() {
  let files = [];
  try {
    files = (await walk(writingDir)).filter((file) => file.toLowerCase().endsWith(".md"));
  } catch {
    throw new Error("writing/ folder is missing");
  }

  const posts = [];

  for (const file of files) {
    const rel = path.relative(writingDir, file).split(path.sep).join("/");
    const source = await readFile(file, "utf8");
    const { meta, body } = parseFrontMatter(source, rel);

    for (const required of ["title", "created", "updated", "category", "description"]) {
      if (!String(meta[required] ?? "").trim()) {
        throw new Error(`${rel}: missing required front matter field "${required}"`);
      }
    }

    const createdDate = validateDate(meta.created, "created", rel);
    const updatedDate = validateDate(meta.updated, "updated", rel);

    if (updatedDate.getTime() < createdDate.getTime()) {
      throw new Error(`${rel}: updated date cannot be earlier than created date`);
    }

    const expectedPrefix = `${meta.created.slice(0, 4)}/${meta.created.slice(5, 7)}/${meta.created.slice(8, 10)}/`;
    if (!rel.startsWith(expectedPrefix)) {
      throw new Error(`${rel}: move this file under writing/${expectedPrefix} so the folder matches its created date`);
    }

    const slug = slugify(meta.slug || path.basename(file, ".md") || meta.title);
    if (!slug) throw new Error(`${rel}: could not determine a slug`);

    posts.push({
      title: String(meta.title),
      slug,
      createdAt: String(meta.created),
      updatedAt: String(meta.updated),
      category: String(meta.category),
      description: String(meta.description),
      sourceUrl: meta.sourceUrl ? String(meta.sourceUrl) : (meta.projectUrl ? String(meta.projectUrl) : ""),
      featuredImage: meta.featuredImage ? String(meta.featuredImage) : "",
      featuredImageAlt: meta.featuredImageAlt ? String(meta.featuredImageAlt) : "",
      featuredImageCredit: meta.featuredImageCredit ? String(meta.featuredImageCredit) : "",
      featuredImageCreditUrl: meta.featuredImageCreditUrl ? String(meta.featuredImageCreditUrl) : "",
      featured: meta.featured !== false,
      draft: meta.draft === true,
      bodyMarkdown: body,
      sourceFile: rel,
      sourceFilePath: file
    });
  }

  const published = posts.filter((post) => !post.draft);

  const seen = new Set();
  for (const post of published) {
    if (seen.has(post.slug)) throw new Error(`duplicate post slug: ${post.slug}`);
    seen.add(post.slug);
  }

  return published.sort((a, b) => {
    const createdDiff = b.createdAt.localeCompare(a.createdAt);
    if (createdDiff !== 0) return createdDiff;
    const updatedDiff = b.updatedAt.localeCompare(a.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return a.title.localeCompare(b.title);
  });
}

function blogCardHtml(post) {
  const updated = post.updatedAt && post.updatedAt !== post.createdAt
    ? `<span class="blog-updated">Updated ${escapeHtml(formatDate(post.updatedAt))}</span>`
    : "";

  const imageHtml = post.featuredImage
    ? `<a class="blog-card-image" href="${escapeAttr(post.url)}"><img src="${escapeAttr(post.featuredImage)}" alt="${escapeAttr(post.featuredImageAlt || post.title)}" loading="lazy" decoding="async"></a>`
    : "";

  return `<article class="blog-card">
    ${imageHtml}
    <div class="blog-card-meta">
      <span class="blog-source blog-source-${escapeHtml(sourceClass(post.source))}">${escapeHtml(post.source)}</span>
      <time datetime="${escapeAttr(post.createdAt)}">Created ${escapeHtml(formatDate(post.createdAt))}</time>
      ${updated}
    </div>
    <a class="blog-card-title" href="${escapeAttr(post.url)}">${escapeHtml(post.title)}</a>
    <p>${escapeHtml(post.description)}</p>
    <span class="blog-card-action">Read article →</span>
  </article>`;
}

function homePostHtml(post) {
  const imageHtml = post.image?.publicUrl
    ? `<a class="post-image" href="${escapeAttr(post.url)}"><img src="${escapeAttr(post.image.publicUrl)}" alt="${escapeAttr(post.image.alt || post.title)}" loading="lazy" decoding="async"></a>`
    : "";

  return `<article class="post">
    <div class="post-date">${escapeHtml(formatDate(post.createdAt).toUpperCase())}</div>
    <div class="post-info">
      ${imageHtml}
      <span class="category">${escapeHtml(post.category.toUpperCase())}</span>
      <a class="post-title" href="${escapeAttr(post.url)}">${escapeHtml(post.title)}</a>
      <p>${escapeHtml(post.description)}</p>
    </div>
  </article>`;
}

const writingPosts = await loadWritingPosts();
const postTemplate = await readFile(path.join(templatesDir, "post.html"), "utf8");
const generatedPostsDir = path.join(distDir, "posts");
await mkdir(generatedPostsDir, { recursive: true });

for (const post of writingPosts) {
  post.image = await resolveFeaturedImage(post);
  const bodyHtml = markdownToHtml(post.bodyMarkdown);
  const updatedMeta = post.updatedAt !== post.createdAt
    ? `<span class="article-updated">Updated <time datetime="${escapeAttr(post.updatedAt)}">${escapeHtml(formatDate(post.updatedAt))}</time></span>`
    : "";

  const sourceHtml = post.sourceUrl
    ? `<p class="article-source-note">Source: <a class="inline-link" href="${escapeAttr(post.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.sourceUrl.replace(/^https?:\/\//, ""))}</a></p>`
    : "";

  let html = postTemplate
    .replaceAll("{{POST_TITLE}}", escapeHtml(post.title))
    .replaceAll("{{POST_TITLE_ATTR}}", escapeAttr(post.title))
    .replaceAll("{{POST_DESCRIPTION}}", escapeHtml(post.description))
    .replaceAll("{{POST_DESCRIPTION_ATTR}}", escapeAttr(post.description))
    .replaceAll("{{POST_CATEGORY_ATTR}}", escapeAttr(post.category))
    .replaceAll("{{POST_CREATED_DATE}}", escapeAttr(post.createdAt))
    .replaceAll("{{POST_CREATED_ISO}}", escapeAttr(isoDate(post.createdAt)))
    .replaceAll("{{POST_UPDATED_ISO}}", escapeAttr(isoDate(post.updatedAt)))
    .replaceAll("{{POST_CREATED_HUMAN}}", escapeHtml(formatDate(post.createdAt)))
    .replaceAll("{{POST_UPDATED_META}}", updatedMeta)
    .replaceAll("{{POST_OG_IMAGE}}", post.image?.absoluteUrl
      ? `<meta property="og:image" content="${escapeAttr(post.image.absoluteUrl)}">` +
        (post.image.alt ? `\n  <meta property="og:image:alt" content="${escapeAttr(post.image.alt)}">` : "")
      : "")
    .replaceAll("{{POST_FEATURED_IMAGE}}", featuredImageHtml(post.image))
    .replaceAll("{{POST_BODY}}", bodyHtml)
    .replaceAll("{{POST_PROJECT_SOURCE}}", sourceHtml)
    .replaceAll("{{POST_CANONICAL}}", `${siteUrl}/posts/${post.slug}.html`);

  html = replaceSiteTokens(html);
  await writeFile(path.join(generatedPostsDir, `${post.slug}.html`), html, "utf8");
}

const allBlogPosts = writingPosts.map((post) => ({
  title: post.title,
  url: `${basePath}posts/${post.slug}.html`,
  source: "Rizwan3d",
  description: post.description,
  category: post.category,
  createdAt: post.createdAt,
  updatedAt: post.updatedAt,
  featuredImage: post.image?.publicUrl || "",
  featuredImageAlt: post.image?.alt || "",
  publishedAt: isoDate(post.createdAt),
  external: false
}));

const totalPages = Math.max(1, Math.ceil(allBlogPosts.length / blogPageSize));
const blogDataDir = path.join(distDir, "assets", "data", "blog");
await mkdir(blogDataDir, { recursive: true });

for (let page = 1; page <= totalPages; page += 1) {
  const start = (page - 1) * blogPageSize;
  const chunk = allBlogPosts.slice(start, start + blogPageSize);
  await writeFile(
    path.join(blogDataDir, `page-${page}.json`),
    `${JSON.stringify(chunk)}\n`,
    "utf8"
  );
}

await writeFile(
  path.join(blogDataDir, "all.json"),
  `${JSON.stringify(allBlogPosts)}\n`,
  "utf8"
);

const blogPagePath = path.join(distDir, "blog", "index.html");
let blogPage = await readFile(blogPagePath, "utf8");
blogPage = blogPage
  .replace("<!-- BLOG_INITIAL_ITEMS -->", allBlogPosts.slice(0, blogPageSize).map(blogCardHtml).join("\n"))
  .replaceAll("{{BLOG_TOTAL}}", String(allBlogPosts.length))
  .replaceAll("{{BLOG_TOTAL_PAGES}}", String(totalPages))
  .replaceAll("{{BLOG_PAGE_SIZE}}", String(blogPageSize));
await writeFile(blogPagePath, blogPage, "utf8");

const homePath = path.join(distDir, "index.html");
let home = await readFile(homePath, "utf8");
const homePosts = writingPosts.filter((post) => post.featured).slice(0, latestOnHome);
home = home.replace("<!-- HOME_POST_ITEMS -->", homePosts.map((post) => homePostHtml({
  ...post,
  url: `${basePath}posts/${post.slug}.html`
})).join("\n"));
await writeFile(homePath, home, "utf8");

const fallback = writingPosts.map((post) => ({
  title: post.title,
  category: post.category,
  description: post.description,
  url: `${basePath}posts/${post.slug}.html`,
  text: `${post.title} ${post.category} ${post.description} ${post.bodyMarkdown}`
    .replace(/[`*_>#\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}));
fallback.push({
  title: "Blog",
  category: "Archive",
  description: "All articles published on Rizwan3d.",
  url: `${basePath}blog/`,
  text: "blog writing technical articles ai agents risc-v developer tools software engineering"
});
await writeFile(path.join(distDir, "search-fallback.json"), `${JSON.stringify(fallback)}\n`, "utf8");

const files = await walk(distDir);
const textExtensions = new Set([".html", ".css", ".js", ".json", ".xml", ".txt", ".webmanifest"]);

for (const file of files) {
  if (!textExtensions.has(path.extname(file))) continue;
  let text = await readFile(file, "utf8");
  text = replaceSiteTokens(text);
  await writeFile(file, text);
}

const publicConfig = {
  giscus: config.giscus || {},
  kit: config.kit || {},
  matomo: config.matomo || {}
};
await writeFile(
  path.join(distDir, "assets", "js", "site-config.js"),
  `window.BLOGIN_CONFIG=${JSON.stringify(publicConfig)};\n`,
  "utf8"
);

const htmlFiles = (await walk(distDir))
  .filter((file) => file.endsWith(".html"))
  .filter((file) => path.basename(file) !== "404.html");

const urls = htmlFiles.map((file) => {
  let rel = path.relative(distDir, file).split(path.sep).join("/");
  rel = rel === "index.html" ? "" : rel.replace(/index\.html$/, "");
  return `${siteUrl}/${rel}`.replace(/([^:]\/)\/+/, "$1");
});

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n") +
  `\n</urlset>\n`;
await writeFile(path.join(distDir, "sitemap.xml"), sitemap, "utf8");

const robots = `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
await writeFile(path.join(distDir, "robots.txt"), robots, "utf8");

if (siteUrl === "https://example.com") {
  console.warn("\n[rizwan3d] Edit config/site.json before production: siteUrl is still https://example.com\n");
}

console.log(`[rizwan3d] Markdown posts: ${writingPosts.length}`);
console.log(`[rizwan3d] Blog archive: ${allBlogPosts.length} item(s), ${totalPages} page chunk(s)`);
console.log(`[rizwan3d] Static files prepared in ${distDir}`);
