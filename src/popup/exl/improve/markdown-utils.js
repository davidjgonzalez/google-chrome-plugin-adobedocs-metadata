// Lightweight Markdown helpers for analyzing ExL source files.
// Everything works on the raw text with character offsets so edits can be applied precisely.

export const MASK = "\u0000";

export function normalizeNewlines(text) {
  return (text || "").replace(/\r\n?/g, "\n");
}

/** Returns { start, end, fields: [{ key, value, start, end }] } for the YAML frontmatter, or null. */
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!match) {
    return null;
  }

  const start = 0;
  const end = match[0].length;
  const fields = [];
  const bodyStart = 4; // after "---\n"
  const lines = match[1].split("\n");
  let offset = bodyStart;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keyMatch = /^([A-Za-z0-9_-]+):\s?(.*)$/.exec(line);

    if (keyMatch) {
      // Include indented continuation lines (YAML lists or folded values) in the field range.
      let fieldEnd = offset + line.length;
      let j = i + 1;
      let continuation = offset + line.length + 1;
      while (j < lines.length && /^(\s+|-\s)/.test(lines[j])) {
        fieldEnd = continuation + lines[j].length;
        continuation += lines[j].length + 1;
        j++;
      }

      fields.push({
        key: keyMatch[1],
        value: keyMatch[2].trim(),
        start: offset,
        end: fieldEnd,
        valueStart: offset + line.indexOf(":") + 1 + (line[line.indexOf(":") + 1] === " " ? 1 : 0),
      });
    }

    offset += line.length + 1;
  }

  return { start, end, fields };
}

export function getField(frontmatter, key) {
  return frontmatter?.fields.find((f) => f.key.toLowerCase() === key.toLowerCase()) || null;
}

/** Ranges [start, end) of fenced code blocks and HTML comments: content that checks must never touch. */
export function getCodeBlockRanges(text) {
  const ranges = [];
  const fence = /^([ \t]*)(```+|~~~+)[^\n]*\n/gm;
  let match;

  while ((match = fence.exec(text))) {
    const marker = match[2];
    const closer = new RegExp(`^[ \\t]*${marker[0] === "`" ? "`" : "~"}{${marker.length},}[ \\t]*$`, "gm");
    closer.lastIndex = fence.lastIndex;
    const close = closer.exec(text);
    const end = close ? close.index + close[0].length : text.length;
    ranges.push([match.index, end]);
    fence.lastIndex = end;
  }

  // HTML comments are hidden on the published page, so they're treated like code: never checked or edited.
  const comment = /<!--[\s\S]*?(?:-->|$)/g;
  while ((match = comment.exec(text))) {
    if (!inRanges(match.index, ranges)) {
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  return ranges.sort((a, b) => a[0] - b[0]);
}

export function inRanges(pos, ranges) {
  return ranges.some(([s, e]) => pos >= s && pos < e);
}

export function overlapsRanges(start, end, ranges) {
  return ranges.some(([s, e]) => start < e && end > s);
}

/**
 * Returns a copy of the text where everything that is NOT prose is replaced by MASK characters
 * (same length, so offsets line up): frontmatter, code blocks, inline code, link/image targets,
 * autolinks, HTML tags, attribute blocks, component markers, includes, and snippets.
 */
export function getProseMask(text) {
  const chars = text.split("");
  const mask = (s, e) => {
    for (let i = s; i < e && i < chars.length; i++) {
      if (chars[i] !== "\n") {
        chars[i] = MASK;
      }
    }
  };

  const fm = parseFrontmatter(text);
  if (fm) {
    mask(fm.start, fm.end);
  }

  getCodeBlockRanges(text).forEach(([s, e]) => mask(s, e));

  const patterns = [
    /`[^`\n]+`/g, // inline code
    /\]\([^)\n]*\)/g, // link/image targets
    /<https?:\/\/[^>\s]+>/g, // autolinks
    /<\/?[a-zA-Z][^>\n]*>/g, // HTML tags
    /\{[^}\n]*\}/g, // attribute blocks and includes
    /\[!(?:[A-Z]+)[^\]\n]*\]/g, // component markers like [!NOTE], [!VIDEO], [!BADGE x]
    /^>\s*/gm, // blockquote markers
  ];

  for (const pattern of patterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(text))) {
      mask(match.index, match.index + match[0].length);
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }
  }

  return chars.join("");
}

/** Returns the 1-based line number for an offset. */
export function lineOf(text, offset) {
  let line = 1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}

export function lineAt(text, offset) {
  const start = text.lastIndexOf("\n", offset - 1) + 1;
  let end = text.indexOf("\n", offset);
  if (end === -1) {
    end = text.length;
  }
  return { start, end, text: text.slice(start, end) };
}

