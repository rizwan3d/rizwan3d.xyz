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
const seoConfig = config.seo || {};
const siteLanguage = String(seoConfig.language || "en-US");
const googleSiteVerification = String(seoConfig.googleSiteVerification || "").trim();
const bingSiteVerification = String(seoConfig.bingSiteVerification || "").trim();
const allowAiSearch = seoConfig.allowAiSearch !== false;
const allowAiTraining = seoConfig.allowAiTraining === true;

const blogConfig = config.blog || {};
const blogPageSize = Math.max(1, Number(blogConfig.pageSize || 8));
const latestOnHome = Math.max(1, Number(blogConfig.latestOnHome || 4));
const inArticleAdConfig = blogConfig.inArticleAd || {};
const inArticleAdEnabled = inArticleAdConfig.enabled === true;
const inArticleAdProvider = String(inArticleAdConfig.provider || "custom").trim().toLowerCase();
const inArticleAdMinParagraphsBefore = Math.max(1, Number(inArticleAdConfig.minParagraphsBefore || 3));

const linkPreviewConfig = config.linkPreviews || {};
const linkPreviewsEnabled = linkPreviewConfig.enabled !== false;
const linkPreviewTimeoutMs = Math.max(1000, Number(linkPreviewConfig.timeoutMs || 8000));
const linkPreviewMaxBytes = Math.max(65536, Number(linkPreviewConfig.maxBytes || 1500000));
const outboundRef = "rizwan3d.xyz";

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

function safeMarkdownHref(value = "") {
  const raw = String(value || "").trim();
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(raw)) return raw;
  return "#";
}

