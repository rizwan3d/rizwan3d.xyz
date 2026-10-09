import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const site = JSON.parse(await readFile(path.join(root, "config/site.json"), "utf8"));
const siteUrl = String(site.siteUrl || "").replace(/\/$/, "");
const host = new URL(siteUrl).host;
const key = "4d9ed795cab34a768caf37fd1fcaa506";
const keyLocation = siteUrl + "/" + key + ".txt";
const recordPath = path.join(root, "indexnow-urls.json");
const sitemap = await readFile(path.join(root, "dist", "sitemap.xml"), "utf8");
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((match) => match[1].replace(/&amp;/g, "&"))
  .filter((url) => new URL(url).host === host);

if (!urls.length) throw new Error("No canonical site URLs in generated sitemap.");

async function readRecord() {
  try {
    const record = JSON.parse(await readFile(recordPath, "utf8"));
    const entries = Array.isArray(record.urls) ? record.urls : [];
    return new Map(entries
      .filter((entry) => typeof entry?.url === "string" && entry.url)
      .map((entry) => [entry.url, entry]));
  } catch (error) {
    if (error?.code === "ENOENT") return new Map();
    throw error;
  }
}

async function writeRecord(recordByUrl, submittedUrls = [], status = null) {
  const submittedAt = submittedUrls.length ? new Date().toISOString() : "";
  const submitted = new Set(submittedUrls);
  const now = submittedAt || new Date().toISOString();

  const record = {
    siteUrl,
    host,
    keyLocation,
    urls: urls.map((url) => {
      const previous = recordByUrl.get(url) || {};
      return {
        url,
        firstRecordedAt: previous.firstRecordedAt || now,
        lastSubmittedAt: submitted.has(url) ? submittedAt : previous.lastSubmittedAt || "",
        lastStatus: submitted.has(url) ? status : previous.lastStatus || null
      };
    })
  };

  await writeFile(recordPath, JSON.stringify(record, null, 2) + "\n", "utf8");
}

const recordByUrl = await readRecord();
const unrecordedUrls = urls.filter((url) => !recordByUrl.has(url));

const before = String(process.env.INDEXNOW_BEFORE || "").trim();
let changedPaths = null;
if (/^[0-9a-f]{40}$/i.test(before) && !/^0{40}$/i.test(before)) {
  try {
    changedPaths = execFileSync("git", ["diff", "--name-only", before, "HEAD"], {
      cwd: root, encoding: "utf8"
    }).split(/\r?\n/).filter(Boolean);
  } catch {
    console.warn("Cannot inspect previous revision; submitting canonical sitemap URLs.");
  }
}

const allChanged = !changedPaths || changedPaths.some((p) =>
  p === "src/" + key + ".txt" ||
  p === "scripts/build.mjs" ||
  p.startsWith("templates/") ||
  p.startsWith("config/")
);
let selected = urls;
if (!allChanged) {
  const changedUrls = new Set();
  for (const filename of changedPaths) {
    if (filename.startsWith("writing/") && filename.endsWith(".md")) {
      const slug = path.basename(filename, ".md");
      changedUrls.add(siteUrl + "/posts/" + slug);
      changedUrls.add(siteUrl + "/");
      for (const url of urls) if (url.startsWith(siteUrl + "/blog/")) changedUrls.add(url);
    } else if (filename.startsWith("src/") && filename.endsWith(".html")) {
      const rel = filename.slice("src/".length);
      const publicUrl = rel === "index.html" ? siteUrl + "/" :
        rel.endsWith("/index.html") ? siteUrl + "/" + rel.slice(0, -"index.html".length) :
        siteUrl + "/" + rel.replace(/\.html$/, "");
      changedUrls.add(publicUrl);
    }
  }
  for (const url of unrecordedUrls) changedUrls.add(url);
  selected = urls.filter((url) => changedUrls.has(url));
}
if (!selected.length) {
  await writeRecord(recordByUrl);
  console.log("IndexNow: no new or changed indexable pages.");
  process.exit(0);
}

// Confirm the deployed key is publicly accessible before notifying crawlers.
let reachable = false;
for (let attempt = 0; attempt < 8; attempt += 1) {
  try {
    const response = await fetch(keyLocation, { signal: AbortSignal.timeout(10000) });
    if (response.ok && (await response.text()).trim() === key) {
      reachable = true;
      break;
    }
  } catch (error) {
    console.warn("IndexNow key check: " + String(error.message || error));
  }
  await new Promise((resolve) => setTimeout(resolve, 2500));
}
if (!reachable) throw new Error("IndexNow verification file is not yet accessible at " + keyLocation);

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key, keyLocation, urlList: selected }),
  signal: AbortSignal.timeout(30000)
});
const detail = (await response.text()).slice(0, 500);
if (![200, 202].includes(response.status)) {
  throw new Error("IndexNow rejected the URL submission: HTTP " + response.status + " " + detail);
}
await writeRecord(recordByUrl, selected, response.status);
console.log("IndexNow accepted " + selected.length + " page URLs (HTTP " + response.status + ").");
