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
    document.getElementById(OPTIONS.FS_CONTENT_ROOT).value = obj[OPTIONS.FS_CONTENT_ROOT] || "";

    document
      .getElementById(HTML_IDS.SAVE_BUTTON)
      .addEventListener("click", _handleSave);
  });

  chrome.storage.sync.get(OPTIONS.EXTRA_STYLES, function (obj) {             
    var extraStylesValue = obj[OPTIONS.EXTRA_STYLES] || 'none';
    document.querySelector(`#${OPTIONS.EXTRA_STYLES} option[value="${extraStylesValue}"]`).setAttribute('selected', 'selected');     
  })
})();

/** Handle click of Save button **/
function _handleSave() {
  const fsContentRootValue = (document.getElementById(OPTIONS.FS_CONTENT_ROOT).value || "").trim();
  const extraStylesValue = document.getElementById(OPTIONS.EXTRA_STYLES).value || "none";

  chrome.storage.sync.set({ [OPTIONS.FS_CONTENT_ROOT]: fsContentRootValue }, function () { console.log("Saved content root path as: " + fsContentRootValue);});
  chrome.storage.sync.set({ [OPTIONS.EXTRA_STYLES]: extraStylesValue }, function () { console.log("Saved extra styles as: " + extraStylesValue);});
}

export default OPTIONS;