function withOutboundRef(value = "") {
  const raw = String(value || "").trim();
  if (!/^https?:\/\//i.test(raw)) return raw;

  try {
    const parsed = new URL(raw);
    parsed.searchParams.set("ref", outboundRef);
    return parsed.href;
  } catch {
    return raw;
  }
}

function safeMarkdownImageSrc(value = "") {
  const raw = String(value || "").trim();
  if (/^https:\/\//i.test(raw) || raw.startsWith("/")) return raw;
  return "";
}

function inlineMarkdown(value = "", context = {}) {
  const placeholders = [];
  const token = (html) => {
    const index = placeholders.push(html) - 1;
    return `\uE100${index}\uE101`;
  };

  let text = String(value || "");

  // Inline code first so Markdown punctuation inside code is never re-parsed.
  text = text.replace(/`([^`\n]+)`/g, (_, code) =>
    token(`<code>${escapeHtml(code)}</code>`)
  );

  // Standard Markdown images.
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, alt, src, title) => {
      const safeSrc = safeMarkdownImageSrc(src);
      if (!safeSrc) return escapeHtml(_);
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      return token(
        `<img class="markdown-image" src="${escapeAttr(safeSrc)}" alt="${escapeAttr(alt)}"${titleAttr} loading="lazy" decoding="async">`
      );
    }
  );

  // Standard Markdown links.
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g,
    (_, label, href, title) => {
      const safeHref = safeMarkdownHref(href);
      const external = /^https?:\/\//i.test(safeHref);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      const renderedHref = external ? withOutboundRef(safeHref) : safeHref;
      const labelHtml = escapeHtml(label)
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/~~([^~]+)~~/g, "<del>$1</del>");
      return token(
        `<a class="inline-link" href="${escapeAttr(renderedHref)}"${titleAttr}${attrs}>${labelHtml}</a>`
      );
    }
  );

  // Footnote references.
  text = text.replace(/\[\^([^\]]+)\]/g, (_, rawId) => {
    if (!context.footnotes?.has(rawId)) return escapeHtml(_);

    if (!context.footnoteNumbers.has(rawId)) {
      context.footnoteNumbers.set(rawId, context.footnoteOrder.length + 1);
      context.footnoteOrder.push(rawId);
    }

    const number = context.footnoteNumbers.get(rawId);
    const count = (context.footnoteRefCounts.get(rawId) || 0) + 1;
    context.footnoteRefCounts.set(rawId, count);

    const id = slugify(rawId) || `note-${number}`;
    return token(
      `<sup class="footnote-ref" id="fnref-${id}-${count}"><a href="#fn-${id}" aria-label="Footnote ${number}">${number}</a></sup>`
    );
  });

  // Bare URLs become links only when they are not already inside Markdown links/images/code.
  text = text.replace(
    /(^|[\s(])((?:https?:\/\/)[^\s<]+)/g,
    (_, prefix, rawUrl) => {
      let url = rawUrl;
      let suffix = "";

      while (/[.,!?;:]$/.test(url)) {
        suffix = url.slice(-1) + suffix;
        url = url.slice(0, -1);
      }

      // Avoid swallowing a prose closing parenthesis.
      const opens = (url.match(/\(/g) || []).length;
      const closes = (url.match(/\)/g) || []).length;
      if (closes > opens && url.endsWith(")")) {
        suffix = ")" + suffix;
        url = url.slice(0, -1);
      }

      const href = safeMarkdownHref(url);
      if (href === "#") return `${prefix}${rawUrl}`;

      return `${prefix}${token(
        `<a class="inline-link auto-link" href="${escapeAttr(withOutboundRef(href))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`
      )}${suffix}`;
    }
  );

  text = escapeHtml(text);

  text = text
    .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/(^|[^\*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|[^_])_([^_\n]+)_/g, "$1<em>$2</em>");

  placeholders.forEach((html, index) => {
    text = text.replace(`\uE100${index}\uE101`, html);
  });

  return text;
}

function safePreviewUrl(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw, siteUrl);
    if (parsed.protocol !== "https:") return "";

    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
      host === "::1" ||
      /^f[cd][0-9a-f]{2}:/i.test(host) ||
      /^fe8[0-9a-f]:/i.test(host)
    ) {
      return "";
    }

    return parsed.href;
  } catch {
    return "";
  }
}

function safePreviewImage(value = "", baseUrl = siteUrl) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  try {
    const resolved = new URL(raw, baseUrl);
    return resolved.protocol === "https:" ? resolved.href : "";
  } catch {
    return "";
  }
}

function youtubeVideoId(url = "") {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
      return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
    }

    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com") {
      return "";
    }

    const pathParts = parsed.pathname.split("/").filter(Boolean);
    const candidate =
      parsed.searchParams.get("v") ||
      (["embed", "shorts", "live"].includes(pathParts[0]) ? pathParts[1] : "");

    return /^[A-Za-z0-9_-]{11}$/.test(candidate || "") ? candidate : "";
  } catch {
    return "";
  }
}

function youtubeEmbedUrl(url = "") {
  const id = youtubeVideoId(url);
  if (!id) return "";

  const parsed = new URL(url);
  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  const start = parsed.searchParams.get("start") || parsed.searchParams.get("t");
  const playlist = parsed.searchParams.get("list");

  if (start) {
    const seconds = youtubeStartSeconds(start);
    if (seconds > 0) embed.searchParams.set("start", String(seconds));
  }

  if (playlist && /^[A-Za-z0-9_-]+$/.test(playlist)) {
    embed.searchParams.set("list", playlist);
  }

  return embed.href;
}

function youtubeStartSeconds(value = "") {
  const raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);

  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
  if (!match) return 0;

  return (
    Number(match[1] || 0) * 3600 +
    Number(match[2] || 0) * 60 +
    Number(match[3] || 0)
  );
}

function decodeHtmlEntities(value = "") {
  const named = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return String(value).replace(
    /&(#x?[0-9a-f]+|[a-z]+);/gi,
    (_, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const number = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(number) ? String.fromCodePoint(number) : _;
      }
      return named[entity.toLowerCase()] ?? _;
    }
  );
}

function stripPreviewHtml(value = "") {
  return decodeHtmlEntities(
    String(value)
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  ).replace(/\s+/g, " ").trim();
}

function parseTagAttributes(tag = "") {
  const attrs = {};
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;

  while ((match = pattern.exec(tag))) {
    attrs[match[1].toLowerCase()] = decodeHtmlEntities(
      match[2] ?? match[3] ?? match[4] ?? ""
    );
  }

  return attrs;
}

function extractPageMetadata(html, pageUrl) {
  const meta = new Map();

  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = parseTagAttributes(match[0]);
    const key = String(attrs.property || attrs.name || "").toLowerCase();
    const content = String(attrs.content || "").trim();
    if (key && content && !meta.has(key)) meta.set(key, content);
  }

  const titleMatch = String(html).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTitle = titleMatch ? stripPreviewHtml(titleMatch[1]) : "";

  const title = String(
    meta.get("og:title") ||
    meta.get("twitter:title") ||
    htmlTitle ||
    ""
  ).trim();

  const description = stripPreviewHtml(
    meta.get("og:description") ||
    meta.get("twitter:description") ||
    meta.get("description") ||
    ""
  );

  const rawImage =
    meta.get("og:image:secure_url") ||
    meta.get("og:image") ||
    meta.get("twitter:image") ||
    meta.get("twitter:image:src") ||
    "";

  const image = safePreviewImage(rawImage, pageUrl);
  const imageAlt = String(
    meta.get("og:image:alt") ||
    meta.get("twitter:image:alt") ||
    title ||
    ""
  ).trim();

  const site = String(
    meta.get("og:site_name") ||
    new URL(pageUrl).hostname.replace(/^www\./, "")
  ).trim();

  return {
    title,
    description,
    site,
    image,
    imageAlt
  };
}

async function readResponseTextLimited(response, maxBytes) {
  if (!response.body?.getReader) {
    const text = await response.text();
    return text.slice(0, maxBytes);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    total += value.byteLength;
    if (total > maxBytes) {
      const keep = Math.max(0, value.byteLength - (total - maxBytes));
      if (keep > 0) text += decoder.decode(value.slice(0, keep), { stream: true });
      await reader.cancel();
      break;
    }

    text += decoder.decode(value, { stream: true });
  }

  text += decoder.decode();
  return text;
}

const urlPreviewCache = new Map();

async function fetchUrlPreviewMetadata(url) {
  if (!linkPreviewsEnabled) {
    return { ok: false, url, reason: "disabled" };
  }

  if (urlPreviewCache.has(url)) return urlPreviewCache.get(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), linkPreviewTimeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": `Rizwan3dLinkPreview/1.0 (+${siteUrl})`,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error(`unsupported content type: ${contentType || "unknown"}`);
    }

    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (declaredLength > linkPreviewMaxBytes) {
      throw new Error(`page is larger than ${linkPreviewMaxBytes} bytes`);
    }

    const finalUrl = safePreviewUrl(response.url || url);
    if (!finalUrl) throw new Error("redirected to a disallowed URL");

    const html = await readResponseTextLimited(response, linkPreviewMaxBytes);
    const metadata = extractPageMetadata(html, finalUrl);

    if (!metadata.title && !metadata.description && !metadata.image) {
      throw new Error("no useful preview metadata found");
    }

    const result = {
      ok: true,
      url,
      finalUrl,
      ...metadata
    };
    urlPreviewCache.set(url, result);
    return result;
  } catch (error) {
    const result = {
      ok: false,
      url,
      reason: error?.name === "AbortError" ? "timeout" : String(error?.message || error)
    };
    urlPreviewCache.set(url, result);
    return result;
  } finally {
    clearTimeout(timer);
  }
}

function parseUrlPreviewData(lines, startIndex) {
  const data = {};
  let explicitUrl = "";
  let index = startIndex + 1;

  for (; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === ":::") break;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    // HackerNoon-like shorthand:
    // :::url-preview
    // https://example.com/page
    // :::
    if (/^https:\/\//i.test(trimmed)) {
      if (explicitUrl || data.url) {
        throw new Error("url-preview may contain only one URL");
      }
      explicitUrl = trimmed;
      continue;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!match) {
      throw new Error(`Invalid url-preview line: ${line}`);
    }

    const key = match[1];
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }

  if (index >= lines.length) {
    throw new Error("url-preview block is missing its closing :::");
  }

  const url = safePreviewUrl(data.url || explicitUrl);
  if (!url) {
    throw new Error("url-preview requires one explicit public HTTPS URL");
  }

  return { data, url, endIndex: index };
}

function collectUrlPreviewUrls(markdown) {
  const lines = String(markdown).replace(/\r\n?/g, "\n").split("\n");
  const urls = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].trim() !== ":::url-preview") continue;
    const block = parseUrlPreviewData(lines, i);
    urls.push(block.url);
    i = block.endIndex;
  }

  return urls;
}

async function prepareUrlPreviews(posts) {
  const urls = [...new Set(posts.flatMap((post) => collectUrlPreviewUrls(post.bodyMarkdown)))];

  for (const url of urls) {
    const result = await fetchUrlPreviewMetadata(url);
    if (result.ok) {
      console.log(`[rizwan3d] Link preview: ${new URL(url).hostname}`);
    } else {
      console.warn(`[rizwan3d] Link preview unavailable for ${url}; rendering a normal link. ${result.reason}`);
    }
  }
}

function normalPreviewFallback(url) {
  return `<p class="url-preview-fallback"><a class="inline-link" href="${escapeAttr(withOutboundRef(url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a></p>`;
}

function parseUrlPreviewBlock(lines, startIndex) {
  const block = parseUrlPreviewData(lines, startIndex);
  const fetched = urlPreviewCache.get(block.url);
  const data = block.data;

  // Explicit fields override fetched metadata, if supplied.
  const title = String(data.title || fetched?.title || "").trim();
  const description = String(data.description || fetched?.description || "").trim();
  const site = String(
    data.site ||
    fetched?.site ||
    new URL(block.url).hostname.replace(/^www\./, "")
  ).trim();
  const image = safePreviewImage(
    data.image || fetched?.image || "",
    fetched?.finalUrl || block.url
  );
  const imageAlt = String(
    data.imageAlt ||
    fetched?.imageAlt ||
    title ||
    ""
  ).trim();

  const hasManualMetadata = Boolean(
    data.title || data.description || data.site || data.image
  );

  const youtubeEmbed = youtubeEmbedUrl(block.url);
  if (youtubeEmbed) {
    return {
      endIndex: block.endIndex,
      html: youtubePreviewHtml({
        url: block.url,
        embedUrl: youtubeEmbed,
        title: title || "YouTube video",
        description,
        site: site || "YouTube"
      })
    };
  }

  if (!fetched?.ok && !hasManualMetadata) {
    return {
      endIndex: block.endIndex,
      html: normalPreviewFallback(block.url)
    };
  }

  return {
    endIndex: block.endIndex,
    html: urlPreviewHtml({
      url: block.url,
      title: title || block.url,
      description,
      site,
      image,
      imageAlt
    })
  };
}

function urlPreviewHtml(preview) {
  const imageHtml = preview.image
    ? `<div class="url-preview-visual"><img src="${escapeAttr(preview.image)}" alt="${escapeAttr(preview.imageAlt)}" loading="lazy" decoding="async"></div>`
    : `<div class="url-preview-visual url-preview-visual-fallback" aria-hidden="true">
         <span class="url-preview-domain">${escapeHtml(preview.site)}</span>
         <strong>${escapeHtml(preview.title)}</strong>
       </div>`;

  const descriptionHtml = preview.description
    ? `<p>${escapeHtml(preview.description)}</p>`
    : "";

  return `<a class="url-preview-card" href="${escapeAttr(withOutboundRef(preview.url))}" target="_blank" rel="noopener noreferrer">
    ${imageHtml}
    <div class="url-preview-copy">
      <span class="url-preview-site">${escapeHtml(preview.site)}</span>
      <strong class="url-preview-title">${escapeHtml(preview.title)}</strong>
      ${descriptionHtml}
      <span class="url-preview-host">${escapeHtml(new URL(preview.url).hostname.replace(/^www\./, ""))} ↗</span>
    </div>
  </a>`;
}

function youtubePreviewHtml(preview) {
  const descriptionHtml = preview.description
    ? `<p>${escapeHtml(preview.description)}</p>`
    : "";

  return `<figure class="youtube-preview-card">
    <div class="youtube-preview-frame">
      <iframe src="${escapeAttr(preview.embedUrl)}" title="${escapeAttr(preview.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
    <figcaption class="youtube-preview-copy">
      <span class="url-preview-site">${escapeHtml(preview.site)}</span>
      <a class="youtube-preview-title" href="${escapeAttr(withOutboundRef(preview.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(preview.title)}</a>
      ${descriptionHtml}
      <span class="url-preview-host">youtube.com ↗</span>
    </figcaption>
  </figure>`;
}

function countIndent(line = "") {
  let count = 0;
  for (const char of String(line)) {
    if (char === " ") count += 1;
    else if (char === "\t") count += 4;
    else break;
  }
  return count;
}

function parseListLine(line = "") {
  const match = String(line).match(/^(\s*)([-+*]|\d+\.)\s+(.+)$/);
  if (!match) return null;
  return {
    indent: countIndent(match[1]),
    ordered: /\d+\./.test(match[2]),
    marker: match[2],
    content: match[3]
  };
}

function splitTableRow(line = "") {
  let value = String(line).trim();
  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);

  const cells = [];
  let current = "";
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      current += char;
      continue;
    }
    if (char === "|") {
      cells.push(current.trim().replace(/\\\|/g, "|"));
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim().replace(/\\\|/g, "|"));
  return cells;
}

