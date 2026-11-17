// AI-detected issues. The AI returns exact find/replace edits (never a rewritten document),
// which are located in the source and validated before they're offered.

import { genAi } from "../../../genai/firefall";
import { aiCriteria, CRITERIA_BY_ID, DOC_TYPES, ROLES, LEVELS, THRESHOLDS } from "./criteria";
import { validateAiEdit } from "./edits";
import { parseFrontmatter, getField, lineAt, getTextStats, countPassive } from "./markdown-utils";

const MAX_MARKDOWN_CHARS = 60000;
const MAX_TRANSCRIPT_CHARS = 12000;
// When the AI's text appears several times, each occurrence becomes its own selectable edit, up to this many.
const MAX_OCCURRENCES = 5;
// Most suggestions kept per page for style rewrites (passive voice, stacked gerunds).
const STYLE_CAPS = { 96: 8, 97: 8 };

const RESPONSE_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "page_improvements",
    schema: {
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              criterion: { type: "integer" },
              action: { type: "string", enum: ["edit", "flag"] },
              find: { type: "string" },
              replace: { type: "string" },
              reason: { type: "string" },
            },
            required: ["criterion", "action", "find", "replace", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["issues"],
      additionalProperties: false,
    },
  },
};

function systemPrompt(criteria) {
  return {
    message: `You review Markdown source files for Adobe Experience League (experienceleague.adobe.com) enablement pages and propose precise, minimal improvements.

Check the document ONLY against these numbered criteria. The examples inside the criteria (quoted words, sample phrases, dates, and arrows like "whitelist → allowlist") are illustrations only; they are not in the document. Never report an example as an issue. Only report a criterion when the document itself contains a problem.

${criteria.map((cr) => `${cr.id}. ${cr.rule}`).join("\n")}

Return a JSON object {"issues": [...]}. Each issue has:
- "criterion": the criterion number from the list above.
- "action": "edit" to propose a change, or "flag" to report something a person must fix (when the fix needs information you don't have, or the criterion says to flag).
- "find": text copied EXACTLY, character for character, from the "markdown" field of the input (never from these instructions). It must appear exactly once in the document, so include a few surrounding words if needed. Prefer a single line. For flags, "find" is the text the issue is about.
- "replace": the full replacement for "find" (for "edit"), or "" for "flag". To insert text, include the original "find" text plus the new text in "replace".
- "reason": one short sentence explaining the problem.

Rules for edits:
- Make the smallest change that fixes the problem. Don't rewrite text that already meets the criteria, and don't fix things outside the listed criteria.
- Never change URLs, link targets, image paths, code blocks, inline code, frontmatter keys, or Markdown component syntax (for example >[!NOTE], >[!VIDEO](...), {target="_blank"}, +++, {{snippets}}). You may change link text and image alt text.
- In frontmatter, only edit the values of the title and description fields.
- Keep heading levels (the number of #) unchanged.
- Text in curly braces after a heading or link, such as {#create-first-app} or {target="_blank"}, is Markdown syntax, not part of the heading or link text. Ignore it when judging the text, and keep it exactly as it is in any edit.
- Never add or remove [!UICONTROL] or [!DNL] tags; leave existing ones exactly as they are.
- Never rename Adobe products. Only the literal name "Experience Cloud" (and the retired "Marketing Cloud") became "CX Enterprise". Adobe Experience Manager (AEM), Experience Platform (AEP), Experience League, Journey Optimizer, Real-Time CDP, Analytics, Target, Campaign, Workfront, and all other product names are current and must stay exactly as written.
- Never invent facts, features, numbers, or benefits. Use only what the document or the video transcript supports. If a fix would need facts you don't have, use "flag".
- Write in US English, present tense, active voice, and second person, at about an 8th-grade reading level.
- Only report an issue when the quoted "find" text itself breaks the criterion you file it under; a sentence that could merely be phrased better is not an issue. File each issue under the one criterion it actually breaks.
- Most pages break only a few criteria. Returning few issues, or {"issues": []}, is expected and correct. Never return more than 40.`,
  };
}

