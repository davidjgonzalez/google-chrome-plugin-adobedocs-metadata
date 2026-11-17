// Runs on github.com/Adobe-Enterprise-Docs pages. When the Improve tab hands off changes for the file
// being edited, this fills the editor and the commit dialog. It never clicks commit or create PR;
// the author reviews and submits.

import { PENDING_KEY, PENDING_MAX_AGE_MS, GITHUB_MESSAGE_TAG } from "../popup/exl/improve/constants";
import { relocateAndApply } from "../popup/exl/improve/edits";
import { normalizeNewlines } from "../popup/exl/improve/markdown-utils";

let requestId = 0;

function callMain(type, payload = {}, timeoutMs = 1500) {
  const id = `${Date.now()}-${requestId++}`;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({ ok: false, error: "timeout" });
    }, timeoutMs);

    function onMessage(event) {
      if (event.source !== window || event.data?.tag !== GITHUB_MESSAGE_TAG || event.data.dir !== "to-isolated" || event.data.id !== id) {
        return;
      }
      clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(event.data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ tag: GITHUB_MESSAGE_TAG, dir: "to-main", id, type, ...payload }, window.location.origin);
  });
}

async function waitForEditor(maxMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxMs) {
    const result = await callMain("get");
    if (result.ok) {
      return result;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return { ok: false, error: "editor-not-found" };
}

/* ---------- Banner ---------- */

let banner;

function showBanner(kind, html, buttons = []) {
  if (!banner) {
    banner = document.createElement("div");
    banner.setAttribute("role", "status");
    Object.assign(banner.style, {
      position: "fixed",
      top: "72px",
      right: "16px",
      zIndex: "2147483647",
      maxWidth: "420px",
      padding: "12px 36px 12px 14px",
      borderRadius: "8px",
      font: "14px/1.45 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxShadow: "0 4px 16px rgba(0,0,0,.2)",
    });
    document.body.appendChild(banner);
  }

  const colors = {
    info: ["#0d66d0", "#fff"],
    ok: ["#12805c", "#fff"],
    warn: ["#b35c00", "#fff"],
    error: ["#c9252d", "#fff"],
  }[kind];
  banner.style.background = colors[0];
  banner.style.color = colors[1];

  banner.innerHTML = `<strong>AdobeDocs extension</strong><div style="margin-top:4px">${html}</div>`;

  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", "Dismiss");
  Object.assign(close.style, { position: "absolute", top: "6px", right: "10px", background: "none", border: "0", color: "inherit", fontSize: "20px", cursor: "pointer" });
  close.onclick = () => banner.remove();
  banner.appendChild(close);

  if (buttons.length) {
    const row = document.createElement("div");
    row.style.marginTop = "8px";
    for (const { label, onClick } of buttons) {
      const button = document.createElement("button");
      button.textContent = label;
      Object.assign(button.style, { marginRight: "8px", padding: "4px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,.7)", background: "transparent", color: "inherit", cursor: "pointer" });
      button.onclick = onClick;
      row.appendChild(button);
    }
    banner.appendChild(row);
  }
}

/* ---------- Commit dialog ---------- */

function setNativeValue(el, value) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function fillCommitDialog(dialog, commit) {
  if (dialog.dataset.adobedocsFilled) {
    return;
  }

  const message = dialog.querySelector('input[type="text"]');
  if (!message) {
    return;
  }
  dialog.dataset.adobedocsFilled = "true";

  if (!message.value || /^Update /.test(message.value)) {
    setNativeValue(message, commit.title);
  }

  const description = dialog.querySelector("textarea");
  if (description && !description.value) {
    setNativeValue(description, commit.body);
  }

  const branchLabel = [...dialog.querySelectorAll("label")].find((l) => /new branch/i.test(l.textContent));
  const radio = branchLabel && (branchLabel.control || branchLabel.querySelector("input"));
  if (radio && !radio.checked) {
    radio.click();
  }
}

function watchForCommitDialog(commit) {
  const check = () => {
    document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
      if (/commit/i.test(dialog.textContent || "")) {
        fillCommitDialog(dialog, commit);
      }
    });
  };
  new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
}

/* ---------- Main ---------- */

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    showBanner("ok", `${label} copied to the clipboard.`);
  } catch (e) {
    showBanner("error", "Couldn't copy to the clipboard.");
  }
}

async function run() {
  const pending = (await chrome.storage.local.get(PENDING_KEY))[PENDING_KEY];
  if (!pending) {
    return;
  }

  if (Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
    await chrome.storage.local.remove(PENDING_KEY);
    return;
  }

  if (decodeURIComponent(window.location.pathname) !== decodeURIComponent(pending.path)) {
    return;
  }

  // Claim the hand-off so a reload or second tab doesn't apply it twice.
  await chrome.storage.local.remove(PENDING_KEY);

  const commit = { title: pending.commitTitle, body: pending.commitBody };
  const commitButtons = [{ label: "Copy commit message", onClick: () => copy(`${commit.title}\n\n${commit.body}`, "Commit message") }];
  const markdownButton = { label: "Copy updated markdown", onClick: () => copy(pending.newText, "Updated markdown") };

  showBanner("info", "Filling in your changes…");

  const editor = await waitForEditor();
  if (!editor.ok) {
    showBanner(
      "warn",
      "Couldn't fill the editor automatically. Click in the editor, select all (Cmd/Ctrl+A), and paste the updated markdown.",
      [markdownButton, ...commitButtons]
    );
    watchForCommitDialog(commit);
    return;
  }

  const current = normalizeNewlines(editor.text);
  let newText = pending.newText;
  let note = "";

  if (current.trimEnd() !== normalizeNewlines(pending.base).trimEnd()) {
    const result = relocateAndApply(current, pending.relocatable);
    if (!result.applied) {
      showBanner("error", "This file changed since the page was analyzed, and none of the changes could be matched to the current version. Nothing was changed. Re-analyze the page in the extension and try again.");
      return;
    }
    newText = result.text;
    note = ` The file changed since it was analyzed, so ${result.applied} change${result.applied === 1 ? " was" : "s were"} re-matched${result.missed ? ` and <strong>${result.missed} couldn't be applied</strong>` : ""}.`;
  }

  const set = await callMain("set", { text: newText }, 5000);
  if (!set.ok || normalizeNewlines(set.text) !== normalizeNewlines(newText)) {
    showBanner("warn", "Couldn't fill the editor automatically. Click in the editor, select all (Cmd/Ctrl+A), and paste the updated markdown.", [
      { label: "Copy updated markdown", onClick: () => copy(newText, "Updated markdown") },
      ...commitButtons,
    ]);
    watchForCommitDialog(commit);
    return;
  }

  showBanner(
    note ? "warn" : "ok",
    `Your selected changes are in the editor.${note} Review them with <strong>Preview</strong>, then click <strong>Commit changes…</strong>. The commit message and "new branch" option are filled in for you, and nothing is submitted until you click.`,
    commitButtons
  );
  watchForCommitDialog(commit);
}

run();