function isTableSeparator(line = "") {
  const cells = splitTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function tableAlignment(cell = "") {
  const value = cell.trim();
  if (value.startsWith(":") && value.endsWith(":")) return "center";
  if (value.endsWith(":")) return "right";
  if (value.startsWith(":")) return "left";
  return "";
}

function extractFootnotes(lines) {
  const footnotes = new Map();
  const clean = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\[\^([^\]]+)\]:\s*(.*)$/);
    if (!match) {
      clean.push(lines[i]);
      continue;
    }

    const id = match[1];
    const content = [match[2]];
    let j = i + 1;

    while (j < lines.length) {
      if (/^(?: {2,}|\t)/.test(lines[j])) {
        content.push(lines[j].replace(/^(?: {2,}|\t)/, ""));
        j += 1;
        continue;
      }

      if (!lines[j].trim() && j + 1 < lines.length && /^(?: {2,}|\t)/.test(lines[j + 1])) {
        content.push("");
        j += 1;
        continue;
      }

      break;
    }

    footnotes.set(id, content.join(" ").replace(/\s+/g, " ").trim());
    i = j - 1;
  }

  return { lines: clean, footnotes };
}

function renderTable(lines, startIndex, context) {
  const headers = splitTableRow(lines[startIndex]);
  const separators = splitTableRow(lines[startIndex + 1]);
  const alignments = separators.map(tableAlignment);
  let index = startIndex + 2;
  const rows = [];

  while (
    index < lines.length &&
    lines[index].trim() &&
    lines[index].includes("|") &&
    !isTableSeparator(lines[index])
  ) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const head = headers.map((cell, i) => {
    const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : "";
    return `<th${align}>${inlineMarkdown(cell, context)}</th>`;
  }).join("");

  const body = rows.map((row) => {
    const cells = headers.map((_, i) => {
      const align = alignments[i] ? ` style="text-align:${alignments[i]}"` : "";
      return `<td${align}>${inlineMarkdown(row[i] || "", context)}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("\n");

  return {
    nextIndex: index,
    html: `<div class="markdown-table-wrap"><table class="markdown-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
  };
}

function parseCsvRows(source = "") {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
        continue;
      }
      if (char === '"') {
        quoted = false;
        continue;
      }
      cell += char;
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (char !== "\r") cell += char;
  }

  row.push(cell);
  rows.push(row);

  while (rows.length && rows[rows.length - 1].every((value) => value === "")) {
    rows.pop();
  }

  return rows;
}

function renderCsvTable(source = "") {
  const rows = parseCsvRows(source);
  if (!rows.length) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => {
    const cells = [...row];
    while (cells.length < columnCount) cells.push("");
    return cells;
  });

  const headers = normalized[0];
  const bodyRows = normalized.slice(1);
  const head = headers
    .map((cell) => `<th>${escapeHtml(cell.trim())}</th>`)
    .join("");
  const body = bodyRows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join("")}</tr>`)
    .join("\n");

  return `<div class="markdown-table-wrap csv-table-wrap"><table class="markdown-table csv-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function renderList(lines, startIndex, baseIndent, context) {
  const first = parseListLine(lines[startIndex]);
  const ordered = first.ordered;
  const tag = ordered ? "ol" : "ul";
  let index = startIndex;
  let html = `<${tag} class="markdown-list">`;

  while (index < lines.length) {
    const item = parseListLine(lines[index]);
    if (!item || item.indent !== baseIndent || item.ordered !== ordered) break;

    let content = item.content;
    let task = null;
    const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/);
    if (taskMatch) {
      task = taskMatch[1].toLowerCase() === "x";
      content = taskMatch[2];
    }

    html += `<li${task !== null ? ' class="task-list-item"' : ""}>`;

    if (task !== null) {
      html += `<input class="task-list-checkbox" type="checkbox" disabled${task ? " checked" : ""} aria-label="${task ? "Completed task" : "Incomplete task"}">`;
      html += `<span>${inlineMarkdown(content, context)}</span>`;
    } else {
      html += inlineMarkdown(content, context);
    }

    index += 1;

    while (index < lines.length) {
      const nested = parseListLine(lines[index]);

      if (nested && nested.indent > baseIndent) {
        const rendered = renderList(lines, index, nested.indent, context);
        html += rendered.html;
        index = rendered.nextIndex;
        continue;
      }

      if (nested && nested.indent === baseIndent) break;
      if (nested && nested.indent < baseIndent) break;

      if (!lines[index].trim()) {
        const next = index + 1 < lines.length ? parseListLine(lines[index + 1]) : null;
        if (next && next.indent > baseIndent) {
          index += 1;
          continue;
        }
        break;
      }

      const indent = countIndent(lines[index]);
      if (indent > baseIndent) {
        html += `<div class="list-continuation">${inlineMarkdown(lines[index].trim(), context)}</div>`;
        index += 1;
        continue;
      }

      break;
    }

    html += "</li>";
  }

  html += `</${tag}>`;
  return { html, nextIndex: index };
}