function userPrompt({ markdown, transcript, docType, facts }) {
  return {
    message: `Review this Experience League page.

${JSON.stringify(
  {
    doc_type: docType || "",
    facts,
    video_transcript: (transcript || "").slice(0, MAX_TRANSCRIPT_CHARS),
    markdown: markdown.slice(0, MAX_MARKDOWN_CHARS),
  },
  null,
  1
)}`,
  };
}

/**
 * The AI sometimes rewrites a heading and drops its trailing attribute block ("## Setup {#setup}" → "## Set up").
 * Put the original block back on the matching line so a good edit isn't discarded for breaking an anchor.
 */
export function restoreAttributeBlocks(find, replace) {
  const isHeading = (line) => /^#{1,6}\s/.test(line);
  const findHeadings = find.split("\n").filter(isHeading);
  const replaceLines = replace.split("\n");
  if (findHeadings.length !== replaceLines.filter(isHeading).length) {
    return replace;
  }

  // Pair headings in order, so a stray trailing newline in "find" doesn't stop the anchor from being restored.
  let h = 0;
  let result = replaceLines
    .map((line) => {
      if (!isHeading(line)) {
        return line;
      }
      const original = findHeadings[h++];
      const block = /(\s*\{[^}\n]*\})\s*$/.exec(original);
      return block && !line.includes(block[1].trim()) ? line.replace(/\s+$/, "") + block[1] : line;
    })
    .join("\n");

  // Keep the original's trailing newline(s), which the AI often drops.
  const trailing = /\n*$/.exec(find)[0];
  if (trailing && !result.endsWith(trailing)) {
    result = result.replace(/\n*$/, "") + trailing;
  }
  return result;
}

/**
 * The AI sometimes files an ordinary rewrite under the wrong criterion (for example an "em dash" fix on text with
 * no em dash). For criteria that can be checked mechanically, the "find" text must actually show the problem.
 * Suggestions that fail are dropped quietly.
 */
