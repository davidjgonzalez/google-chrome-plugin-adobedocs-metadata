// Checks that need the network or the live page: duration, links, captions, thumbnails, and image sizing.

import { THRESHOLDS } from "./criteria";
import { parseFrontmatter, getField, lineAt, getImages, getLinks } from "./markdown-utils";
import { edit, flag } from "./checks-code";
import { getDurations } from "../popup-exl-duration";

export const LINK_CHECK_ORIGINS = ["https://*/*", "http://*/*"];
const LEGACY_HOSTS = /^(?:www\.)?(marketing\.adobe\.com|helpx\.adobe\.com|docs\.adobe\.com)$/i;
const LOGIN_HOSTS = /(login|auth|signin|okta|adobelogin|sso)/i;

export async function hasLinkCheckPermission() {
  try {
    return await chrome.permissions.contains({ origins: LINK_CHECK_ORIGINS });
  } catch (e) {
    return false;
  }
}

/** Must be called directly from a click handler (Chrome requires a user gesture). */
export function requestLinkCheckPermission() {
  return chrome.permissions.request({ origins: LINK_CHECK_ORIGINS }).catch(() => false);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function probe(url) {
  try {
    let response = await withTimeout(fetch(url, { method: "HEAD", redirect: "follow", cache: "no-store" }), 8000);
    if (response.status === 405 || response.status === 403 || response.status === 404) {
      response = await withTimeout(fetch(url, { method: "GET", redirect: "follow", cache: "no-store" }), 10000);
    }
    return { status: response.status, finalUrl: response.url, redirected: response.redirected };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

/** Without host permissions, a no-cors request still tells us whether the server answered at all. */
async function reachable(url) {
  try {
    await withTimeout(fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store" }), 8000);
    return true;
  } catch (e) {
    return false;
  }
}

function sameUrl(a, b) {
  const norm = (u) => u.replace(/#.*$/, "").replace(/\/+$/, "").replace(/^http:/, "https:");
  return norm(a) === norm(b);
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function checkLinks(text, { permitted }) {
  const issues = [];
  const links = getLinks(text).filter((l) => /^https?:\/\//i.test(l.url));
  const unique = [...new Set(links.map((l) => l.url))].slice(0, THRESHOLDS.MAX_LINKS_TO_CHECK);

  const results = await mapLimit(unique, 6, async (url) => {
    const parsed = new URL(url);
    const hash = parsed.hash;

    if (parsed.protocol === "http:") {
      const httpsUrl = "https:" + url.slice(5);
      if (permitted) {
        const result = await probe(httpsUrl);
        if (result.status >= 200 && result.status < 400) {
          const target = result.redirected && !LOGIN_HOSTS.test(new URL(result.finalUrl).hostname) ? result.finalUrl.replace(/#.*$/, "") + hash : httpsUrl;
          return { url, criterion: 59, replace: target, reason: "Use https://." };
        }
        return { url, criterion: 62, flag: `The https:// version of this link didn't respond (${result.status || result.error}).` };
      }
      return (await reachable(httpsUrl)) ? { url, criterion: 59, replace: httpsUrl, reason: "Use https://." } : null;
    }

    if (LEGACY_HOSTS.test(parsed.hostname)) {
      if (permitted) {
        const result = await probe(url);
        if (result.status >= 200 && result.status < 400 && result.finalUrl && !LEGACY_HOSTS.test(new URL(result.finalUrl).hostname)) {
          return { url, criterion: 61, replace: result.finalUrl.replace(/#.*$/, "") + hash, reason: `${parsed.hostname} is being decommissioned; this link redirects to its current location.` };
        }
      }
      return { url, criterion: 61, flag: `${parsed.hostname} is being decommissioned and no redirect was found${permitted ? "" : " (link checking is off)"}. Find the current page for this link.` };
    }

    if (!permitted) {
      return null;
    }

    const result = await probe(url);
    if (result.status === 0) {
      return { url, criterion: 62, flag: `Couldn't connect to this link (${result.error}).` };
    }
    if (result.status === 404 || result.status === 410) {
      return { url, criterion: 62, flag: `This link returns ${result.status}.` };
    }
    if (result.status >= 200 && result.status < 400 && result.redirected && result.finalUrl && !sameUrl(url, result.finalUrl) && !LOGIN_HOSTS.test(new URL(result.finalUrl).hostname)) {
      return { url, criterion: 60, replace: result.finalUrl.replace(/#.*$/, "") + hash, reason: "This link redirects; point it at the final URL." };
    }
    return null;
  });

  for (const result of results.filter(Boolean)) {
    for (const link of links.filter((l) => l.url === result.url)) {
      if (result.flag) {
        issues.push(flag(result.criterion, result.flag, link.start, link.end));
      } else {
        issues.push(edit(result.criterion, link.urlStart, link.urlEnd, result.replace, result.reason));
      }
    }
  }

  return issues;
}

export async function checkDuration(text, exl) {
  const fm = parseFrontmatter(text);
  const field = getField(fm, "duration");
  const current = Number.parseInt((field?.value || "").replace(/['"]/g, ""), 10);

  if (!field || Number.isNaN(current)) {
    return [];
  }

  try {
    const durations = await getDurations(exl.html, exl.videoIds || []);
    const measured = Math.round(durations.total || 0);
    if (!measured) {
      return [];
    }
    const diff = Math.abs(measured - current);
    if (diff > THRESHOLDS.DURATION_TOLERANCE_S && diff > current * THRESHOLDS.DURATION_TOLERANCE_PCT) {
      const line = lineAt(text, field.start);
      return [edit(18, field.valueStart, line.end, String(measured), `Frontmatter says ${current}s, but the page measures about ${measured}s (reading time plus video length).`)];
    }
  } catch (e) {
    console.warn("Duration check failed", e);
  }
  return [];
}

/** Returns { issues, transcript } for videos embedded in the markdown. */
export async function checkVideos(text) {
  const ids = [...new Set([...text.matchAll(/video\.tv\.adobe\.com\/v\/(\d+)/g)].map((m) => m[1]))];
  const issues = [];
  const transcripts = [];

  await Promise.all(
    ids.map(async (id) => {
      try {
        const response = await fetch(`https://video.tv.adobe.com/vc/${id}/eng.json`);
        const json = response.ok ? await response.json() : null;
        const captions = json?.captions || [];
        if (!captions.length) {
          issues.push(flag(78, `Video ${id} has no English captions.`));
        } else {
          transcripts.push(captions.map((c) => c.content).join(" ").replace(/\s+/g, " ").trim());
        }
      } catch (e) {
        issues.push(flag(78, `Couldn't load captions for video ${id}.`));
      }
    })
  );

  return { issues, transcript: transcripts.join("\n\n") };
}

/** Asks the content script on the ExL tab for image sizes as rendered. */
export async function measureRenderedImages() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return await withTimeout(chrome.tabs.sendMessage(tab.id, { text: "measure_images" }), 5000);
  } catch (e) {
    return null;
  }
}

export async function checkImages(text, rendered, { permitted }) {
  const issues = [];
  if (!rendered?.images?.length) {
    return issues;
  }

  const mdImages = getImages(text);
  const pool = [...rendered.images];
  const sameCount = pool.length === mdImages.length;

  const pairs = mdImages.map((img, i) => {
    let match = img.alt ? pool.find((r) => !r.used && r.alt === img.alt) : null;
    if (!match && sameCount && !pool[i].used) {
      match = pool[i];
    }
    if (match) {
      match.used = true;
    }
    return { img, rendered: match };
  });

  for (const { img, rendered: r } of pairs) {
    if (!r || !r.naturalWidth || !r.clientWidth) {
      continue;
    }
    const factor = r.naturalWidth / r.clientWidth;
    if (factor >= THRESHOLDS.ZOOM_FACTOR && /\.png$/i.test(img.path) && !img.linked && !r.inLink && !/zoomable/.test(img.attrs)) {
      const reason = `The screenshot is ${r.naturalWidth}px wide but shown at ${r.clientWidth}px (${factor.toFixed(1)}× smaller), so its text is likely hard to read.`;
      if (img.attrs) {
        issues.push(edit(136, img.end - 1, img.end - 1, ' zoomable="yes"', reason));
      } else {
        issues.push(edit(136, img.end, img.end, '{zoomable="yes"}', reason));
      }
    }
    if (r.clientWidth > r.naturalWidth * 1.1) {
      issues.push(flag(137, `The image is ${r.naturalWidth}px wide but shown at ${r.clientWidth}px, so it's enlarged and may look blurry.`, img.start, img.end));
    }
  }

  if (permitted) {
    await mapLimit(pairs.filter((p) => p.rendered?.src), 6, async ({ img, rendered: r }) => {
      try {
        const response = await withTimeout(fetch(r.src.replace(/\?.*$/, ""), { method: "HEAD" }), 8000);
        const bytes = Number(response.headers.get("content-length"));
        if (bytes > THRESHOLDS.MAX_IMAGE_BYTES) {
          issues.push(flag(74, `This image is ${(bytes / 1024 / 1024).toFixed(1)} MB; keep images under 5 MB.`, img.start, img.end));
        }
      } catch (e) {
        /* size unknown; ignore */
      }
    });
  }

  return issues;
}
