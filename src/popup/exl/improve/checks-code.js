// Deterministic checks that run on the source markdown without AI or network access.

import { THRESHOLDS } from "./criteria";
import {
  MASK,
  parseFrontmatter,
  getField,
  getCodeBlockRanges,
  inRanges,
  getProseMask,
  lineAt,
  getHeadings,
  getImages,
  getLinks,
  getSections,
  getTextStats,
  getPlainText,
  countWords,
  slugify,
} from "./markdown-utils";

export function edit(criterion, start, end, replace, reason) {
  return { criterion, action: "edit", start, end, replace, reason, source: "code" };
}

export function flag(criterion, reason, start = null, end = null) {
  return { criterion, action: "flag", start, end, replace: null, reason, source: "code" };
}

function matchCase(original, replacement) {
  if (original && original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/** Runs a regex over prose only (masked text) and returns edits. */
function proseReplace(text, mask, criterion, regex, replacer, reason) {
  const issues = [];
  let match;
  regex.lastIndex = 0;

  while ((match = regex.exec(mask))) {
    if (match[0].includes(MASK)) {
      continue;
    }
    const original = text.slice(match.index, match.index + match[0].length);
    const replacement = replacer(original, match);
    if (replacement !== original) {
      issues.push(edit(criterion, match.index, match.index + match[0].length, replacement, reason(original, replacement)));
    }
  }

  return issues;
}

/** Range of a frontmatter field's value on its first line. */
function valueRange(text, field) {
  const line = lineAt(text, field.start);
  return { start: field.valueStart, end: line.end };
}

function unquote(value) {
  const m = /^(['"])(.*)\1$/.exec(value.trim());
  return m ? { quote: m[1], inner: m[2] } : { quote: "", inner: value.trim() };
}

function removeFieldEdit(criterion, text, field, reason) {
  const end = text[field.end] === "\n" ? field.end + 1 : field.end;
  return edit(criterion, field.start, end, "", reason);
}

function listValues(text, field) {
  if (!field) {
    return [];
  }
  if (field.value) {
    return unquote(field.value).inner.split(",").map((v) => v.trim()).filter(Boolean);
  }
  return text
    .slice(field.start, field.end)
    .split("\n")
    .slice(1)
    .map((l) => l.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function monthsSince(dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || "");
  if (!m) {
    return null;
  }
  const then = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const now = new Date();
  return (now.getUTCFullYear() - then.getUTCFullYear()) * 12 + (now.getUTCMonth() - then.getUTCMonth());
}

function currentGuide(pagePath) {
  const m = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?docs\/([^/]+)\//i.exec(pagePath || "");
  return m ? m[1].toLowerCase() : null;
}

function exlGuide(url) {
  const m = /^https?:\/\/experienceleague(?:\.corp)?\.adobe\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?docs\/([^/?#]+)/i.exec(url);
  return m ? m[1].toLowerCase() : null;
}

export function runCodeChecks(text, context) {
  const issues = [];
  const fm = parseFrontmatter(text);
  const mask = getProseMask(text);
  const codeRanges = getCodeBlockRanges(text);
  const headings = getHeadings(text);
  const images = getImages(text);
  const links = getLinks(text);
  const stats = getTextStats(text);
  const hasVideo = /\[!VIDEO\]/i.test(text);
  const docType = (getField(fm, "doc-type")?.value || context.docType || "").replace(/['"]/g, "");

  /* A. Title and description */
  const title = getField(fm, "title");
  const description = getField(fm, "description");

  if (!title || !unquote(title.value).inner) {
    issues.push(flag(1, "The page has no `title` frontmatter."));
  } else {
    const range = valueRange(text, title);
    const { quote, inner } = unquote(text.slice(range.start, range.end));

    if (inner.includes("|")) {
      const fixed = inner.split("|")[0].trim();
      issues.push(edit(4, range.start, range.end, `${quote}${fixed}${quote}`, "The site appends \" | Adobe <Product>\" automatically, so the title shouldn't include it."));
    }
  }

  for (const field of [title, description].filter(Boolean)) {
    const range = valueRange(text, field);
    const value = text.slice(range.start, range.end);
    if (/Experience Cloud/.test(value)) {
      const fixed = value.replace(/Adobe Experience Cloud/g, "Adobe CX Enterprise").replace(/Experience Cloud/g, "CX Enterprise");
      issues.push(edit(9, range.start, range.end, fixed, `"Experience Cloud" is now "CX Enterprise" in ${field.key} metadata.`));
    }
  }

  /* B. Other frontmatter */
  if (fm) {
    for (const field of fm.fields) {
      const key = field.key.toLowerCase();
      if (key === "seo-title" || key === "seo-description") {
        issues.push(removeFieldEdit(12, text, field, `\`${field.key}\` is deprecated; search engines use \`title\` and \`description\`.`));
      } else if (key === "feature-set" || key === "sub-feature" || key === "subfeature") {
        issues.push(removeFieldEdit(13, text, field, `\`${field.key}\` is deprecated in v2; feature values are tied to products.`));
      } else if (key === "exl-id") {
        issues.push(removeFieldEdit(14, text, field, "`exl-id` is legacy and no longer added to v2 articles. Only remove it if nothing else relies on it."));
      }
    }
  }

  // v2 metadata stores tags as lists of { id, internal-label }; fall back to those when the plain field is absent.
  const tagValues = (key) => {
    const plain = listValues(text, getField(fm, key));
    if (plain.length) {
      return plain;
    }
    const v2 = getField(fm, `${key}_v2`);
    return v2 ? [...text.slice(v2.start, v2.end).matchAll(/internal-label:\s*(.+)/g)].map((m) => m[1].trim()) : [];
  };
  const role = getField(fm, "role") || getField(fm, "role_v2");
  const roles = tagValues("role");
  const levels = tagValues("level");
  if (!roles.length || !levels.length) {
    const missing = [!roles.length && "role", !levels.length && "level"].filter(Boolean);
    issues.push({ ...flag(15, `Missing ${missing.join(" and ")}; without ${missing.length > 1 ? "them" : "it"} the page doesn't show "Created for".`), missing });
  }
  if (roles.length > THRESHOLDS.MAX_ROLES) {
    issues.push(flag(16, `${roles.length} roles are tagged (${roles.join(", ")}). The guide warns that tagging many roles dilutes them.`, role.start, role.end));
  }
  if (!getField(fm, "doc-type")?.value) {
    issues.push(flag(17, "No `doc-type` frontmatter."));
  }

  const lsu = getField(fm, "last-substantial-update");
  if (lsu) {
    const months = monthsSince(unquote(lsu.value).inner);
    if (months !== null && months > THRESHOLDS.STALE_MONTHS) {
      issues.push(flag(19, `Last substantial update was ${months} months ago; review whether the content is still current.`, lsu.start, lsu.end));
    }

    // Valid: YYYY-MM-DD or a full timestamp like 2026-08-28T00:00:00.000Z. Anything else that starts with a
    // date is trimmed to YYYY-MM-DD; values that aren't dates at all are flagged.
    const { inner } = unquote(lsu.value);
    if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z)?$/.test(inner)) {
      const date = /^(\d{4}-\d{2}-\d{2})\b/.exec(inner);
      if (date) {
        const range = valueRange(text, lsu);
        issues.push(edit(20, range.start, range.end, date[1], `Use YYYY-MM-DD (or a full timestamp like ${date[1]}T00:00:00.000Z): "${inner}" → "${date[1]}".`));
      } else {
        issues.push(flag(20, inner ? `"${inner}" isn't a valid date; use YYYY-MM-DD (or a full timestamp like 2026-08-28T00:00:00.000Z).` : "last-substantial-update is empty; set it to a YYYY-MM-DD date or remove the field.", lsu.start, lsu.end));
      }
    }
  }


  /* C. Headings */
  const h1s = headings.filter((h) => h.level === 1);
  if (h1s.length !== 1) {
    issues.push(flag(23, h1s.length === 0 ? "The page has no H1." : `The page has ${h1s.length} H1 headings; it should have exactly one.`, h1s[1]?.start ?? null, h1s[1]?.end ?? null));
  }

  for (const heading of headings) {
    const badge = /\s*\[!BADGE[^\]]*\](\{[^}]*\})?/i.exec(text.slice(heading.start, heading.end));
    if (badge) {
      const start = heading.start + badge.index;
      issues.push(edit(32, start, start + badge[0].length, "", "Badges and other markup don't belong in heading text."));
    }
  }

  /* D. Style and terminology */

  // Only the literal "Experience Cloud" was renamed. "Adobe CX Enterprise" on first mention, then "CX Enterprise".
  // Skips "Experience Cloud ID" (a service name) and bold text (usually a UI label).
  const ecRe = /\b(Adobe\s+)?Experience Cloud\b(?!\s+ID)/g;
  let mentioned = null;
  let ec;
  while ((ec = ecRe.exec(mask))) {
    if (ec[0].includes(MASK)) {
      continue;
    }
    const lineStart = mask.lastIndexOf("\n", ec.index) + 1;
    if (((text.slice(lineStart, ec.index).match(/\*\*/g) || []).length) % 2 === 1) {
      continue;
    }
    if (mentioned === null) {
      mentioned = /CX Enterprise/.test(mask.slice(0, ec.index));
    }
    const replacement = mentioned ? "CX Enterprise" : "Adobe CX Enterprise";
    mentioned = true;
    issues.push(edit(39, ec.index, ec.index + ec[0].length, replacement, `"Experience Cloud" is now "CX Enterprise" ("Adobe CX Enterprise" on first mention).`));
  }

  issues.push(
    // Skip ALL-CAPS placeholders (FILENAME) and words attached to inline code (FILENAME`.conf`) or other identifiers.
    ...proseReplace(text, mask, 45, /(?<![\w\u0000.$/-])filenames?(?![\w\u0000$/-]|\.\w)/gi, (o) => (o === o.toUpperCase() || /[a-z][A-Z]/.test(o) ? o : matchCase(o, o.toLowerCase().endsWith("s") ? "file names" : "file name")), () => "Use \"file name\" (two words) in prose."),
    ...proseReplace(text, mask, 45, /\b(?:drop-?down (?:list|box)|drop-down menu|listbox)(es)?\b/gi, (o) => matchCase(o, "dropdown menu"), (o) => `Use "dropdown menu", not "${o}".`)
  );

  /* E. Lists and steps */
  const numbered = /^([ \t]*)(\d+)\.(?=[ \t])/gm;
  let match;
  while ((match = numbered.exec(text))) {
    if (inRanges(match.index, codeRanges) || (fm && match.index < fm.end) || match[2] === "1") {
      continue;
    }
    const start = match.index + match[1].length;
    issues.push(edit(49, start, start + match[2].length, "1", "Start every numbered item with `1.` and let the site number them."));
  }

  const listItem = /^[ \t]*(?:[-*+]|\d+\.)[ \t].*?([;,])[ \t]*$/gm;
  while ((match = listItem.exec(text))) {
    if (inRanges(match.index, codeRanges) || (fm && match.index < fm.end)) {
      continue;
    }
    const pos = match.index + match[0].lastIndexOf(match[1]);
    issues.push(edit(52, pos, pos + 1, "", `List items shouldn't end with "${match[1]}".`));
  }

  // Procedures: runs of top-level numbered items.
  const lines = text.split("\n");
  let offset = 0;
  let run = null;
  const closeRun = () => {
    if (run && run.count > THRESHOLDS.MAX_STEPS) {
      issues.push(flag(55, `This procedure has ${run.count} steps; the guide suggests about 7 at most. Consider splitting it into subtasks.`, run.start, run.start + 3));
    }
    run = null;
  };
  for (const line of lines) {
    if (!inRanges(offset, codeRanges)) {
      if (/^\d+\.[ \t]/.test(line)) {
        run = run || { start: offset, count: 0 };
        run.count++;
      } else if (line.trim() && !/^[ \t]/.test(line)) {
        closeRun();
      }
    }
    offset += line.length + 1;
  }
  closeRun();

  /* F. Links */
  const anchors = new Set(headings.map((h) => slugify(h.text)));
  (text.match(/\{#([^}]+)\}/g) || []).forEach((a) => anchors.add(a.slice(2, -1)));
  for (const link of links) {
    if (link.url.startsWith("#") && link.url.length > 1 && !anchors.has(decodeURIComponent(link.url.slice(1)))) {
      issues.push(flag(63, `No heading on this page matches the anchor "${link.url}".`, link.start, link.end));
    }
  }

  const bareUrl = /https?:\/\/[^\s<>()\[\]\u0000]+/g;
  while ((match = bareUrl.exec(mask))) {
    const before = mask[match.index - 1];
    const lineStart = mask.lastIndexOf("\n", match.index) + 1;
    const prefix = mask.slice(lineStart, match.index);
    if ((before && !/\s/.test(before)) || prefix.lastIndexOf("[") > prefix.lastIndexOf("]")) {
      continue;
    }
    const url = match[0].replace(/[.,;:!?'"’)]+$/, "");
    // Local and placeholder URLs are shown as text on purpose; don't turn them into links.
    if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|(www\.)?example\.(com|org|net))([:/]|$)/i.test(url)) {
      continue;
    }
    // Sample sites (WKND, We.Retail), placeholder URLs, and URLs quoted in error or log output aren't real links.
    const lineText = text.slice(lineStart, text.indexOf("\n", match.index) === -1 ? text.length : text.indexOf("\n", match.index));
    if (
      /^https?:\/\/([\w-]+\.)*(we-retail|weretail|wknd)[\w-]*\./i.test(url) ||
      /xxx|\$\{|%7B|\{\{|your-|<[^>]*>|\*\*\*/i.test(url) ||
      /\b(error|exception|warn(ing)?|returned http|status code)\b|\bHTTP\s\d{3}\b/i.test(lineText) ||
      // Values to copy rather than pages to visit: table cells, "for example" values, and environment-specific hosts.
      /^\s*\|/.test(lineText) ||
      /\b(for example|e\.g\.|such as)\b/i.test(lineText) ||
      /^https?:\/\/(author|publish|preview)-p\d+-e\d+/i.test(url)
    ) {
      continue;
    }
    issues.push(edit(64, match.index, match.index + url.length, `<${url}>`, "Bare URLs aren't turned into links; wrap them in < >."));
  }

  const guide = currentGuide(context.pagePath);
  for (const link of links) {
    const target = exlGuide(link.url);
    if (!target || !guide) {
      continue;
    }
    if (target === guide) {
      issues.push(flag(68, "Absolute link to a page in the same guide; a relative link to the .md file is preferred.", link.start, link.end));
    } else if (!/target\s*=/.test(link.attrs)) {
      if (link.attrs) {
        const pos = link.end - link.attrs.length + 1;
        issues.push(edit(69, pos, pos, 'target="_blank" ', "Links to a different guide should open in a new tab."));
      } else {
        issues.push(edit(69, link.end, link.end, '{target="_blank"}', "Links to a different guide should open in a new tab."));
      }
    }
  }

  /* G. Images and video */
  if (images.length > THRESHOLDS.MAX_IMAGES) {
    issues.push(flag(73, `The page has ${images.length} images; the limit is ${THRESHOLDS.MAX_IMAGES}.`));
  }

  for (const link of links) {
    if (/(youtube\.com|youtu\.be|vimeo\.com)\//i.test(link.url) || /\.(mp4|mov|webm)(\?|$)/i.test(link.url)) {
      issues.push(flag(76, "Videos must be hosted on Adobe MPC (video.tv.adobe.com), not third-party sites or direct video files.", link.start, link.end));
    }
  }

  const videoRe = /\[!VIDEO\]\((https?:\/\/video\.tv\.adobe\.com\/v\/(\d+)[^)\s]*)\)/gi;
  while ((match = videoRe.exec(text))) {
    if (inRanges(match.index, codeRanges)) {
      continue;
    }
    const original = match[1];
    let params;
    try {
      params = new URL(original).searchParams;
    } catch (e) {
      continue;
    }
    params.delete("learn");
    params.delete("enablevpops");
    const rest = params.toString();
    const normalized = `https://video.tv.adobe.com/v/${match[2]}/?learn=on&enablevpops${rest ? "&" + rest : ""}`;
    if (normalized !== original) {
      const start = match.index + match[0].indexOf(original);
      issues.push(edit(77, start, start + original.length, normalized, "Use the standard MPC embed URL with learn=on and enablevpops."));
    }
  }

  /* H. Badges */
  const badgeFields = (fm?.fields || []).filter((f) => /^badge/i.test(f.key));
  if (badgeFields.length > 2) {
    issues.push(flag(88, `${badgeFields.length} metadata badges are set; the maximum is two.`));
  }
  const newBadge = /\[!BADGE\s+New\b[^\]]*\]|label="New"/gi;
  while ((match = newBadge.exec(text))) {
    issues.push(flag(88, "Avoid time-sensitive badges like \"New\".", match.index, match.index + match[0].length));
  }

  /* K. Concision */
  const wordy = [
    [/\bin order to\b/gi, "to"],
    [/\butiliz(?:e|es|ed|ing)\b/gi, (o) => ({ e: "use", es: "uses", ed: "used", ing: "using" })[o.toLowerCase().replace("utiliz", "")]],
    [/\butilization\b/gi, "use"],
    [/\bat this point in time\b/gi, "now"],
    [/\b(?:has|have) the ability to\b/gi, "can"],
    [/\b(?:is|are) able to\b/gi, "can"],
    [/\bprior to\b/gi, "before"],
    [/\bin the event that\b/gi, "if"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bfor the purpose of\b/gi, "for"],
    [/\ba large number of\b/gi, "many"],
  ];
  for (const [re, replacement] of wordy) {
    issues.push(
      ...proseReplace(text, mask, 101, re, (o) => matchCase(o, typeof replacement === "function" ? replacement(o) : replacement), (o, r) => `"${o}" → "${r}"`)
    );
  }

  /* L. Readability */
  if (stats.wordCount >= 150 && stats.gradeLevel > THRESHOLDS.MAX_GRADE_LEVEL) {
    issues.push(flag(106, `Reading level is about grade ${stats.gradeLevel.toFixed(1)}; aim for grade 8–10 where the subject allows.`));
  }
  if (stats.wordCount >= 150 && stats.avgSentenceWords > THRESHOLDS.MAX_AVG_SENTENCE_WORDS) {
    issues.push(flag(107, `Sentences average ${stats.avgSentenceWords.toFixed(1)} words.`));
  }

  issues.push(
    ...proseReplace(text, mask, 112, /\b(e\.g\.|i\.e\.),?(?=\s)/gi, (o) => matchCase(o, o.toLowerCase().startsWith("e") ? "for example," : "that is,"), (o, r) => `"${o}" → "${r}"`),
    ...proseReplace(text, mask, 113, /(?<=[\p{L}\p{N})"”])!(?=\s|$)/gu, () => ".", () => "Avoid exclamation marks in instructional text.")
  );

  /* M. Amount of text */
  const readingMinutes = stats.wordCount / 275;
  if (!hasVideo && stats.wordCount < THRESHOLDS.MIN_WORDS_NO_VIDEO) {
    issues.push(flag(115, `Only ${stats.wordCount} words and no video; the page may be too thin to be useful.`));
  }
  if (hasVideo && /video|presentation/i.test(docType) && stats.wordCount > THRESHOLDS.MAX_WORDS_VIDEO_PAGE) {
    issues.push(flag(116, `${stats.wordCount} words on a ${docType} page; video pages work best with a short intro and key takeaways.`));
  }
  if (!hasVideo && readingMinutes > THRESHOLDS.MAX_READING_MINUTES_NO_VIDEO) {
    issues.push(flag(117, `About ${Math.round(readingMinutes)} minutes of reading with no video; consider splitting the page.`));
  }

  const admonitions = text.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO|ADMIN|AVAILABILITY|PREREQUISITES|ERROR|SUCCESS)\]/gim) || [];
  if (admonitions.length >= 3 && admonitions.length > stats.wordCount / THRESHOLDS.WORDS_PER_ADMONITION) {
    issues.push(flag(120, `${admonitions.length} notes or warnings for ${stats.wordCount} words; too many admonitions make a page hard to scan.`));
  }

  for (const section of getSections(text)) {
    const body = section.heading ? section.text.slice(section.heading.end - section.start) : section.text;
    // Lists, images, code, tables, components (tabs, notes, shade boxes), accordions, and HTML layout all break up text.
    const hasBreak = /^\s*([-*+]|\d+\.)\s|!\[|```|^\s*\||^>\s*\[!|^\+\+\+|<(table|div|ul|ol)\b/m.test(body);
    const words = countWords(getPlainText(body));
    if (!hasBreak && words > THRESHOLDS.MAX_SECTION_WORDS) {
      issues.push(flag(118, `${words} words under "${section.heading ? section.heading.text.replace(/\s*\{[^}]*\}/g, "") : "the page intro"}" with no list, image, table, or code block.`, section.heading?.start ?? null, section.heading?.end ?? null));
    }
  }

  const stepCount = (text.match(/^\d+\.[ \t]/gm) || []).length;
  if (stepCount >= THRESHOLDS.MIN_STEPS_FOR_IMAGES && images.length === 0) {
    issues.push(flag(119, `${stepCount} numbered steps but no screenshots.`));
  }

  /* O. SEO */
  for (const image of images) {
    const name = image.path.split("/").pop() || "";
    if (/^(image|img|screenshot|screen[-_ ]?shot|untitled|capture|pic|picture|snip)[-_ ]?\d*\.\w+$/i.test(name) || /^[\d_-]+\.\w+$/.test(name)) {
      issues.push(flag(133, `"${name}" isn't a descriptive file name.`, image.start, image.end));
    }
  }

  if (links.length === 0 && stats.wordCount > 150) {
    issues.push(flag(134, "The page doesn't link to any related content (documentation, tutorials, or videos)."));
  }

  const fileName = (context.gitFilename || "").split("/").pop() || "";
  if (fileName && (/[A-Z_]/.test(fileName.replace(/\.md$/, "")))) {
    issues.push(flag(135, `"${fileName}" should be lowercase with hyphens.`));
  }

  return { issues, stats, hasVideo, docType };
}