function renderDefinitionList(lines, startIndex, context) {
  let index = startIndex;
  let html = '<dl class="definition-list">';

  while (index < lines.length) {
    const term = lines[index];
    if (!term.trim() || index + 1 >= lines.length || !/^\s*:\s+/.test(lines[index + 1])) break;

    html += `<dt>${inlineMarkdown(term.trim(), context)}</dt>`;
    index += 1;

    while (index < lines.length) {
      const definition = lines[index].match(/^\s*:\s+(.*)$/);
      if (!definition) break;
      html += `<dd>${inlineMarkdown(definition[1], context)}</dd>`;
      index += 1;
    }

    if (index < lines.length && !lines[index].trim()) {
      const next = index + 1;
      if (
        next < lines.length &&
        next + 1 < lines.length &&
        /^\s*:\s+/.test(lines[next + 1])
      ) {
        index = next;
        continue;
      }
    }
  }

  html += "</dl>";
  return { html, nextIndex: index };
}

function isSpecialBlockStart(lines, index) {
  const line = lines[index] || "";
  const next = lines[index + 1] || "";

  return (
    line.trim() === ":::url-preview" ||
    /^```/.test(line) ||
    /^(#{1,6})\s+/.test(line) ||
    /^---+$/.test(line.trim()) ||
    Boolean(parseListLine(line)) ||
    /^>\s?/.test(line) ||
    (line.includes("|") && isTableSeparator(next)) ||
    (line.trim() && /^\s*:\s+/.test(next))
  );
}

function renderBlocks(lines, context) {
  const out = [];
  let index = 0;
  let codeBlockIndex = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim() === ":::url-preview") {
      const preview = parseUrlPreviewBlock(lines, index);
      out.push(preview.html);
      index = preview.endIndex + 1;
      continue;
    }

    if (/^```/.test(line)) {
      const rawLanguage = line.slice(3).trim().toLowerCase();
      const languageAliases = {
        "c#": "csharp",
        "cs": "csharp",
        "c-sharp": "csharp",
        "assembly": "asm",
        "riscv": "asm",
        "risc-v": "asm",
        "js": "javascript",
        "ts": "typescript",
        "py": "python",
        "sh": "bash",
        "shell": "bash",
        "scss": "css",
        "sass": "css"
      };
      const language = languageAliases[rawLanguage] || rawLanguage;
      const displayLanguage = rawLanguage || language;
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      if (language === "csv") {
        const csvHtml = renderCsvTable(codeLines.join("\n"));
        if (csvHtml) {
          out.push(csvHtml);
          continue;
        }
      }

      const langClass = language ? ` class="language-${escapeAttr(language)}"` : "";
      const languageLabels = {
        js: "JavaScript",
        javascript: "JavaScript",
        ts: "TypeScript",
        typescript: "TypeScript",
        cs: "C#",
        csharp: "C#",
        asm: "Assembly",
        assembly: "Assembly",
        bash: "Bash",
        shell: "Shell",
        sh: "Shell",
        json: "JSON",
        html: "HTML",
        css: "CSS",
        scss: "SCSS",
        sass: "Sass",
        php: "PHP",
        python: "Python",
        py: "Python",
        text: "Text"
      };
      const label = escapeHtml(languageLabels[displayLanguage] || languageLabels[language] || displayLanguage || "Code");
      const codeId = `code-block-${++codeBlockIndex}`;
      const lineNumbers = codeLines.map((_, i) => `<span>${i + 1}</span>`).join("");

      out.push(
        `<div class="code-card">` +
          `<div class="code-toolbar">` +
            `<span class="code-language">${label}</span>` +
            `<button class="code-copy" type="button" data-copy-target="#${codeId}" aria-label="Copy code">` +
              `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path></svg>` +
              `<span data-copy-label>Copy</span>` +
            `</button>` +
          `</div>` +
          `<div class="code-body">` +
            `<div class="code-line-numbers" aria-hidden="true">${lineNumbers}</div>` +
            `<pre><code id="${codeId}"${langClass}>${escapeHtml(codeLines.join("\n"))}</code></pre>` +
          `</div>` +
        `</div>`
      );
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const table = renderTable(lines, index, context);
      out.push(table.html);
      index = table.nextIndex;
      continue;
    }

    if (line.trim() && index + 1 < lines.length && /^\s*:\s+/.test(lines[index + 1])) {
      const definitions = renderDefinitionList(lines, index, context);
      out.push(definitions.html);
      index = definitions.nextIndex;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}${level === 1 ? ' class="article-body-h1"' : ""}>${inlineMarkdown(heading[2], context)}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      out.push("<hr>");
      index += 1;
      continue;
    }

    const list = parseListLine(line);
    if (list) {
      const rendered = renderList(lines, index, list.indent, context);
      out.push(rendered.html);
      index = rendered.nextIndex;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      out.push(`<blockquote>${renderBlocks(quoteLines, context)}</blockquote>`);
      continue;
    }

    const paragraph = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !isSpecialBlockStart(lines, index)
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    out.push(`<p>${inlineMarkdown(paragraph.join(" "), context)}</p>`);
  }

  return out.join("\n");
}

