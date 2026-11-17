import { OPTIONS } from "../../../constants";
import { delegateEvent } from "../../../utils";
import { CATEGORIES, CRITERIA, CRITERIA_BY_ID, THRESHOLDS } from "./criteria";
import { escapeHtml, lineOf, getField, parseFrontmatter } from "./markdown-utils";
import { loadSource } from "./source";
import { runCodeChecks } from "./checks-code";
import {
  checkDuration,
  checkLinks,
  checkVideos,
  checkImages,
  measureRenderedImages,
  hasLinkCheckPermission,
  requestLinkCheckPermission,
} from "./checks-measure";
import { runAiChecks } from "./checks-ai";
import { applyEdits, toRelocatable, diffLines } from "./edits";

import { PENDING_KEY } from "./constants";

const CACHE_PREFIX = "adobedocs-improve:";
// Saved results are tied to the build, so they're discarded whenever the extension is rebuilt or updated
// (otherwise results from older check logic would keep showing until Re-analyze).
// eslint-disable-next-line no-undef
const BUILD_ID = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

const state = {
  exl: null,
  contentApiKey: null,
  source: null,
  results: null, // { issues, stats, notes, at }
  selected: new Set(),
  view: "list",
  busy: false,
};

const root = () => document.getElementById("improve-root");

function hash(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `${text.length}:${h}`;
}

