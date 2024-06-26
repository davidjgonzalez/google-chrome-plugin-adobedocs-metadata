"use strict";

import "@spectrum-css/vars/dist/spectrum-global.css";
import "@spectrum-css/vars/dist/spectrum-medium.css";
import "@spectrum-css/vars/dist/spectrum-lightest.css";
import "@spectrum-css/page/dist/index-vars.css";
import "@spectrum-css/button/dist/index-vars.css";
import "@spectrum-css/toast/dist/index-vars.css";
import "@spectrum-css/textfield/dist/index-vars.css";
import "@spectrum-css/fieldlabel/dist/index-vars.css";
import "@spectrum-css/typography/dist/index-vars.css";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-lightest.js";
import "@spectrum-web-components/theme/scale-medium.js";
import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons/sp-icons-medium.js';
import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js";
import '@spectrum-web-components/button/sp-button.js';

import { OPTIONS } from "../constants";

const HTML_IDS = {
  SAVE_BUTTON: 'gcp-adobedocs-metadata__options__save-button',
  FS_CONTENT_ROOT_INPUT: OPTIONS.FS_CONTENT_ROOT,
  ANALYTICS_API_KEY: OPTIONS.ANALYTICS_API_KEY,
  ANALYTICS_DAY_RANGE: OPTIONS.ANALYTICS_DAY_RANGE,
  BETA: OPTIONS.BETA,
};

/** Load prior values and attach click handler **/
(function () {
  chrome.storage.local.get(OPTIONS.FS_CONTENT_ROOT, function (obj) {
    document.getElementById(OPTIONS.FS_CONTENT_ROOT).value = obj[OPTIONS.FS_CONTENT_ROOT] || "";
  });

  chrome.storage.local.get(OPTIONS.ANALYTICS_API_KEY, function (obj) {
    document.getElementById(OPTIONS.ANALYTICS_API_KEY).value = obj[OPTIONS.ANALYTICS_API_KEY] || "";
  });

  chrome.storage.local.get(OPTIONS.ANALYTICS_DAY_RANGE, function (obj) {
    document.getElementById(HTML_IDS.ANALYTICS_DAY_RANGE).value = obj[OPTIONS.ANALYTICS_DAY_RANGE] || "30";
  });

  chrome.storage.local.get(OPTIONS.BETA, function (obj) {
    document.getElementById(HTML_IDS.BETA).value = obj[OPTIONS.BETA] || "";
  });

  document.getElementById(HTML_IDS.SAVE_BUTTON).addEventListener("click", _handleSave);
})();

/** Handle click of Save button **/
function _handleSave() {
  const fsContentRootValue = (document.getElementById(OPTIONS.FS_CONTENT_ROOT).value || "").trim();
  const analyticsApiKeyValue = (document.getElementById(OPTIONS.ANALYTICS_API_KEY).value || "").trim();
  const analyticsDayRangeValue = (document.getElementById(HTML_IDS.ANALYTICS_DAY_RANGE).value || "30").trim();
  const beta = (document.getElementById(HTML_IDS.BETA).value || "").trim();

  chrome.storage.local.set({ [OPTIONS.FS_CONTENT_ROOT]: fsContentRootValue }, function () { console.log("Saved content root path as: " + fsContentRootValue);});
  chrome.storage.local.set({ [OPTIONS.ANALYTICS_API_KEY]: analyticsApiKeyValue }, function () { console.log("Saved analytics API key as: " + analyticsApiKeyValue);});
  chrome.storage.local.set({ [OPTIONS.ANALYTICS_DAY_RANGE]: analyticsDayRangeValue }, function () { console.log("Saved analytics Day range as: " + analyticsDayRangeValue);});
  chrome.storage.local.set({ [OPTIONS.BETA]: beta }, function () { console.log("Saved beta as: " + beta);});

  document.getElementById("saved").style.display = 'block';

  setTimeout(function() { 
    document.getElementById("saved").style.display = 'none';
  }, 5000);
}

export default OPTIONS;
