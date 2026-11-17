// Runs in the GitHub page's own JavaScript world so it can reach the CodeMirror editor instance,
// which the isolated content script can't see. It only reads or replaces the editor's text when
// asked by content-github.js; it never submits anything.

import { GITHUB_MESSAGE_TAG } from "../popup/exl/improve/constants";

function findEditorView() {
  const content = document.querySelector(".cm-content");
  if (!content) {
    return null;
  }
  const docView = content.cmView;
  return docView?.rootView?.view || docView?.view || null;
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.tag !== GITHUB_MESSAGE_TAG || event.data.dir !== "to-main") {
    return;
  }

  const reply = (payload) =>
    window.postMessage({ tag: GITHUB_MESSAGE_TAG, dir: "to-isolated", id: event.data.id, ...payload }, window.location.origin);

  const view = findEditorView();
  if (!view) {
    reply({ ok: false, error: "editor-not-found" });
    return;
  }

  try {
    if (event.data.type === "get") {
      reply({ ok: true, text: view.state.doc.toString() });
    } else if (event.data.type === "set") {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: event.data.text } });
      reply({ ok: true, text: view.state.doc.toString() });
    }
  } catch (error) {
    reply({ ok: false, error: error.message });
  }
});