function cacheKey() {
  return CACHE_PREFIX + state.exl.currentDoc.url.replace(/[?#].*$/, "");
}

async function saveCache() {
  if (!state.results) {
    return;
  }
  try {
    await chrome.storage.local.set({
      [cacheKey()]: {
        sourceHash: hash(state.source.text),
        buildId: BUILD_ID,
        results: state.results,
        selected: [...state.selected],
      },
    });
  } catch (e) {
    console.warn("Couldn't cache Improve results", e);
  }
}

async function loadCache() {
  try {
    const stored = (await chrome.storage.local.get(cacheKey()))[cacheKey()];
    if (stored && stored.buildId === BUILD_ID && stored.sourceHash === hash(state.source.text)) {
      state.results = stored.results;
      state.selected = new Set(stored.selected);
      return true;
    }
  } catch (e) {
    /* no cache */
  }
  return false;
}

/* ---------- Tab entry points ---------- */

export function getImproveTabHtml() {
  return `<div id="improve-root" class="improve"></div>`;
}

export async function initImproveTab(exl, optionsObj) {
  state.exl = exl;
  state.contentApiKey = optionsObj[OPTIONS.CONTENT_API_KEY];
  registerHandlers();

  root().innerHTML = progressHtml("Checking access to the page's source on GitHub…");

  state.source = await loadSource(exl.gitEdit);

  if (state.source.ok && (await loadCache())) {
    render();
  } else {
    renderStart();
  }
}

/* ---------- Rendering ---------- */

function progressHtml(label) {
  return `<div class="improve-progress"><sp-progress-bar style="width: 100%;" label="${escapeHtml(label)}" indeterminate></sp-progress-bar></div>`;
}

function diagnosticsHtml(s) {
  if (!s.diagnostics?.length) {
    return "";
  }
  return `<details class="improve-diagnostics"><summary>Details</summary><ul>${s.diagnostics.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul></details>`;
}

function sourceStatusHtml() {
  const s = state.source;
  if (!s.ok) {
    return `
      <div class="improve-status improve-status--error">
        <strong>Can't read this page's source markdown.</strong>
        <p>${escapeHtml(s.message)}</p>
        ${s.location ? `<p><a href="${escapeHtml(s.location.blobUrl)}" target="_blank">Open the file on GitHub</a> to check your access.</p>` : ""}
        ${diagnosticsHtml(s)}
        <sp-button size="s" variant="secondary" data-imp-action="retry-source">Try again</sp-button>
      </div>`;
  }
  return `
    <div class="improve-status ${s.origin === "mirror" ? "improve-status--notice" : "improve-status--ok"}">
      Source: <a href="${escapeHtml(s.location.blobUrl)}" target="_blank">${escapeHtml(`${s.location.org}/${s.location.repo}/${s.location.path}`)}</a>
      ${s.origin === "mirror"
        ? `<p>${escapeHtml(s.message)}</p>${diagnosticsHtml(s)}<sp-button size="s" variant="secondary" data-imp-action="retry-source">Try GitHub again</sp-button>`
        : ""}
    </div>`;
}

function renderStart() {
  const ok = state.source.ok;
  root().innerHTML = `
    <p class="improve-intro">
      Check this page against the Experience League authoring guide and style best practices, pick the fixes you want,
      and open them as a pull request on GitHub. You review everything before anything is submitted.
    </p>
    ${sourceStatusHtml()}
    ${!state.contentApiKey ? `<div class="improve-status improve-status--notice">No Content API key is set in the extension options, so only the checks that don't use AI will run.</div>` : ""}
    <label class="improve-option">
      <input type="checkbox" id="improve-check-links" checked>
      Check links for redirects and broken URLs (Chrome asks for permission the first time)
    </label>
    <sp-button data-imp-action="analyze" ${ok ? "" : "disabled"}>Analyze page</sp-button>`;
}

function issueSnippet(issue) {
  const text = state.source.text;
  if (issue.action === "edit") {
    const before = text.slice(issue.start, issue.end);
    if (!before) {
      return `<div class="improve-change"><ins>${escapeHtml(truncate(issue.replace))}</ins></div>`;
    }
    return `<div class="improve-change"><del>${escapeHtml(truncate(before))}</del><span class="improve-arrow">→</span><ins>${escapeHtml(truncate(issue.replace) || "(removed)")}</ins></div>`;
  }
  if (issue.start !== null && issue.start !== undefined) {
    return `<div class="improve-change"><q>${escapeHtml(truncate(text.slice(issue.start, issue.end)))}</q></div>`;
  }
  return "";
}

function truncate(s, max = 220) {
  s = s || "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function tagHtml(kind) {
  const labels = { auto: "Auto", ai: "AI suggestion", flag: "Manual fix" };
  return `<span class="improve-tag improve-tag--${kind}">${labels[kind]}</span>`;
}

function render() {
  const scrollY = window.scrollY;
  if (state.view === "diff") {
    renderDiff();
  } else {
    renderList();
  }
  window.scrollTo(0, scrollY);
}

function selectedEdits() {
  return state.results.issues.filter((i) => i.action === "edit" && state.selected.has(i.id));
}

function actionsHtml() {
  const count = selectedEdits().length;
  // The source only loads with origin "author" when the Adobe-Enterprise-Docs repo is reachable. Otherwise
  // (most often because the user isn't on the Adobe VPN) there's nothing to open and edit on GitHub.
  const canOpenGitHub = state.source?.origin === "author";
  return `
    <div class="improve-actions">
      <span class="improve-actions-count">${count} change${count === 1 ? "" : "s"} selected${canOpenGitHub ? "" : ` · GitHub unavailable (connect to the VPN)`}</span>
      ${state.view === "diff"
        ? `<sp-button size="s" variant="secondary" data-imp-action="back">Back to issues</sp-button>`
        : `<sp-button size="s" variant="secondary" data-imp-action="preview" ${count ? "" : "disabled"}>Preview changes</sp-button>`}
      <sp-button size="s" variant="secondary" data-imp-action="copy" ${count ? "" : "disabled"}>Copy markdown</sp-button>
      <sp-button size="s" variant="accent" data-imp-action="github" ${count && canOpenGitHub ? "" : "disabled"}>Open in GitHub</sp-button>
    </div>`;
}

// good = meets the target, near = close, off = needs work
function rate(value, goodMax, nearMax) {
  return value <= goodMax ? "good" : value <= nearMax ? "near" : "off";
}

function metricsHtml(stats) {
  if (!stats) {
    return "";
  }

  const metric = (label, value, target, status) => `
    <div class="improve-metric improve-metric--${status}">
      <span>${label}</span>
      <strong>${value}</strong>
      <span class="improve-metric-target">Target: ${target}</span>
    </div>`;

  const words = stats.hasVideo
    ? metric("Words", stats.wordCount, `≤ ${THRESHOLDS.MAX_WORDS_VIDEO_PAGE} (video page)`, rate(stats.wordCount, THRESHOLDS.MAX_WORDS_VIDEO_PAGE, THRESHOLDS.MAX_WORDS_VIDEO_PAGE * 1.5))
    : metric("Words", stats.wordCount, `≥ ${THRESHOLDS.MIN_WORDS_NO_VIDEO}`, stats.wordCount >= THRESHOLDS.MIN_WORDS_NO_VIDEO ? "good" : stats.wordCount >= THRESHOLDS.MIN_WORDS_NO_VIDEO / 2 ? "near" : "off");

  return `
    <div class="improve-metrics">
      ${words}
      ${metric("Reading grade", stats.gradeLevel.toFixed(1), "8–10", rate(stats.gradeLevel, 10, THRESHOLDS.MAX_GRADE_LEVEL))}
      ${metric("Avg sentence", `${stats.avgSentenceWords.toFixed(1)} words`, "≤ 20 words", rate(stats.avgSentenceWords, 20, THRESHOLDS.MAX_AVG_SENTENCE_WORDS))}
      ${metric("Passive voice", `~${stats.passivePct}% of sentences`, "≤ 10%", rate(stats.passivePct, 10, 15))}
      ${metric("Gerunds", `${stats.gerundsPer100} per 100 words`, "≤ 2 per 100", rate(stats.gerundsPer100, 2, 3))}
    </div>`;
}

function renderList() {
  const { issues, stats, notes, at } = state.results;
  const open = new Set([...root().querySelectorAll("details[open][data-crit]")].map((d) => d.dataset.crit));
  const edits = issues.filter((i) => i.action === "edit").length;
  const flags = issues.length - edits;

  const byCriterion = new Map();
  for (const issue of issues) {
    if (!byCriterion.has(issue.criterion)) {
      byCriterion.set(issue.criterion, []);
    }
    byCriterion.get(issue.criterion).push(issue);
  }

  const groups = Object.entries(CATEGORIES)
    .map(([cat, catLabel]) => {
      const criteria = CRITERIA.filter((cr) => cr.cat === cat && byCriterion.has(cr.id));
      if (!criteria.length) {
        return "";
      }
      return `
        <div class="improve-category">
          <p class="spectrum-Heading spectrum-Heading--sizeXS improve-category-title">${escapeHtml(catLabel)}</p>
          ${criteria.map((cr) => criterionHtml(cr, byCriterion.get(cr.id), open.has(String(cr.id)))).join("")}
        </div>`;
    })
    .join("");

  root().innerHTML = `
    ${sourceStatusHtml()}
    <div class="improve-summary">
      <strong>${edits}</strong> suggested change${edits === 1 ? "" : "s"} and <strong>${flags}</strong> item${flags === 1 ? "" : "s"} to review.
      <span class="improve-when">Analyzed ${new Date(at).toLocaleString()}</span>
      <sp-button size="s" variant="secondary" quiet data-imp-action="reanalyze">Re-analyze</sp-button>
    </div>
    ${metricsHtml(stats)}
    ${(notes || []).map((n) => `<div class="improve-status improve-status--notice">${n}</div>`).join("")}
    ${groups || `<p>No issues found. Nice work!</p>`}
    ${actionsHtml()}`;

  root().querySelectorAll("input[data-imp-crit]").forEach((el) => {
    const ids = byCriterion.get(Number(el.dataset.impCrit)).filter((i) => i.action === "edit").map((i) => i.id);
    const selected = ids.filter((id) => state.selected.has(id)).length;
    el.checked = selected === ids.length;
    el.indeterminate = selected > 0 && selected < ids.length;
  });
}

function criterionHtml(cr, issues, isOpen) {
  const editable = issues.some((i) => i.action === "edit");
  const kind = editable ? (issues.every((i) => i.source === "ai") ? "ai" : cr.kind === "flag" ? "auto" : cr.kind) : "flag";

  // The checkbox sits inside <summary> so it lines up with the label; clicking an input inside a summary
  // toggles the input, not the details element.
  return `
    <div class="improve-criterion">
      <details data-crit="${cr.id}" ${isOpen ? "open" : ""}>
        <summary>
          ${editable ? `<input type="checkbox" data-imp-crit="${cr.id}" aria-label="Select all: ${escapeHtml(cr.label)}">` : `<span class="improve-spacer"></span>`}
          <span class="improve-criterion-label">${escapeHtml(cr.label)}</span>
          ${tagHtml(kind)}
          <span class="improve-count">${issues.length}</span>
        </summary>
        <ul class="improve-issues">
          ${issues.map((issue) => issueHtml(issue)).join("")}
        </ul>
      </details>
    </div>`;
}

function issueHtml(issue) {
  const line = issue.start !== null && issue.start !== undefined ? `L${lineOf(state.source.text, issue.start)}` : "";
  const checkbox =
    issue.action === "edit"
      ? `<input type="checkbox" data-imp-issue="${issue.id}" ${state.selected.has(issue.id) ? "checked" : ""}>`
      : `<span class="improve-spacer"></span>`;

  return `
    <li class="improve-issue">
      <label>
        ${checkbox}
        <span>
          ${line ? `<span class="improve-line">${line}</span>` : ""}
          ${escapeHtml(issue.reason || "")}
          ${issue.source === "ai" && issue.action === "edit" ? tagHtml("ai") : ""}
        </span>
      </label>
      ${issueSnippet(issue)}
    </li>`;
}

function renderDiff() {
  const result = applyEdits(state.source.text, selectedEdits());
  const hunks = diffLines(state.source.text, result.text);

  root().innerHTML = `
    ${sourceStatusHtml()}
    <div class="improve-summary">
      Preview of <strong>${result.applied.length}</strong> change${result.applied.length === 1 ? "" : "s"}.
      ${result.skipped.length ? `${result.skipped.length} selected change${result.skipped.length === 1 ? " overlaps" : "s overlap"} another change and won't be included.` : ""}
    </div>
    <div class="improve-diff">
      ${hunks
        .map(
          (hunk) => `
        <div class="improve-hunk">
          ${hunk.lines
            .map(
              (l) => `<div class="improve-diff-line improve-diff-line--${l.type}"><span class="improve-diff-no">${l.type === "add" ? "" : l.oldNo}</span><span class="improve-diff-no">${l.type === "del" ? "" : l.newNo}</span><span class="improve-diff-sign">${l.type === "add" ? "+" : l.type === "del" ? "−" : " "}</span><span class="improve-diff-text">${escapeHtml(l.text) || " "}</span></div>`
            )
            .join("")}
        </div>`
        )
        .join("")}
    </div>
    ${actionsHtml()}`;
}

/* ---------- Analysis ---------- */

async function analyze(checkLinksWanted, permissionRequest) {
  state.busy = true;
  const exl = state.exl;
  const text = state.source.text;
  const notes = [];

  root().innerHTML = progressHtml("Analyzing the page…");

  let permitted = false;
  if (checkLinksWanted) {
    permitted = (await permissionRequest) || (await hasLinkCheckPermission());
    if (!permitted) {
      notes.push("Link checking is off because the permission wasn't granted. Only http:// links and legacy domains were checked.");
    }
  }

  const code = runCodeChecks(text, {
    pagePath: exl.currentDoc.path,
    docType: exl.docType,
    gitFilename: exl.gitFilename,
  });

  const rendered = await measureRenderedImages();
  if (!rendered) {
    notes.push("Couldn't measure images on the page (reload the Experience League tab and re-analyze to include image sizing).");
  }

  const [duration, videos, images, links] = await Promise.all([
    checkDuration(text, exl),
    checkVideos(text),
    checkImages(text, rendered, { permitted }),
    checkLinksWanted ? checkLinks(text, { permitted }) : Promise.resolve([]),
  ]);

  let ai = { issues: [], rejected: [], errors: [] };
  if (state.contentApiKey) {
    root().innerHTML = progressHtml("Asking the AI for suggestions (this can take a minute)…");
    const fm = parseFrontmatter(text);
    ai = await runAiChecks(
      text,
      {
        transcript: videos.transcript,
        docType: code.docType,
        facts: {
          title_length: (getField(fm, "title")?.value || "").replace(/^['"]|['"]$/g, "").length,
          description_length: (getField(fm, "description")?.value || "").replace(/^['"]|['"]$/g, "").length,
          word_count: code.stats.wordCount,
          has_video: code.hasVideo,
          // Signals for the doc-type suggestion.
          video_count: (text.match(/\[!VIDEO\]/gi) || []).length,
          numbered_steps: (text.match(/^\s*\d+\.[ \t]/gm) || []).length,
          code_blocks: Math.floor((text.match(/^[ \t]*```/gm) || []).length / 2),
          links: (text.match(/\]\([^)]+\)/g) || []).length,
        },
      },
      state.contentApiKey
    );
    if (ai.errors.length) {
      notes.push(`Some AI suggestions couldn't be generated: ${escapeHtml(ai.errors.join("; "))}`);
    }
    // Suggestions whose text isn't on the page are just noise for the author: count them in one muted line.
    const notFound = ai.rejected.filter((r) => r.kind === "not-found");
    const unsafe = ai.rejected.filter((r) => r.kind !== "not-found");
    if (notFound.length) {
      notes.push(`<span class="improve-muted">${notFound.length} AI suggestion${notFound.length === 1 ? "" : "s"} referred to text that isn't on this page and ${notFound.length === 1 ? "was" : "were"} ignored.</span>`);
    }
    if (unsafe.length) {
      const items = unsafe
        .map((r) => {
          const label = CRITERIA_BY_ID[r.criterion]?.label || `Criterion ${r.criterion}`;
          const snippet = r.find ? `<div class="improve-change"><q>${escapeHtml(truncate(r.find, 160))}</q>${r.replace ? `<span class="improve-arrow">→</span><ins>${escapeHtml(truncate(r.replace, 160))}</ins>` : ""}</div>` : "";
          return `<li><strong>${escapeHtml(label)}</strong>: ${escapeHtml(r.why)}${snippet}</li>`;
        })
        .join("");
      notes.push(
        `<details class="improve-diagnostics"><summary>${unsafe.length} AI suggestion${unsafe.length === 1 ? " was" : "s were"} left out because ${unsafe.length === 1 ? "it" : "they"} would have changed something that must stay the same.</summary><ul>${items}</ul></details>`
      );
    }
    if (ai.rejected.length) {
      console.info("Discarded AI suggestions:", ai.rejected);
    }
  } else {
    notes.push("AI suggestions are off because no Content API key is set in the extension options.");
  }

  // When the AI fills in doc-type, role, or level, drop the plain "missing" flag so it isn't listed twice.
  const aiDocType = ai.issues.some((i) => i.criterion === 17);
  const aiTags = new Set(ai.issues.filter((i) => i.criterion === 15).map((i) => i.field?.replace(/_v2$/, "")));
  const deterministic = [...code.issues, ...duration, ...videos.issues, ...images, ...links].filter(
    (i) => !(aiDocType && i.criterion === 17) && !(i.criterion === 15 && i.missing?.every((m) => aiTags.has(m)))
  );
  const deterministicEdits = deterministic.filter((i) => i.action === "edit");

  // AI edits that overlap a deterministic edit are dropped; the deterministic fix wins.
  const aiIssues = ai.issues.filter(
    (i) => i.action === "flag" || !deterministicEdits.some((d) => i.start < Math.max(d.end, d.start + 1) && Math.max(i.end, i.start + 1) > d.start)
  );

  const seen = new Set();
  const order = new Map(CRITERIA.map((cr, index) => [cr.id, index]));
  const issues = [...deterministic, ...aiIssues]
    .filter((i) => {
      const key = `${i.criterion}|${i.start}|${i.end}|${i.replace}|${i.action}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((a, b) => order.get(a.criterion) - order.get(b.criterion) || (a.start ?? -1) - (b.start ?? -1))
    .map((issue, index) => ({ ...issue, id: `i${index}` }));

  state.results = { issues, stats: { ...code.stats, hasVideo: code.hasVideo }, notes, at: Date.now() };
  state.selected = new Set(issues.filter((i) => i.action === "edit" && CRITERIA_BY_ID[i.criterion].defaultChecked).map((i) => i.id));
  state.view = "list";
  state.busy = false;

  await saveCache();
  render();
}

/* ---------- Actions ---------- */

function buildCommit(applied) {
  const fileName = state.source.location.path.split("/").pop();
  const counts = new Map();
  applied.forEach((e) => counts.set(e.criterion, (counts.get(e.criterion) || 0) + 1));

  const lines = [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, count]) => `- ${CRITERIA_BY_ID[id].label}${count > 1 ? ` (${count})` : ""}`);

  return {
    title: `Content improvements for ${fileName}`,
    body: `Fixes:\n${lines.join("\n")}\n\nChanges proposed by the AdobeDocs metadata Chrome extension and selected by the author.`,
  };
}

async function copyMarkdown() {
  const result = applyEdits(state.source.text, selectedEdits());
  await navigator.clipboard.writeText(result.text);
  return result;
}

async function openInGitHub() {
  const result = applyEdits(state.source.text, selectedEdits());
  const commit = buildCommit(result.applied);
  const loc = state.source.location;

  await chrome.storage.local.set({
    [PENDING_KEY]: {
      path: `/${loc.org}/${loc.repo}/edit/${loc.branch}/${loc.path}`,
      base: state.source.text,
      newText: result.text,
      relocatable: toRelocatable(state.source.text, result.applied),
      commitTitle: commit.title,
      commitBody: commit.body,
      createdAt: Date.now(),
    },
  });

  // Clipboard fallback in case the GitHub page can't be filled in automatically.
  try {
    await navigator.clipboard.writeText(result.text);
  } catch (e) {
    /* best effort */
  }

  chrome.tabs.create({ url: loc.editUrl });
}

function flash(message) {
  const el = document.createElement("div");
  el.className = "improve-flash";
  el.textContent = message;
  root().appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

let handlersRegistered = false;

function registerHandlers() {
  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  delegateEvent("body", "click", "[data-imp-action]", async function (event) {
    if (this.hasAttribute("disabled") || state.busy) {
      return;
    }
    const action = this.dataset.impAction;

    if (action === "analyze" || action === "reanalyze") {
      const linksBox = document.getElementById("improve-check-links");
      const wantLinks = linksBox ? linksBox.checked : true;
      // The permission prompt must start synchronously inside the click handler.
      const permissionRequest = wantLinks ? requestLinkCheckPermission() : Promise.resolve(false);
      if (action === "reanalyze") {
        state.source = await loadSource(state.exl.gitEdit);
        if (!state.source.ok) {
          renderStart();
          return;
        }
      }
      analyze(wantLinks, permissionRequest);
    } else if (action === "retry-source") {
      root().innerHTML = progressHtml("Checking access to the page's source on GitHub…");
      state.source = await loadSource(state.exl.gitEdit);
      if (state.source.ok && (await loadCache())) {
        render();
      } else {
        renderStart();
      }
    } else if (action === "preview") {
      state.view = "diff";
      render();
    } else if (action === "back") {
      state.view = "list";
      render();
    } else if (action === "copy") {
      const result = await copyMarkdown();
      flash(`Copied the updated markdown (${result.applied.length} changes).`);
    } else if (action === "github") {
      await openInGitHub();
    }
  });

  delegateEvent("body", "change", "[data-imp-crit]", function () {
    const id = Number(this.dataset.impCrit);
    state.results.issues
      .filter((i) => i.criterion === id && i.action === "edit")
      .forEach((i) => (this.checked ? state.selected.add(i.id) : state.selected.delete(i.id)));
    saveCache();
    render();
  });

  delegateEvent("body", "change", "[data-imp-issue]", function () {
    this.checked ? state.selected.add(this.dataset.impIssue) : state.selected.delete(this.dataset.impIssue);
    saveCache();
    render();
  });
}