const HEADING = /^#{1,6}\s/m;
const STEP = /^\s*\d+\.\s/m;
const LIST = /^\s*([-*+]|\d+\.)\s/m;
const fmValue = (find, key) => {
  const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(find);
  return m ? m[1].replace(/^['"]|['"]$/g, "").trim() : null;
};
const headingText = (find) => ((/^#{1,6}\s+(.*)$/m.exec(find) || [])[1] || "").replace(/\{[^}]*\}/g, "").trim();
const wordCount = (s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;

const passiveCount = countPassive;

const PRECONDITIONS = {
  2: (f) => (fmValue(f, "title") || "").length > THRESHOLDS.TITLE_MAX,
  3: (f) => fmValue(f, "title") !== null,
  5: (f) => fmValue(f, "title") !== null,
  7: (f) => {
    const d = fmValue(f, "description");
    return d !== null && d.length > THRESHOLDS.DESCRIPTION_MAX;
  },
  8: (f) => fmValue(f, "description") !== null,
  11: (f) => fmValue(f, "description") !== null,
  26: (f) => HEADING.test(f),
  27: (f) => HEADING.test(f) && /^\p{L}+ing\b/iu.test(headingText(f)),
  28: (f) => HEADING.test(f) && /\b\p{L}+(ment|ion)s?\b/iu.test(headingText(f)),
  29: (f) => HEADING.test(f) && wordCount(headingText(f)) <= 2,
  30: (f) => HEADING.test(f) && (wordCount(headingText(f)) > 5 || headingText(f).length > 69),
  31: (f) => HEADING.test(f) && /['’,.;:!?]/.test(headingText(f).replace(/^Step\s+\d+:\s*/i, "")),
  33: (f) => HEADING.test(f),
  36: (f) => /^#\s/m.test(f) || fmValue(f, "title") !== null,
  37: (f) => f.split(/(?<=[.!?])\s+/).some((sentence) => wordCount(sentence) > 30),
  38: (f) => /Marketing Cloud|\bDTM\b|Dynamic Tag Management|\bLaunch\b|\bDPS\b|Campaign Classic/.test(f),
  40: (f) => /whitelist|blacklist|\bmaster\b|\bslave\b|white[- ]hat|black[- ]hat|salesman|chairman/i.test(f),
  41: (f) => /\b(he\/she|s\/he|he or she|his\/her|his or her|him\/her|him or her)\b/i.test(f),
  42: (f) => /\bthe\s+(Adobe\s+)?[A-Z]/.test(f),
  43: (f) => /\d/.test(f),
  44: (f, r) => f.includes("—") && !r.includes("—"),
  46: (f) => /["“”]/.test(f),
  47: (f) => /,[^,\n]+\s(and|or)\s/.test(f),
  51: (f) => LIST.test(f),
  53: (f) => STEP.test(f),
  54: (f) => STEP.test(f),
  56: (f) => STEP.test(f),
  57: (f) => /\b(click|select|choose|go to|navigate|open|close|tap|press|button|link)\b/i.test(f),
  58: (f) => STEP.test(f),
  67: (f) => /\[[^\]]*\]\([^)]+\)/.test(f),
  70: (f) => /!\[/.test(f),
  71: (f) => /!\[/.test(f),
  72: (f) => /!\[/.test(f),
  // The rewrite has to actually remove passive constructions, not just reword around them.
  96: (f, r) => passiveCount(f) > 0 && passiveCount(r) < passiveCount(f),
  97: (f) => /\b\p{L}{3,}ing\b/iu.test(f),
  98: (f) => /\bwill\b/i.test(f),
  99: (f) => /\b(the user|users|we|our|us)\b/i.test(f),
  100: (f) => /\b\p{L}+(tion|ment|ance|ence)\b/iu.test(f),
  102: (f) => /\b(simply|just|easily|obviously|basically|very|really|please)\b/i.test(f),
  103: (f) => /\b(it is important to note|note that|there (is|are)|this (article|page|video|guide) (will|explains|describes|shows))\b/i.test(f),
  105: (f) => /\b(powerful|seamless(ly)?|robust|best-in-class|cutting-edge|world-class|innovative|revolutionary|game-changing)\b/i.test(f),
  109: (f) => /\b[A-Z]{2,}s?\b/.test(f),
  111: (f) => /(^|[.!?]\s+)(This|It)\b/.test(f),
  114: (f) => /\bnot\s+(un|in|im|non)\w+|\bnot\s+\w+\s+no\b|n['’]t\s+(\w+\s+)?(no|nothing|never|none)\b/i.test(f),
  124: (f) => HEADING.test(f),
  125: (f) => /\b(it|this feature)\b/i.test(f),
  129: (f) => /\b(quickly|easily|soon|some|several|many|various|appropriate|a few|a lot)\b/i.test(f),
  132: (f) => /^##\s/m.test(f),
};

/** True when the suggestion's text actually shows the problem its criterion is about (or can't be checked). */
/**
 * Any AI rewrite of the title or description must respect the length limits: a rewrite meant to fix
 * the length (2, 6, 7) must land inside them, and any other rewrite mustn't push the field outside them.
 */
const LENGTH_LIMITS = {
  title: { fits: (v) => v.length <= THRESHOLDS.TITLE_MAX, target: `${THRESHOLDS.TITLE_MAX} characters or fewer` },
  description: {
    fits: (v) => v.length <= THRESHOLDS.DESCRIPTION_MAX,
    target: `${THRESHOLDS.DESCRIPTION_MAX} characters or fewer`,
  },
};
const LENGTH_FIXES = { 2: "title", 6: "description", 7: "description" };

/** Returns null when the rewrite is fine, or { key, before, after, mustFix } when it breaks a length limit. */
export function lengthProblem(criterion, find, replace) {
  for (const [key, { fits }] of Object.entries(LENGTH_LIMITS)) {
    const after = fmValue(replace || "", key);
    if (after === null) {
      continue;
    }
    const before = fmValue(find, key);
    const mustFix = LENGTH_FIXES[criterion] === key;
    if ((mustFix || (before !== null && fits(before))) && !fits(after)) {
      return { key, before, after, mustFix };
    }
  }
  return null;
}

export function meetsPrecondition(criterion, find, replace = "") {
  const check = PRECONDITIONS[criterion];
  return !check || check(find, replace || "");
}

/* Page-level checks: some criteria are about the page's structure, which code can confirm directly. */

// Lines that start something other than an ordinary paragraph. Inline tags like [!DNL …] or [!UICONTROL …] are text.
const NON_PARAGRAPH = /^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\||!\[|<|\+\+\+|\{\{)/;

/**
 * Blocks (blank-line separated) between the H1 and the next heading, without hidden content:
 * contextual-help blocks, HTML comments, and {{snippet}} includes.
 */
function introBlocks(text) {
  const fm = parseFrontmatter(text);
  const body = text.slice(fm ? fm.end : 0);
  const h1 = /^#\s.*$/m.exec(body);
  let rest = h1 ? body.slice(h1.index + h1[0].length) : body;
  const next = /^#{1,6}\s/m.exec(rest);
  if (next) {
    rest = rest.slice(0, next.index);
  }
  rest = rest.replace(/<!--[\s\S]*?-->/g, "");
  return rest
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b && !/^>\s*\[!CONTEXTUALHELP\]/i.test(b) && !/^\{\{[^}]*\}\}$/.test(b));
}

/** The paragraph (blank-line-delimited block) that contains a position. */
function paragraphAt(text, pos) {
  const before = text.lastIndexOf("\n\n", pos);
  const after = text.indexOf("\n\n", pos);
  return text.slice(before === -1 ? 0 : before + 2, after === -1 ? text.length : after);
}

/** The section (from the previous heading to the next) that contains a position. */
function sectionAt(text, pos) {
  const headings = [...text.matchAll(/^#{1,6}\s.*$/gm)].map((m) => m.index);
  const start = headings.filter((h) => h <= pos).pop() ?? 0;
  const end = headings.find((h) => h > pos) ?? text.length;
  return text.slice(start, end);
}

// Words that carry no topic: ignored when comparing the H1 with the title.
const STOP_WORDS = new Set("a an and the of in on for to with by from at as or your you how use using about into is are be".split(" "));
const topicWords = (s) =>
  new Set(
    (s.toLowerCase().replace(/\{[^}]*\}/g, "").match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [])
      .map((w) => w.replace(/(ies|es|s)$/, (m) => (m === "ies" ? "y" : "")))
      .filter((w) => !STOP_WORDS.has(w))
  );

/**
 * The H1 is "off topic" only when most of its topic words aren't in the title (or vice versa for a
 * very short H1). An H1 that's a shorter form of the title, such as one without the product name
 * the guide already implies, is a close match.
 */
function h1DriftsFromTitle(text) {
  const title = getField(parseFrontmatter(text), "title")?.value.replace(/^['"]|['"]$/g, "") || "";
  const h1 = (/^#\s+(.*)$/m.exec(text.slice(parseFrontmatter(text)?.end || 0)) || [])[1] || "";
  if (!title || !h1) {
    return false;
  }
  const t = topicWords(title);
  const h = topicWords(h1);
  if (!h.size) {
    return true;
  }
  const shared = [...h].filter((w) => t.has(w)).length;
  return shared / h.size < 0.5;
}

/** Words the edit adds to the heading that the H1 didn't have. */
function addsOnlyWords(find, replace) {
  const before = topicWords(headingText(find));
  const after = topicWords(headingText(replace));
  return [...before].every((w) => after.has(w)) && after.size > before.size;
}

// Passive voice is often fine in technical docs, so it's only rewritten on pages that clearly overuse it
// (over 15%, where the Passive voice metric turns red).
let statsCache = { text: null, stats: null };
const pageStats = (text) => {
  if (statsCache.text !== text) {
    statsCache = { text, stats: getTextStats(text) };
  }
  return statsCache.stats;
};

const PAGE_PRECONDITIONS = {
  96: (text) => pageStats(text).passivePct > 15,
  // H1 doesn't match the title: only when the topics really differ, and never just to append words
  // (usually the product name) to an H1 that already matches.
  36: (text, find, start, replace) => h1DriftsFromTitle(text) && !(HEADING.test(find) && addsOnlyWords(find, replace || "")),
  // Page opens with a note or warning (ignoring hidden contextual-help blocks).
  35: (text) => /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|ADMIN|AVAILABILITY|PREREQUISITES|ERROR|SUCCESS)\]/i.test(introBlocks(text)[0] || ""),
  // No intro paragraph: nothing between the H1 and the next heading is ordinary text
  // (a video or shade box first is fine as long as a paragraph follows).
  90: (text) => !introBlocks(text).some((b) => !NON_PARAGRAPH.test(b)),
  // A heading in "find" is followed directly by a note, list, table, image, link, or another component.
  34: (text, find, start) => {
    const lines = text.slice(start).split("\n");
    for (let i = 0; i < lines.length && i < find.split("\n").length + 1; i++) {
      if (/^#{1,6}\s/.test(lines[i])) {
        const next = lines.slice(i + 1).find((l) => l.trim()) || "";
        if (NON_PARAGRAPH.test(next.trim()) || /^\[[^\]]*\]\(/.test(next.trim())) {
          return true;
        }
      }
    }
    return false;
  },
  // The paragraph really is long.
  108: (text, find, start) => {
    const para = paragraphAt(text, start);
    return wordCount(para) >= 80 || para.split(/(?<=[.!?])\s+/).filter((s) => wordCount(s) >= 3).length >= 5;
  },
  // The section actually contains a numbered procedure.
  142: (text, find, start) => /^\s*\d+\.\s/m.test(sectionAt(text, start)),
  // The page has an FAQ.
  93: (text) => /faq|frequently asked/i.test(text) || /^#{1,6}\s.*\?\s*(\{[^}]*\})?\s*$/m.test(text) || /^\+\+\+.*\?/m.test(text),
  // Video takeaways only matter on pages with a video.
  128: (text) => /\[!VIDEO\]/i.test(text),
};

/** True when the page itself shows the problem (or the criterion has no page-level check). */
export function meetsPagePrecondition(criterion, text, find, start, replace = "") {
  const check = PAGE_PRECONDITIONS[criterion];
  return !check || check(text, find, start, replace);
}

async function runBatch(batch, text, context, contentApiKey) {
  const criteria = aiCriteria(batch);
  const response = await genAi(systemPrompt(criteria), userPrompt({ markdown: text, ...context }), contentApiKey, RESPONSE_SCHEMA);

  if (typeof response === "string") {
    throw new Error(response.replace(/^ERROR:\s*/, ""));
  }

  const allowed = new Set(criteria.map((cr) => cr.id));
  const issues = [];
  const rejected = [];

  // Presence checks are facts the code knows; don't let the AI claim something is missing when it isn't.
  const fm = parseFrontmatter(text);
  const description = (getField(fm, "description")?.value || "").replace(/^['"]|['"]$/g, "").trim();

  // The AI sometimes "finds" the examples from its own instructions instead of text on the page.
  const promptText = systemPrompt(criteria).message;

  for (const item of response?.issues || []) {
    if (!allowed.has(item.criterion)) {
      continue;
    }
    if (item.criterion === 6 && description) {
      continue;
    }
    if (!item.find) {
      continue;
    }
    if (!meetsPrecondition(item.criterion, item.find, item.replace)) {
      continue;
    }

    const occurrences = [];
    for (let pos = text.indexOf(item.find); pos !== -1 && occurrences.length <= MAX_OCCURRENCES; pos = text.indexOf(item.find, pos + 1)) {
      occurrences.push(pos);
    }

    if (!occurrences.length) {
      // Echoed instruction examples are dropped silently; anything else is counted as "not on the page".
      if (!promptText.includes(item.find.trim())) {
        rejected.push({ ...item, why: "text not found in the source", kind: "not-found" });
      }
      continue;
    }
    if (occurrences.length > MAX_OCCURRENCES) {
      rejected.push({ ...item, why: `text appears more than ${MAX_OCCURRENCES} times`, kind: "not-found" });
      continue;
    }

    const crKind = CRITERIA_BY_ID[item.criterion].kind;
    const many = occurrences.length > 1;

    if (!meetsPagePrecondition(item.criterion, text, item.find, occurrences[0], item.replace)) {
      continue;
    }

    occurrences.forEach((start, index) => {
      const end = start + item.find.length;
      const reason = many ? `${item.reason} (occurrence ${index + 1} of ${occurrences.length})` : item.reason;

      if (item.action === "flag" || crKind === "flag") {
        if (index === 0) {
          issues.push({ criterion: item.criterion, action: "flag", start, end, replace: null, reason: item.reason, source: "ai" });
        }
        return;
      }

      // The AI may only change the title and description in frontmatter; other fields are handled by code checks,
      // so suggestions for them are dropped quietly rather than reported.
      if (fm && start < fm.end) {
        const key = (/^([A-Za-z0-9_-]+):/.exec(lineAt(text, start).text) || [])[1] || "";
        if (!["title", "description"].includes(key.toLowerCase())) {
          return;
        }
      }

      const replace = restoreAttributeBlocks(item.find, item.replace);

      // After putting back any dropped {#anchor} blocks, an edit that changes nothing isn't a real suggestion.
      if (replace === item.find) {
        return;
      }

      // LLMs count characters poorly. A length fix that misses the range becomes a manual fix with the real
      // numbers; any other rewrite that pushes the title or description out of range is dropped.
      const tooLong = lengthProblem(item.criterion, item.find, replace);
      if (tooLong) {
        if (tooLong.mustFix && index === 0) {
          const { key, before, after } = tooLong;
          const now = before === null || before === "" ? `The ${key} is empty` : `The ${key} is ${before.length} characters`;
          issues.push({
            criterion: item.criterion,
            action: "flag",
            start,
            end,
            replace: null,
            reason: `${now}; aim for ${LENGTH_LIMITS[key].target}. The AI's rewrite was ${after.length} characters, so it isn't offered.`,
            source: "ai",
          });
        }
        return;
      }

      const problem = validateAiEdit(text, start, end, replace);
      if (problem) {
        if (index === 0) {
          rejected.push({ ...item, why: problem, kind: "unsafe" });
        }
        return;
      }

      issues.push({ criterion: item.criterion, action: "edit", start, end, replace, reason, source: "ai" });
    });
  }

  // Rewrites that are a matter of style are capped so a PR stays reviewable.
  const capped = [];
  const counts = {};
  for (const issue of issues) {
    const cap = STYLE_CAPS[issue.criterion];
    counts[issue.criterion] = (counts[issue.criterion] || 0) + 1;
    if (!cap || counts[issue.criterion] <= cap) {
      capped.push(issue);
    }
  }

  return { issues: capped, rejected };
}

/* ---------- Frontmatter tags: doc-type, role, level ----------
 * One small request of its own, so these can't be crowded out by other suggestions. The AI only names values
 * from fixed lists; the frontmatter lines are written here, so the AI never edits frontmatter keys. */

const unquoteValue = (value) => (value || "").replace(/^['"]|['"]$/g, "").trim();

const TAGS_SCHEMA = {
  type: "json_schema",
  json_schema: {
    name: "page_tags",
    schema: {
      type: "object",
      properties: {
        doc_type: { type: "string", enum: DOC_TYPES },
        doc_type_confidence: { type: "string", enum: ["high", "medium", "low"] },
        doc_type_reason: { type: "string" },
        roles: { type: "array", items: { type: "string", enum: ROLES.map((r) => r.name) } },
        levels: { type: "array", items: { type: "string", enum: LEVELS.map((l) => l.name) } },
        tags_reason: { type: "string" },
      },
      required: ["doc_type", "doc_type_confidence", "doc_type_reason", "roles", "levels", "tags_reason"],
      additionalProperties: false,
    },
  },
};

// Older plain-field values (and the API's display labels) that map onto a current v2 name.
const TAG_ALIASES = {
  administrator: "Admin",
  "business user": "User",
  "business practitioner": "User",
  "business leader": "Leader",
  executive: "Leader",
  advanced: "Experienced",
};

/** Maps names to { name, id } entries from the allowed list, dropping anything unknown. */
function toEntries(names, allowed, max) {
  const out = [];
  for (const raw of names || []) {
    const key = String(raw).trim().toLowerCase();
    const name = (TAG_ALIASES[key] || key).toLowerCase();
    const entry = allowed.find((a) => a.name.toLowerCase() === name);
    if (entry && !out.includes(entry)) {
      out.push(entry);
    }
  }
  return out.slice(0, max);
}

/** Values of a plain field such as "role: Developer, Admin" or a YAML list under it. */
function plainValues(text, fm, key) {
  const field = getField(fm, key);
  if (!field) {
    return [];
  }
  if (unquoteValue(field.value)) {
    return unquoteValue(field.value).split(",").map((v) => v.trim()).filter(Boolean);
  }
  return [...text.slice(field.start, field.end).matchAll(/\n\s*-\s*(.+)/g)].map((m) => unquoteValue(m[1]));
}

function hasV2(text, fm, key) {
  const v2 = getField(fm, `${key}_v2`);
  return !!v2 && /internal-label:\s*\S/.test(text.slice(v2.start, v2.end));
}

/** Inserts (or fills an empty) "<key>_v2:" list with { id, internal-label } entries. */
export function v2Issue(text, fm, key, entries, criterion, reason) {
  const fieldKey = `${key}_v2`;
  const block = `${fieldKey}:\n${entries.map((e) => `  - id: ${e.id}\n    internal-label: ${e.name}`).join("\n")}`;
  const existing = getField(fm, fieldKey);
  if (existing) {
    return { criterion, field: fieldKey, action: "edit", start: existing.start, end: existing.end, replace: block, reason, source: "ai" };
  }
  // Keep v2 tags together: insert after the last existing *_v2 list, otherwise after the description (or title).
  const lastV2 = [...fm.fields].reverse().find((f) => /_v2$/.test(f.key));
  const anchor = lastV2 || getField(fm, "description") || getField(fm, "title");
  const insertAt = anchor ? anchor.end + 1 : fm.end - 4;
  return { criterion, field: fieldKey, action: "edit", start: insertAt, end: insertAt, replace: `${block}\n`, reason, source: "ai" };
}

/** Fills an empty "key:" line, or inserts "key: value" after the description (or title). */
export function fieldIssue(text, fm, key, value, criterion, reason) {
  const field = getField(fm, key);
  if (field && !unquoteValue(field.value)) {
    const lineEnd = text.indexOf("\n", field.start);
    return { criterion, field: key, action: "edit", start: field.start, end: lineEnd === -1 ? field.end : lineEnd, replace: `${key}: ${value}`, reason, source: "ai" };
  }
  const anchor = getField(fm, "description") || getField(fm, "title");
  const insertAt = anchor ? anchor.end + 1 : fm.end - 4;
  return { criterion, field: key, action: "edit", start: insertAt, end: insertAt, replace: `${key}: ${value}\n`, reason, source: "ai" };
}

/**
 * Role and level as v2 lists. When the page already has a plain "role:" / "level:" with valid values, those are
 * converted directly (no AI). Otherwise the AI's pick is used.
 */
export function tagIssues(text, fm, aiRoles, aiLevels, aiReason) {
  const issues = [];
  for (const [key, allowed, max, aiPick] of [
    ["role", ROLES, 3, aiRoles],
    ["level", LEVELS, 2, aiLevels],
  ]) {
    if (hasV2(text, fm, key)) {
      continue;
    }
    const fromPlain = toEntries(plainValues(text, fm, key), allowed, max);
    const entries = fromPlain.length ? fromPlain : toEntries(aiPick, allowed, max);
    if (!entries.length) {
      continue;
    }
    const names = entries.map((e) => e.name).join(", ");
    const reason = fromPlain.length
      ? `Add ${key}_v2 for the existing ${key}: ${names}.`
      : `Suggested ${key}: ${names}. ${aiReason || ""}`.trim();
    issues.push(v2Issue(text, fm, key, entries, 15, reason));
  }
  return issues;
}

async function runTagSuggestions(text, context, contentApiKey) {
  const fm = parseFrontmatter(text);
  if (!fm) {
    return { issues: [], rejected: [] };
  }

  const docTypeField = getField(fm, "doc-type");
  const currentDocType = unquoteValue(docTypeField?.value);

  const response = await genAi(
    {
      message: `You classify Adobe Experience League pages.

1. doc_type: ${CRITERIA_BY_ID[17].rule}
2. roles: the one or two roles the page is created for (never more than three), from exactly this list: ${ROLES.map((r) => `${r.name} (${r.about})`).join("; ")}. Tag only the roles the page is really written for.
3. levels: usually one level (at most two), from exactly this list: ${LEVELS.map((l) => `${l.name} (${l.about})`).join("; ")}.

Return a JSON object with "doc_type", "doc_type_confidence" (high, medium, or low), "doc_type_reason" (one short sentence), "roles", "levels", and "tags_reason" (one short sentence explaining the role and level choice).`,
    },
    {
      message: JSON.stringify(
        {
          current_doc_type: currentDocType,
          facts: context.facts,
          video_transcript: (context.transcript || "").slice(0, 4000),
          markdown: text.slice(0, 20000),
        },
        null,
        1
      ),
    },
    contentApiKey,
    TAGS_SCHEMA
  );

  if (typeof response === "string") {
    throw new Error(response.replace(/^ERROR:\s*/, ""));
  }

  const issues = [];
  const rejected = [];

  // doc-type: always fill when missing; only second-guess an existing value when the AI is confident.
  const docType = DOC_TYPES.find((t) => t.toLowerCase() === String(response?.doc_type || "").toLowerCase());
  if (!docType) {
    rejected.push({ criterion: 17, why: "not a valid doc-type", response });
  } else if (!currentDocType || response.doc_type_confidence === "high") {
    const issue = docTypeIssue(text, fm, docTypeField, docType, response.doc_type_reason);
    if (issue) {
      issues.push(issue);
    }
  }

  issues.push(...tagIssues(text, fm, response?.roles, response?.levels, response?.tags_reason));

  return { issues, rejected };
}

/** Turns a doc-type pick into an insert (when missing) or a manual-fix flag (when the current one doesn't fit). */
export function docTypeIssue(text, fm, docTypeField, value, why = "") {
  if (!value || !fm) {
    return null;
  }

  const current = unquoteValue(docTypeField?.value);

  if (!current) {
    return fieldIssue(text, fm, "doc-type", value, 17, `Suggested doc-type: ${value}. ${why || ""}`.trim());
  }

  if (current.toLowerCase() === value.toLowerCase()) {
    return null;
  }

  return {
    criterion: 17,
    action: "flag",
    start: docTypeField.start,
    end: docTypeField.end,
    replace: null,
    reason: `doc-type is "${current}", but the page looks like a ${value}. ${why || ""}`.trim(),
    source: "ai",
  };
}

/** Runs the AI requests in parallel. Returns { issues, rejected, errors }. */
export async function runAiChecks(text, context, contentApiKey) {
  const results = await Promise.allSettled([
    runBatch("meta", text, context, contentApiKey),
    runBatch("prose", text, context, contentApiKey),
    runTagSuggestions(text, context, contentApiKey),
  ]);

  const issues = [];
  const rejected = [];
  const errors = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      issues.push(...result.value.issues);
      rejected.push(...result.value.rejected);
    } else {
      errors.push(result.reason?.message || String(result.reason));
    }
  }

  return { issues, rejected, errors: [...new Set(errors)] };
}
