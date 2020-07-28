"use strict";

import "@spectrum-css/vars/dist/spectrum-global.css";
import "@spectrum-css/vars/dist/spectrum-medium.css";
import "@spectrum-css/vars/dist/spectrum-light.css";
import "@spectrum-css/page/dist/index-vars.css";
import "@spectrum-css/button/dist/index-vars.css";
import "@spectrum-css/textfield/dist/index-vars.css";
import "@spectrum-css/fieldlabel/dist/index-vars.css";

import "./options.css";

import OPTIONS from "../constants";

const HTML_IDS = {
  SAVE_BUTTON: "gcp-adobedocs-metadata__options__save-button",
  FS_CONTENT_ROOT_INPUT: OPTIONS.FS_CONTENT_ROOT,
};

/** Load prior values and attach click handler **/
(function () {
  chrome.storage.sync.get(OPTIONS.FS_CONTENT_ROOT, function (obj) {
    document.getElementById(OPTIONS.FS_CONTENT_ROOT).value =
      obj[OPTIONS.FS_CONTENT_ROOT] || "";

    document
      .getElementById(HTML_IDS.SAVE_BUTTON)
      .addEventListener("click", _handleSave);
  });
})();

/** Handle click of Save button **/
function _handleSave() {
  const value = (
    document.getElementById(OPTIONS.FS_CONTENT_ROOT).value || ""
  ).trim();

  chrome.storage.sync.set(
    {
      [OPTIONS.FS_CONTENT_ROOT]: value,
    },
    function () {
      console.log("Saved content root path as: " + value);
    }
  );
}

export default OPTIONS;
