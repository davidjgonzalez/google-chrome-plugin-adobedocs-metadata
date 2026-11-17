import { normalizeNewlines } from "./markdown-utils";

const AUTHOR_ORG = "Adobe-Enterprise-Docs";
const MIRROR_ORG = "AdobeDocs";

/**
 * Parses the page's git-edit meta (for example
 * https://github.com/Adobe-Enterprise-Docs/authoring-guide.en/blob/main/help/main-guide/steps.md).
 */
export function parseGitEdit(gitEdit) {
  const match = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/(?:blob|edit|tree)\/([^/]+)\/(.+?)(?:[?#].*)?$/.exec(gitEdit || "");

  if (!match) {
    return null;
  }

  const [, , repo, branch, path] = match;

  return {
    org: AUTHOR_ORG,
    repo,
    branch,
    path,
    blobUrl: `https://github.com/${AUTHOR_ORG}/${repo}/blob/${branch}/${path}`,
    editUrl: `https://github.com/${AUTHOR_ORG}/${repo}/edit/${branch}/${path}`,
    authorRawUrl: `https://github.com/${AUTHOR_ORG}/${repo}/raw/${branch}/${path}`,
    mirrorRawUrl: `https://raw.githubusercontent.com/${MIRROR_ORG}/${repo}/${branch}/${path}`,
  };
}

/** Works out why GitHub answered with an HTML page instead of the raw file. */
function classifyHtml(html, finalUrl = "") {
  const title = (/<title>([^<]*)<\/title>/i.exec(html || "") || [])[1] || "";
  if (/\/login|Sign in to GitHub/i.test(finalUrl + " " + title)) {
    return "signed-out";
  }
  if (/\/sso|single sign-on|saml/i.test(finalUrl + " " + title)) {
    return "sso";
  }
  if (/not found/i.test(title)) {
    return "not-found";
  }
  return title ? `unexpected page: "${title.trim()}"` : "unexpected response";
}

/** Interprets a fetch result: { status, contentType, text, url } → { ok, text } or { ok: false, reason } */
function interpret(result) {
  if (!result) {
    return { ok: false, reason: "no response" };
  }
  if (result.error) {
    return { ok: false, reason: result.error };
  }
  const isHtml = (result.contentType || "").includes("text/html") || /^\s*<!DOCTYPE html/i.test(result.text || "");
  if (result.status >= 200 && result.status < 300 && !isHtml) {
    return { ok: true, text: normalizeNewlines(result.text) };
  }
  if (isHtml) {
    return { ok: false, reason: classifyHtml(result.text, result.url) };
  }
  return { ok: false, reason: result.status === 404 ? "not-found" : `HTTP ${result.status}` };
}

async function fetchDirect(url, options = {}) {
  try {
    const response = await fetch(url, { cache: "no-store", ...options });
    return {
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      text: await response.text(),
      url: response.url,
    };
  } catch (error) {
    return { error: error.message };
  }
}

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, timeoutMs);
    function listener(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve(true);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Reads the raw file from inside a background github.com tab, so the request is first-party and carries
 * the user's GitHub session (and SSO) exactly as if they opened the file themselves.
 */
async function fetchViaGitHubTab(location) {
  let tab;
  try {
    tab = await chrome.tabs.create({ url: location.blobUrl, active: false });
    await waitForTabComplete(tab.id, 20000);

    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [location.authorRawUrl],
      func: async (rawUrl) => {
        try {
          const response = await fetch(rawUrl, { cache: "no-store" });
          return {
            status: response.status,
            contentType: response.headers.get("content-type") || "",
            text: await response.text(),
            url: response.url,
          };
        } catch (error) {
          return { error: error.message, url: location.href };
        }
      },
    });

    // If the tab itself landed on a sign-in or SSO page, report that rather than the fetch result.
    const tabInfo = await chrome.tabs.get(tab.id);
    if (/\/login|\/sso|\/saml/i.test(tabInfo.url || "")) {
      return { status: 401, contentType: "text/html", text: "", url: tabInfo.url };
    }

    return injection?.result;
  } catch (error) {
    return { error: error.message };
  } finally {
    if (tab?.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  }
}

function explain(reason, location) {
  const repo = `${location.org}/${location.repo}`;
  switch (reason) {
    case "signed-out":
      return `You're not signed in to github.com. Sign in, then click Try again.`;
    case "sso":
      return `GitHub needs you to re-authenticate with Adobe SSO for the ${location.org} organization. Open the file on GitHub, complete the SSO sign-in, then click Try again.`;
    case "not-found":
      return `GitHub reports that the file doesn't exist for your account. The most common cause is not being connected to the Adobe VPN. Otherwise, your GitHub account may not have access to ${repo}, or the file lives at a different path in the authoring repo.`;
    default:
      return `GitHub didn't return the file (${reason}). Make sure you're connected to the Adobe VPN.`;
  }
}

/**
 * Loads the page's source markdown:
 *   1. directly from Adobe-Enterprise-Docs with the user's github.com session,
 *   2. if that fails, from inside a background github.com tab (first-party request),
 *   3. if that fails too, from the public AdobeDocs mirror.
 *
 * Returns { ok, text, origin: "author" | "mirror", location, message, diagnostics }
 */
export async function loadSource(gitEdit) {
  const location = parseGitEdit(gitEdit);

  if (!location) {
    return {
      ok: false,
      message: "This page has no git-edit metadata, so its source file can't be located.",
    };
  }

  const diagnostics = [];

  const direct = interpret(await fetchDirect(location.authorRawUrl, { credentials: "include" }));
  if (direct.ok) {
    return { ok: true, text: direct.text, origin: "author", location, diagnostics };
  }
  diagnostics.push(`Direct request: ${direct.reason}`);

  const viaTab = interpret(await fetchViaGitHubTab(location));
  if (viaTab.ok) {
    return { ok: true, text: viaTab.text, origin: "author", location, diagnostics };
  }
  diagnostics.push(`Through a GitHub tab: ${viaTab.reason}`);

  // Prefer the GitHub-tab reason: it reflects exactly what the user sees in their browser.
  const reason = viaTab.reason || direct.reason;
  console.warn("Couldn't load source from Adobe-Enterprise-Docs:", diagnostics);

  const mirror = interpret(await fetchDirect(location.mirrorRawUrl));
  if (mirror.ok) {
    return {
      ok: true,
      text: mirror.text,
      origin: "mirror",
      location,
      diagnostics,
      message: `Loaded from the public AdobeDocs mirror. ${explain(reason, location)} The mirror can lag behind, so the GitHub step re-checks the file before applying changes.`,
    };
  }

  return { ok: false, location, diagnostics, message: explain(reason, location) };
}