/** Headings outside code blocks: [{ level, text, start, end, lineStart, lineEnd }] */
export function getHeadings(text) {
  const codeRanges = getCodeBlockRanges(text);
  const fm = parseFrontmatter(text);
  const headings = [];
  const re = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/gm;
  let match;

  while ((match = re.exec(text))) {
    if (inRanges(match.index, codeRanges) || (fm && match.index < fm.end)) {
      continue;
    }
    headings.push({
      level: match[1].length,
      text: match[2],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return headings;
}

export function slugify(headingText) {
  const explicit = /\{#([^}]+)\}/.exec(headingText);
  if (explicit) {
    return explicit[1];
  }

  return headingText
    .replace(/\[!BADGE[^\]]*\](\{[^}]*\})?/g, "")
    .replace(/\{[^}]*\}/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-");
}

/** Markdown images: [{ alt, path, attrs, start, end, altStart, altEnd }] */
export function getImages(text) {
  const codeRanges = getCodeBlockRanges(text);
  const images = [];
  const re = /!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)(\{[^}\n]*\})?/g;
  let match;

  while ((match = re.exec(text))) {
    if (inRanges(match.index, codeRanges)) {
      continue;
    }
    images.push({
      alt: match[1],
      path: match[2],
      attrs: match[3] || "",
      start: match.index,
      end: match.index + match[0].length,
      linked: text[match.index - 1] === "[",
    });
  }

  return images;
}

/** Markdown links (not images): [{ text, url, start, end, urlStart, urlEnd, attrs }] */
export function getLinks(text) {
  const codeRanges = getCodeBlockRanges(text);
  const fm = parseFrontmatter(text);
  const links = [];
  const re = /(?<!!)\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)(\{[^}\n]*\})?/g;
  let match;

  while ((match = re.exec(text))) {
    if (inRanges(match.index, codeRanges) || (fm && match.index < fm.end)) {
      continue;
    }
    const urlStart = match.index + match[1].length + 3;
    links.push({
      text: match[1],
      url: match[2],
      attrs: match[3] || "",
      start: match.index,
      end: match.index + match[0].length,
      urlStart,
      urlEnd: urlStart + match[2].length,
    });
  }

  return links;
}

/** Plain text of the body for word and sentence statistics. */
export function getPlainText(text) {
  const mask = getProseMask(text);
  return mask
    .replace(new RegExp(MASK, "g"), " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_|>#]/g, " ")
    .replace(/!\[[^\]]*\]/g, " ")
    .replace(/\[([^\]]*)\]/g, "$1")
    .replace(/[ \t]+/g, " ");
}

export function countWords(plain) {
  return (plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length;
}

export function getSentences(plain) {
  return plain
    .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9"“(])/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => countWords(s) >= 3);
}

// "be" + past participle. Words ending in -ed/-en that aren't participles ("then", "often", "open", "need")
// are excluded, as are adjectives that follow "be" ("is red", "is based" stays: it's usually passive).
const PASSIVE = /\b(am|is|are|was|were|be|been|being)\s+(?:not\s+)?(?:\w+ly\s+)?(\w+(?:ed|en))\b/gi;
const NOT_PARTICIPLES = new Set(
  "then when often even open seven eleven ten token kitchen garden children listen happen heaven oxygen screen green between amen citizen".split(" ")
);
const NOT_PASSIVE_ED = new Set("need feed seed speed bed red embed shed bleed breed exceed proceed succeed indeed".split(" "));

/** Number of passive constructions ("is configured", "was not taken") in a string. */
export function countPassive(s) {
  let n = 0;
  for (const m of String(s).matchAll(PASSIVE)) {
    const word = m[2].toLowerCase();
    if (NOT_PARTICIPLES.has(word)) continue;
    if (NOT_PASSIVE_ED.has(word)) continue;
    n++;
  }
  return n;
}

function syllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) {
    return 0;
  }
  if (w.length <= 3) {
    return 1;
  }
  const groups = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "")
    .match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function getTextStats(text) {
  const plain = getPlainText(text);
  const words = plain.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || [];
  const sentences = getSentences(plain);
  const syllableCount = words.reduce((sum, w) => sum + syllables(w), 0);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);

  const passive = sentences.filter((s) => countPassive(s) > 0).length;
  const gerunds = words.filter((w) => w.length > 5 && /ing$/i.test(w)).length;

  return {
    wordCount,
    sentenceCount: sentences.length,
    avgSentenceWords: wordCount / sentenceCount,
    gradeLevel: wordCount > 0 ? 0.39 * (wordCount / sentenceCount) + 11.8 * (syllableCount / wordCount) - 15.59 : 0,
    passivePct: sentences.length ? Math.round((passive / sentences.length) * 100) : 0,
    gerundsPer100: wordCount ? Math.round((gerunds / wordCount) * 1000) / 10 : 0,
  };
}

/** Splits the body into sections by heading. */
export function getSections(text) {
  const headings = getHeadings(text);
  const fm = parseFrontmatter(text);
  const bodyStart = fm ? fm.end : 0;
  const bounds = [{ heading: null, start: bodyStart }, ...headings.map((h) => ({ heading: h, start: h.start }))];

  return bounds.map((b, i) => {
    const end = i + 1 < bounds.length ? bounds[i + 1].start : text.length;
    return { heading: b.heading, start: b.start, end, text: text.slice(b.start, end) };
  });
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Every link or image target in a string, used to make sure AI edits never change URLs. */
export function getTargets(snippet) {
  const targets = [];
  const re = /\]\(([^)\s]+)|<(https?:\/\/[^>\s]+)>|\bhttps?:\/\/[^\s)<>\]]+/g;
  let match;
  while ((match = re.exec(snippet))) {
    targets.push(match[1] || match[2] || match[0]);
  }
  return targets.sort();
}