function renderFootnotes(context) {
  if (!context.footnoteOrder.length) return "";

  const items = context.footnoteOrder.map((rawId) => {
    const number = context.footnoteNumbers.get(rawId);
    const id = slugify(rawId) || `note-${number}`;
    const content = context.footnotes.get(rawId) || "";
    const refs = context.footnoteRefCounts.get(rawId) || 1;
    const backlinks = Array.from({ length: refs }, (_, index) => {
      const label = refs > 1 ? `Back to reference ${index + 1}` : "Back to reference";
      return `<a class="footnote-backref" href="#fnref-${id}-${index + 1}" aria-label="${label}">↩</a>`;
    }).join(" ");

    return `<li id="fn-${id}">${inlineMarkdown(content, context)} ${backlinks}</li>`;
  }).join("\n");

  return `<section class="footnotes" aria-label="Footnotes"><h2>Footnotes</h2><ol>${items}</ol></section>`;
}

function markdownToHtml(markdown) {
  const rawLines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const extracted = extractFootnotes(rawLines);

  const context = {
    footnotes: extracted.footnotes,
    footnoteNumbers: new Map(),
    footnoteOrder: [],
    footnoteRefCounts: new Map()
  };

  let html = renderBlocks(extracted.lines, context);
  html += renderFootnotes(context);

  // Preserve the existing article-section spacing from each H2 onward.
  const parts = html.split(/(?=<h2(?:\s|>))/g);
  if (parts.length <= 1) return html;

  return parts.map((part, index) => {
    if (index === 0 && !part.startsWith("<h2")) return part;
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

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripInternalHtmlExtensions(text = "") {
  let output = String(text);
  const sitePattern = escapeRegExp(siteUrl);

  if (siteUrl) {
    output = output.replace(
      new RegExp(`${sitePattern}/([^\\s"'<>?#]+)\\.html`, "g"),
      `${siteUrl}/$1`
    );
  }

  if (basePath === "/") {
    output = output.replace(/(["'(:]|^)(\/[A-Za-z0-9_./-]+)\.html/g, "$1$2");
  } else {
    const basePattern = escapeRegExp(basePath);
    output = output.replace(
      new RegExp(`(["'(:]|^)(${basePattern}[A-Za-z0-9_./-]+)\\.html`, "g"),
      "$1$2"
    );
  }

  return output;
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


function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(value = "") {
  return `<![CDATA[${String(value).replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}

function absoluteUrl(relative = "") {
  if (/^https?:\/\//i.test(relative)) return relative;
  const normalized = String(relative || "").startsWith("/") ? relative : `/${relative}`;
  return `${siteUrl}${normalized}`;
}

function postMarkdown(post) {
  const updatedLine = post.updatedAt !== post.createdAt
    ? `Updated: ${post.updatedAt}\n`
    : "";
  const localUrl = `${siteUrl}/posts/${post.slug}.html`;
  const canonical = post.canonicalUrl || localUrl;
  const sourceLine = post.sourceUrl
    ? `Original source: ${post.sourceUrl}\n`
    : "";

  return `# ${post.title}

> ${post.description}

Published: ${post.createdAt}
${updatedLine}Category: ${post.category}
Canonical: ${canonical}
${sourceLine}
${(post.publicBodyMarkdown || post.bodyMarkdown).trim()}
`;
}

function postJsonLd(post) {
  const image = post.image?.absoluteUrl ? [post.image.absoluteUrl] : undefined;
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: isoDate(post.createdAt),
    dateModified: isoDate(post.updatedAt),
    mainEntityOfPage: `${siteUrl}/posts/${post.slug}.html`,
    url: `${siteUrl}/posts/${post.slug}.html`,
    inLanguage: siteLanguage,
    articleSection: post.category,
    author: {
      "@type": "Person",
      name: ownerName,
      url: `${siteUrl}/about.html`,
      sameAs: [githubUrl, mediumUrl, hackerNoonUrl].filter(Boolean)
    },
    publisher: {
      "@type": "Person",
      name: ownerName,
      url: `${siteUrl}/about.html`
    },
    isPartOf: {
      "@type": "Blog",
      name: siteName,
      url: `${siteUrl}/blog/`
    }
  };

  if (image) data.image = image;
  if (post.tags?.length) data.keywords = post.tags;
  if (post.sourceUrl) {
    data.isBasedOn = post.sourceUrl;
    data.sameAs = [post.sourceUrl];
  }
  return JSON.stringify(data).replace(/</g, "\\u003c");
}


async function resolveMarkdownBodyImages(post) {
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)(\s+["'][^"']*["'])?\)/g;
  let result = "";
  let lastIndex = 0;
  let imageIndex = 0;

  for (const match of post.bodyMarkdown.matchAll(pattern)) {
    result += post.bodyMarkdown.slice(lastIndex, match.index);

    const alt = match[1];
    const rawSrc = match[2];
    const optionalTitle = match[3] || "";
    let publicSrc = rawSrc;

    if (!/^https:\/\//i.test(rawSrc) && !rawSrc.startsWith("/")) {
      const sourceImage = path.resolve(path.dirname(post.sourceFilePath), rawSrc);
      const writingRoot = path.resolve(writingDir);
      const relativeToWriting = path.relative(writingRoot, sourceImage);

      if (relativeToWriting.startsWith("..") || path.isAbsolute(relativeToWriting)) {
        throw new Error(`${post.sourceFile}: Markdown image must stay inside writing/ when using a relative path`);
      }

      const fileName = safeImageFileName(sourceImage);
      const outputDir = path.join(distDir, "assets", "images", "posts", post.slug);
      const numberedName = `content-${++imageIndex}-${fileName}`;
      const outputFile = path.join(outputDir, numberedName);

      await mkdir(outputDir, { recursive: true });
      try {
        await copyFile(sourceImage, outputFile);
      } catch {
        throw new Error(`${post.sourceFile}: Markdown image not found: ${rawSrc}`);
      }

      publicSrc = `${basePath}assets/images/posts/${post.slug}/${numberedName}`;
    }

    result += `![${alt}](${publicSrc}${optionalTitle})`;
    lastIndex = match.index + match[0].length;
  }

  result += post.bodyMarkdown.slice(lastIndex);
  return result;
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

    for (const required of ["title", "created", "updated", "category"]) {
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
      description: String(meta.description ?? ""),
      sourcePlatform: meta.sourcePlatform ? String(meta.sourcePlatform).toLowerCase() : "",
      sourceUrl: meta.sourceUrl ? String(meta.sourceUrl) : (meta.projectUrl ? String(meta.projectUrl) : ""),
      canonicalUrl: meta.canonicalUrl ? String(meta.canonicalUrl) : "",
      originalTitle: meta.originalTitle ? String(meta.originalTitle) : "",
      originalPublished: meta.originalPublished ? String(meta.originalPublished) : "",
      author: meta.author ? String(meta.author) : ownerName,
      tags: meta.tags ? String(meta.tags).split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      sourceFeaturedImage: meta.sourceFeaturedImage ? String(meta.sourceFeaturedImage) : "",
      importMethod: meta.importMethod ? String(meta.importMethod) : "",
      importedAt: meta.importedAt ? String(meta.importedAt) : "",
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
  return `<article class="post">
    <div class="post-date">${escapeHtml(formatDate(post.createdAt).toUpperCase())}</div>
    <div class="post-info">
      <span class="category">${escapeHtml(post.category.toUpperCase())}</span>
      <a class="post-title" href="${escapeAttr(post.url)}">${escapeHtml(post.title)}</a>
      <p>${escapeHtml(post.description)}</p>
    </div>
  </article>`;
}

function inArticleAdHtml() {
  if (!inArticleAdEnabled) return "";

  const label = String(inArticleAdConfig.label || "Advertisement").trim();
  const adsense = inArticleAdConfig.adsense || {};

  if (inArticleAdProvider === "adsense") {
    const showDummy = adsense.showDummy === true;
    const client = String(adsense.client || "").trim();
    const slot = String(adsense.slot || "").trim();

    if (showDummy && (!client || !slot)) {
      return `<aside class="in-article-adsense" aria-label="${escapeAttr(label)}" data-pagefind-ignore>
    <p><strong>${escapeHtml(label)}</strong></p>
    <div class="dummy-adsense-slot">
      <p><strong>Google AdSense preview</strong></p>
      <p>Dummy ad shown because adsense.showDummy is true.</p>
    </div>
  </aside>`;
    }

    if (!client || !slot) return "";

    const format = String(adsense.format || "auto").trim();
    const responsive = adsense.fullWidthResponsive !== false ? "true" : "false";

    return `<aside class="in-article-adsense" aria-label="${escapeAttr(label)}" data-pagefind-ignore>
    <p><strong>${escapeHtml(label)}</strong></p>
    <ins class="adsbygoogle"
      style="display:block"
      data-ad-client="${escapeAttr(client)}"
      data-ad-slot="${escapeAttr(slot)}"
      data-ad-format="${escapeAttr(format)}"
      data-full-width-responsive="${escapeAttr(responsive)}"></ins>
    <script>(adsbygoogle=window.adsbygoogle||[]).push({});</script>
  </aside>`;
  }

  const custom = inArticleAdConfig.custom || inArticleAdConfig;
  const title = String(custom.title || "Sponsored").trim();
  const text = String(custom.text || "").trim();
  const cta = String(custom.cta || "Learn more").trim();
  const rawUrl = String(custom.url || "").trim();

  if (!title && !text && !rawUrl) return "";

  let href = "";
  if (rawUrl) {
    try {
      href = new URL(rawUrl, siteUrl || "https://example.com").href;
    } catch {
      href = "";
    }
  }

  const ctaHtml = href
    ? `<a class="in-article-ad-link" href="${escapeAttr(href)}"${href.startsWith(siteUrl) ? "" : ' target="_blank" rel="noopener noreferrer"'}>${escapeHtml(cta)}</a>`
    : "";
  const textHtml = text ? `<p>${escapeHtml(text)}</p>` : "";

  return `<aside class="in-article-ad" aria-label="${escapeAttr(label)}" data-pagefind-ignore>
    <strong class="in-article-ad-label">${escapeHtml(label)}</strong>
    ${title ? `<strong class="in-article-ad-title">${escapeHtml(title)}</strong>` : ""}
    ${textHtml}
    ${ctaHtml}
  </aside>`;
}

function adsenseScriptHtml() {
  if (!inArticleAdEnabled || inArticleAdProvider !== "adsense") return "";

  const showDummy = inArticleAdConfig.adsense?.showDummy === true;
  const client = String(inArticleAdConfig.adsense?.client || "").trim();
  const slot = String(inArticleAdConfig.adsense?.slot || "").trim();
  if (showDummy && (!client || !slot)) return "";
  if (!client || !slot) return "";

  const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
  return `<script async src="${escapeAttr(src)}" crossorigin="anonymous"></script>`;
}

function insertInArticleAd(bodyHtml, adHtml) {
  if (!adHtml) return bodyHtml;

  const paragraphPattern = /<p\b[\s\S]*?<\/p>/gi;
  const paragraphs = String(bodyHtml).match(paragraphPattern);
  if (!paragraphs || paragraphs.length < 3) return `${bodyHtml}\n${adHtml}`;

  const insertAfter = Math.min(
    paragraphs.length - 1,
    Math.max(inArticleAdMinParagraphsBefore, Math.floor(paragraphs.length / 2))
  );

  let seen = 0;
  return String(bodyHtml).replace(paragraphPattern, (block) => {
    seen += 1;
    return seen === insertAfter ? `${block}\n${adHtml}` : block;
  });
}

function postNavigationHtml(post, posts) {
  const index = posts.findIndex((item) => item.slug === post.slug);
  if (index === -1) return "";

  const nextPost = posts[index - 1] || null;
  const previousPost = posts[index + 1] || null;
  if (!nextPost && !previousPost) return "";

  const cardHtml = (item, kind) => {
    if (!item) return "";

    const label = kind === "previous" ? "&larr; Previous" : "Up Next &rarr;";
    const directionClass = kind === "previous" ? "post-nav-previous" : "post-nav-next";
    const singleNextClass = kind === "next" && !previousPost ? " post-nav-single-next" : "";

    return `<a class="post-nav-card ${directionClass}${singleNextClass}" href="${escapeAttr(`${basePath}posts/${item.slug}.html`)}">
      <span>${label}</span>
      <strong>${escapeHtml(item.title)}</strong>
    </a>`;
  };

  return `<nav class="post-navigation" aria-label="Adjacent posts" data-pagefind-ignore>
    ${cardHtml(previousPost, "previous")}
    ${cardHtml(nextPost, "next")}
  </nav>`;
}

function afterNavigationAdHtml() {
  const adHtml = inArticleAdHtml();
  if (!adHtml) return "";

  return adHtml.replace(
    /class="([^"]+)"/,
    'class="$1 after-navigation-ad"'
  );
}

const writingPosts = await loadWritingPosts();
await prepareUrlPreviews(writingPosts);
for (const post of writingPosts) {
  post.publicBodyMarkdown = await resolveMarkdownBodyImages(post);
}
const postTemplate = await readFile(path.join(templatesDir, "post.html"), "utf8");
const generatedPostsDir = path.join(distDir, "posts");
await mkdir(generatedPostsDir, { recursive: true });

for (const post of writingPosts) {
  post.image = await resolveFeaturedImage(post);
  const bodyHtml = markdownToHtml(post.publicBodyMarkdown || post.bodyMarkdown);
  const bodyHtmlWithAd = insertInArticleAd(bodyHtml, inArticleAdHtml());
  const updatedMeta = post.updatedAt !== post.createdAt
    ? `<span class="article-updated">Updated <time datetime="${escapeAttr(post.updatedAt)}">${escapeHtml(formatDate(post.updatedAt))}</time></span>`
    : "";

  const sourcePlatformLabel = post.sourcePlatform === "hackernoon"
    ? "HackerNoon"
    : post.sourcePlatform === "medium"
      ? "Medium"
      : "";
  const sourcePrefix = sourcePlatformLabel
    ? `Originally published on ${sourcePlatformLabel}:`
    : "Source:";
  const sourceHtml = post.sourceUrl
    ? `<p class="article-source-note">${escapeHtml(sourcePrefix)} <a class="inline-link" href="${escapeAttr(post.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(post.sourceUrl.replace(/^https?:\/\//, ""))}</a></p>`
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
    .replaceAll("{{POST_MARKDOWN_URL}}", `${siteUrl}/posts/${post.slug}.md`)
    .replaceAll("{{POST_TWITTER_CARD}}", post.image?.absoluteUrl ? "summary_large_image" : "summary")
    .replaceAll("{{POST_TWITTER_IMAGE}}", post.image?.absoluteUrl
      ? `<meta name="twitter:image" content="${escapeAttr(post.image.absoluteUrl)}">` +
        (post.image.alt ? `\n  <meta name="twitter:image:alt" content="${escapeAttr(post.image.alt)}">` : "")
      : "")
    .replaceAll("{{POST_JSON_LD}}", postJsonLd(post))
    .replaceAll("{{POST_ADSENSE_SCRIPT}}", adsenseScriptHtml())
    .replaceAll("{{POST_FEATURED_IMAGE}}", featuredImageHtml(post.image))
    .replaceAll("{{POST_BODY_WITH_AD}}", bodyHtmlWithAd)
    .replaceAll("{{POST_PROJECT_SOURCE}}", sourceHtml)
    .replaceAll("{{POST_NAVIGATION}}", postNavigationHtml(post, writingPosts))
    .replaceAll("{{POST_AFTER_NAVIGATION_AD}}", afterNavigationAdHtml())
    .replaceAll("{{POST_CANONICAL}}", post.canonicalUrl || `${siteUrl}/posts/${post.slug}.html`);

  html = replaceSiteTokens(html);
  await writeFile(path.join(generatedPostsDir, `${post.slug}.html`), html, "utf8");
  await writeFile(path.join(generatedPostsDir, `${post.slug}.md`), postMarkdown(post), "utf8");
}

const allBlogPosts = writingPosts.map((post) => ({
  title: post.title,
  url: `${basePath}posts/${post.slug}.html`,
  source: post.sourcePlatform === "hackernoon"
    ? "HackerNoon"
    : post.sourcePlatform === "medium"
      ? "Medium"
      : "Rizwan3d",
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
const textExtensions = new Set([".html", ".css", ".js", ".json", ".md", ".xml", ".txt", ".webmanifest"]);

for (const file of files) {
  if (!textExtensions.has(path.extname(file))) continue;
  let text = await readFile(file, "utf8");
  text = replaceSiteTokens(text);

  if (file.endsWith(".html")) {
    const rel = path.relative(distDir, file).split(path.sep).join("/");

    if (rel === "index.html") {
      const verify = [
        googleSiteVerification ? `<meta name="google-site-verification" content="${escapeAttr(googleSiteVerification)}">` : "",
        bingSiteVerification ? `<meta name="msvalidate.01" content="${escapeAttr(bingSiteVerification)}">` : ""
      ].filter(Boolean).join("\n  ");

      if (verify) text = text.replace("</head>", `  ${verify}\n</head>`);

      if (!text.includes('"@type":"WebSite"')) {
        const websiteLd = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteName,
          url: `${siteUrl}/`,
          inLanguage: siteLanguage,
          publisher: {
            "@type": "Person",
            name: ownerName,
            url: `${siteUrl}/about.html`,
            sameAs: [githubUrl, mediumUrl, hackerNoonUrl].filter(Boolean)
          }
        }).replace(/</g, "\\u003c");
        text = text.replace("</head>", `  <script type="application/ld+json">${websiteLd}</script>\n</head>`);
      }
    }

    if (rel === "blog/index.html" && !text.includes('"@type":"Blog"')) {
      const blogLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Blog",
        name: `${siteName} Blog`,
        url: `${siteUrl}/blog/`,
        description: `Articles and technical writing by ${ownerName}.`,
        inLanguage: siteLanguage,
        author: {
          "@type": "Person",
          name: ownerName,
          url: `${siteUrl}/about.html`
        }
      }).replace(/</g, "\\u003c");
      text = text.replace("</head>", `  <script type="application/ld+json">${blogLd}</script>\n</head>`);
    }
  }

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

const postByHtmlPath = new Map(
  writingPosts.map((post) => [`posts/${post.slug}.html`, post])
);

const sitemapEntries = htmlFiles.map((file) => {
  let rel = path.relative(distDir, file).split(path.sep).join("/");
  const post = postByHtmlPath.get(rel);
  const urlRel = rel === "index.html" ? "" : rel.replace(/index\.html$/, "");
  const url = `${siteUrl}/${urlRel}`.replace(/([^:]\/)\/+/, "$1");

  return {
    url,
    lastmod: post?.updatedAt || "",
    image: post?.image?.absoluteUrl || "",
    imageTitle: post?.image?.alt || post?.title || ""
  };
});

const sitemapHasImages = sitemapEntries.some((entry) => entry.image);
const sitemapNamespaces = sitemapHasImages
  ? ` xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`
  : ` xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"`;

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset${sitemapNamespaces}>\n` +
  sitemapEntries.map((entry) => {
    const parts = [`    <loc>${escapeXml(entry.url)}</loc>`];
    if (entry.lastmod) parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
    if (entry.image) {
      parts.push(`    <image:image>`);
      parts.push(`      <image:loc>${escapeXml(entry.image)}</image:loc>`);
      if (entry.imageTitle) parts.push(`      <image:title>${escapeXml(entry.imageTitle)}</image:title>`);
      parts.push(`    </image:image>`);
    }
    return `  <url>\n${parts.join("\n")}\n  </url>`;
  }).join("\n") +
  `\n</urlset>\n`;
await writeFile(path.join(distDir, "sitemap.xml"), sitemap, "utf8");

const latestUpdated = writingPosts.reduce((latest, post) => (
  !latest || post.updatedAt > latest ? post.updatedAt : latest
), "");
const feedBuildDate = latestUpdated ? new Date(`${latestUpdated}T00:00:00.000Z`) : new Date();

const rssItems = writingPosts.map((post) => {
  const link = `${siteUrl}/posts/${post.slug}.html`;
  const bodyHtml = markdownToHtml(post.publicBodyMarkdown || post.bodyMarkdown);
  return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <description>${cdata(post.description)}</description>
      <content:encoded>${cdata(bodyHtml)}</content:encoded>
      <pubDate>${new Date(isoDate(post.createdAt)).toUTCString()}</pubDate>
      <category>${escapeXml(post.category)}</category>
      <dc:creator>${escapeXml(ownerName)}</dc:creator>
    </item>`;
}).join("\n");

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${escapeXml(`${siteUrl}/`)}</link>
    <description>${escapeXml(`Technical articles by ${ownerName}.`)}</description>
    <language>${escapeXml(siteLanguage)}</language>
    <lastBuildDate>${feedBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(`${siteUrl}/rss.xml`)}" rel="self" type="application/rss+xml"/>
${rssItems}
  </channel>
</rss>
`;
await writeFile(path.join(distDir, "rss.xml"), rss, "utf8");

const atomEntries = writingPosts.map((post) => {
  const link = `${siteUrl}/posts/${post.slug}.html`;
  const bodyHtml = markdownToHtml(post.publicBodyMarkdown || post.bodyMarkdown);
  return `  <entry>
    <title>${escapeXml(post.title)}</title>
    <id>${escapeXml(link)}</id>
    <link href="${escapeXml(link)}"/>
    <link rel="alternate" type="text/markdown" href="${escapeXml(`${siteUrl}/posts/${post.slug}.md`)}"/>
    <published>${escapeXml(isoDate(post.createdAt))}</published>
    <updated>${escapeXml(isoDate(post.updatedAt))}</updated>
    <author><name>${escapeXml(ownerName)}</name></author>
    <category term="${escapeXml(post.category)}"/>
    <summary>${escapeXml(post.description)}</summary>
    <content type="html">${escapeXml(bodyHtml)}</content>
  </entry>`;
}).join("\n");

const atom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteName)}</title>
  <id>${escapeXml(`${siteUrl}/`)}</id>
  <link href="${escapeXml(`${siteUrl}/`)}"/>
  <link rel="self" href="${escapeXml(`${siteUrl}/atom.xml`)}"/>
  <updated>${escapeXml(feedBuildDate.toISOString())}</updated>
  <author><name>${escapeXml(ownerName)}</name></author>
${atomEntries}
</feed>
`;
await writeFile(path.join(distDir, "atom.xml"), atom, "utf8");

const jsonFeed = {
  version: "https://jsonfeed.org/version/1.1",
  title: siteName,
  home_page_url: `${siteUrl}/`,
  feed_url: `${siteUrl}/feed.json`,
  description: `Technical articles by ${ownerName}.`,
  language: siteLanguage,
  authors: [{
    name: ownerName,
    url: `${siteUrl}/about.html`,
    avatar: `${siteUrl}/assets/images/muhammad-rizwan.webp`
  }],
  items: writingPosts.map((post) => ({
    id: `${siteUrl}/posts/${post.slug}.html`,
    url: `${siteUrl}/posts/${post.slug}.html`,
    title: post.title,
    summary: post.description,
    content_html: markdownToHtml(post.publicBodyMarkdown || post.bodyMarkdown),
    date_published: isoDate(post.createdAt),
    date_modified: isoDate(post.updatedAt),
    tags: [post.category],
    ...(post.image?.absoluteUrl ? { image: post.image.absoluteUrl } : {})
  }))
};
await writeFile(path.join(distDir, "feed.json"), `${JSON.stringify(jsonFeed, null, 2)}\n`, "utf8");

const llmsPostList = writingPosts.map((post) =>
  `- [${post.title}](${siteUrl}/posts/${post.slug}.md): ${post.description}`
).join("\n");

const llms = `# ${siteName}

> Personal technical blog by ${ownerName}, focused on software engineering, AI agents, RISC-V, compilers, virtual machines, developer tooling, C#, .NET, PHP, and web technologies.

Canonical site: ${siteUrl}/
Blog archive: ${siteUrl}/blog/
RSS: ${siteUrl}/rss.xml
Atom: ${siteUrl}/atom.xml
JSON Feed: ${siteUrl}/feed.json
Sitemap: ${siteUrl}/sitemap.xml
Author: ${siteUrl}/about.html

## Articles

${llmsPostList || "- No published articles yet."}

## Useful pages

- [About](${siteUrl}/about.html): About ${ownerName}.
- [Contact](${siteUrl}/contact.html): Contact information.
- [Blog archive](${siteUrl}/blog/): All published articles.
`;
await writeFile(path.join(distDir, "llms.txt"), llms, "utf8");

const llmsFull = `# ${siteName} - Full article text

> Clean Markdown export of all currently published articles.

${writingPosts.map((post) => `---

# ${post.title}

Canonical: ${siteUrl}/posts/${post.slug}.html
Published: ${post.createdAt}
Updated: ${post.updatedAt}
Category: ${post.category}

> ${post.description}

${(post.publicBodyMarkdown || post.bodyMarkdown).trim()}
`).join("\n")}
`;
await writeFile(path.join(distDir, "llms-full.txt"), llmsFull, "utf8");

const searchAgentRules = allowAiSearch
  ? `User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /
`
  : `User-agent: OAI-SearchBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: Claude-SearchBot
Disallow: /

User-agent: Claude-User
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Perplexity-User
Disallow: /
`;

const trainingRules = allowAiTraining
  ? `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Google-Extended
Allow: /
`
  : `User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /
`;

const robots = `# Search engines and ordinary web crawlers
User-agent: *
Allow: /

# AI search and user-directed agents
${searchAgentRules}
# Dedicated model-training / AI-use controls
${trainingRules}
Sitemap: ${siteUrl}/sitemap.xml
`;
await writeFile(path.join(distDir, "robots.txt"), robots, "utf8");

for (const file of await walk(distDir)) {
  if (!textExtensions.has(path.extname(file))) continue;
  const text = await readFile(file, "utf8");
  const cleaned = stripInternalHtmlExtensions(text);
  if (cleaned !== text) await writeFile(file, cleaned, "utf8");
}

if (siteUrl === "https://example.com") {
  console.warn("\n[rizwan3d] Edit config/site.json before production: siteUrl is still https://example.com\n");
}

console.log(`[rizwan3d] Markdown posts: ${writingPosts.length}`);
console.log(`[rizwan3d] Blog archive: ${allBlogPosts.length} item(s), ${totalPages} page chunk(s)`);
console.log(`[rizwan3d] RSS/Atom/JSON feeds + llms.txt generated`);
console.log(`[rizwan3d] AI search crawling: ${allowAiSearch ? "allowed" : "blocked"}; AI training crawling: ${allowAiTraining ? "allowed" : "blocked"}`);
console.log(`[rizwan3d] Static files prepared in ${distDir}`);
