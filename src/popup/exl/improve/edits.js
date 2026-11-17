// Applying, validating, relocating, and diffing edits. Shared by the popup and the GitHub content script,
// so keep this file free of popup-only dependencies.

import { parseFrontmatter, getCodeBlockRanges, overlapsRanges, lineAt, getTargets } from "./markdown-utils";

const MAX_ADDED_CHARS = 2000;

function listOf(re, s) {
  return (s.match(re) || []).sort().join("\u0001");
}

/** Returns a string describing why an AI edit is unsafe, or null if it's acceptable. */
export function validateAiEdit(text, start, end, replace) {
  const find = text.slice(start, end);

  if (overlapsRanges(start, end, getCodeBlockRanges(text))) {
    return "touches a code block";
  }

  const fm = parseFrontmatter(text);
  if (fm && start < fm.end) {
    if (end > fm.end - 4) {
      return "spans the frontmatter boundary";
    }
    const line = lineAt(text, start);
    if (end > line.end || replace.includes("\n")) {
      return "changes more than one frontmatter line";
    }
    const key = (/^([A-Za-z0-9_-]+):/.exec(line.text) || [])[1];
    if (!key || !["title", "description"].includes(key.toLowerCase())) {
      return `edits the ${key || "unknown"} frontmatter field (only title and description may change)`;
    }
    const newLine = text.slice(line.start, start) + replace + text.slice(end, line.end);
    if (!newLine.startsWith(`${key}:`)) {
      return "breaks the frontmatter key";
    }
  }

  // "CX Enterprise" only replaces "Experience Cloud" / "Marketing Cloud"; any other source of it is a wrong rename
  // (for example "Adobe Experience Manager" → "Adobe CX Enterprise").
  const cxBefore = (find.match(/CX Enterprise/g) || []).length;
  const cxAfter = (replace.match(/CX Enterprise/g) || []).length;
  const renamable = (find.match(/(?:Experience|Marketing) Cloud/g) || []).length;
  if (cxAfter > cxBefore + renamable) {
    return "renames a product to CX Enterprise";
  }

  if (JSON.stringify(getTargets(find)) !== JSON.stringify(getTargets(replace))) {
    return "changes a link or image target";
  }
  if (listOf(/\[![A-Za-z]+/g, find) !== listOf(/\[![A-Za-z]+/g, replace)) {
    return "changes Markdown component syntax";
  }
  if (listOf(/\{[^}\n]*\}/g, find) !== listOf(/\{[^}\n]*\}/g, replace)) {
    return "changes an attribute block or snippet";
  }
  if (listOf(/`[^`\n]+`/g, find) !== listOf(/`[^`\n]+`/g, replace)) {
    return "changes inline code";
  }
  if (listOf(/^#{1,6}(?=\s)/gm, find) !== listOf(/^#{1,6}(?=\s)/gm, replace)) {
    return "changes heading levels";
  }
  if ((find.match(/\+\+\+/g) || []).length !== (replace.match(/\+\+\+/g) || []).length) {
    return "changes a collapsible section";
  }
  if (replace.length - find.length > MAX_ADDED_CHARS) {
    return "adds too much text in one edit";
  }

  return null;
}

/** Applies non-overlapping edits. Returns { text, applied, skipped } (skipped = overlapping edits). */
export function applyEdits(text, edits) {
  const sorted = [...edits].sort((a, b) => a.start - b.start || a.end - b.end);
  const applied = [];
  const skipped = [];
  let lastEnd = -1;

  for (const e of sorted) {
    if (e.start < lastEnd) {
      skipped.push(e);
      continue;
    }
    applied.push(e);
    // Insertions (start === end) at the same position are all kept, in order.
    lastEnd = Math.max(lastEnd, e.end);
  }

  let result = "";
  let cursor = 0;
  for (const e of applied) {
    result += text.slice(cursor, e.start) + e.replace;
    cursor = e.end;
  }
  result += text.slice(cursor);

  return { text: result, applied, skipped };
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let pos = haystack.indexOf(needle);
  while (pos !== -1 && count < 2) {
    count++;
    pos = haystack.indexOf(needle, pos + 1);
  }
  return count;
}

/** Converts offset edits into context-anchored edits that can be re-applied to a slightly different file. */
export function toRelocatable(base, edits) {
  return edits.map((e) => {
    let k = 20;
    let pre;
    let post;
    do {
      pre = base.slice(Math.max(0, e.start - k), e.start);
      post = base.slice(e.end, e.end + k);
      k += 20;
    } while (countOccurrences(base, pre + base.slice(e.start, e.end) + post) > 1 && k < 400);

    return { pre, orig: base.slice(e.start, e.end), post, replace: e.replace, criterion: e.criterion };
  });
}

/** Re-applies context-anchored edits to the current file. Returns { text, applied, missed }. */
export function relocateAndApply(current, relocatable) {
  const located = [];
  const missed = [];

  for (const r of relocatable) {
    const needle = r.pre + r.orig + r.post;
    const index = current.indexOf(needle);
    if (index === -1 || countOccurrences(current, needle) > 1) {
      missed.push(r);
      continue;
    }
    const start = index + r.pre.length;
    located.push({ start, end: start + r.orig.length, replace: r.replace, criterion: r.criterion });
  }

  const result = applyEdits(current, located);
  return { text: result.text, applied: result.applied.length, missed: missed.length + result.skipped.length };
}

/** Line diff. Returns hunks: [{ lines: [{ type: "same" | "add" | "del", text, oldNo, newNo }] }] */
export function diffLines(oldText, newText, context = 2) {
  const a = oldText.split("\n");
  const b = newText.split("\n");

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  let suffix = 0;
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
    suffix++;
  }

  const am = a.slice(prefix, a.length - suffix);
  const bm = b.slice(prefix, b.length - suffix);
  const n = am.length;
  const m = bm.length;
  const table = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * (m + 1) + j] = am[i] === bm[j] ? table[(i + 1) * (m + 1) + j + 1] + 1 : Math.max(table[(i + 1) * (m + 1) + j], table[i * (m + 1) + j + 1]);
    }
  }

  const ops = [];
  for (let k = 0; k < prefix; k++) {
    ops.push({ type: "same", text: a[k], oldNo: k + 1, newNo: k + 1 });
  }
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && am[i] === bm[j]) {
      ops.push({ type: "same", text: am[i], oldNo: prefix + i + 1, newNo: prefix + j + 1 });
      i++;
      j++;
    } else if (j < m && (i >= n || table[i * (m + 1) + j + 1] >= table[(i + 1) * (m + 1) + j])) {
      ops.push({ type: "add", text: bm[j], newNo: prefix + j + 1 });
      j++;
    } else {
      ops.push({ type: "del", text: am[i], oldNo: prefix + i + 1 });
      i++;
    }
  }
  for (let k = 0; k < suffix; k++) {
    ops.push({ type: "same", text: a[a.length - suffix + k], oldNo: a.length - suffix + k + 1, newNo: b.length - suffix + k + 1 });
  }

  const hunks = [];
  let current = null;
  let lastChange = -Infinity;
  ops.forEach((op, index) => {
    if (op.type !== "same") {
      if (!current || index - lastChange > context * 2) {
        current = { lines: ops.slice(Math.max(0, index - context), index).map((o) => ({ ...o })) };
        hunks.push(current);
      } else {
        current.lines.push(...ops.slice(lastChange + 1, index));
      }
      current.lines.push(op);
      lastChange = index;
    }
  });
  hunks.forEach((hunk) => {
    const last = hunk.lines[hunk.lines.length - 1];
    const endIndex = ops.indexOf(last);
    if (endIndex !== -1) {
      hunk.lines.push(...ops.slice(endIndex + 1, endIndex + 1 + context));
    }
  });

  return hunks;
}
