"use strict";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-lightest.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";

import "@spectrum-web-components/icon/sp-icon.js";
import "@spectrum-web-components/icons/sp-icons-medium.js";

import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-arrow-down.js";

import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/button/sp-button.js";
import "@spectrum-web-components/toast/sp-toast.js";

import "@spectrum-web-components/button/sp-clear-button.js";
import "@spectrum-web-components/action-button/sp-action-button.js";
import "@spectrum-web-components/tabs/sp-tabs.js";
import "@spectrum-web-components/tabs/sp-tab.js";
import "@spectrum-web-components/status-light/sp-status-light.js";
import "@spectrum-web-components/progress-circle/sp-progress-circle.js";
import "@spectrum-web-components/progress-bar/sp-progress-bar.js";
import "@spectrum-web-components/badge/sp-badge.js";
import "@spectrum-web-components/tooltip/sp-tooltip.js";

import "@spectrum-css/tokens/dist/index.css";
import "@spectrum-css/page/dist/index-vars.css";
import "@spectrum-css/inlinealert/dist/index-vars.css";
import "@spectrum-css/button/dist/index-vars.css";
import "@spectrum-css/table/dist/index-vars.css";
import "@spectrum-css/textfield/dist/index-vars.css";
import "@spectrum-css/fieldlabel/dist/index-vars.css";
import "@spectrum-css/typography/dist/index-vars.css";
import "@spectrum-css/toast/dist/index-vars.css";
import "@spectrum-css/tooltip/dist/index-vars.css";
import "@spectrum-css/badge/dist/index-vars.css";

import "./popup.css";

import experienceLeaguePopup from "./exl/popup-exl";
import { getExlMetadata } from "./exl/popup-exl-eds";

import jiraStoryPopup from "./popup-jira-story";
import { delegateEvent } from "../utils";

let contentResponse;

/*
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    { text: "collect_adobedocs_metadata" },
    function (response) {
      console.log(
        "Content script scraped the following data for the extension to display:",
        response
      );

      contentResponse = response;

      if (!response) {
        document.getElementById("error-alert").style.display = "block";

        let head = document.getElementsByTagName("head")[0];
        let metaRefresh = document.createElement("meta");
        metaRefresh.setAttribute("http-equiv", "refresh");
        metaRefresh.setAttribute("content", "2");
        head.appendChild(metaRefresh);

        return;
      } else if (response.website === "EXPERIENCE LEAGUE") {
        // ExL needs to wait until Local Storage is
        experienceLeaguePopup(response, _injectHtml);
      } else if (response.website === "JIRA" && response.type === "Story") {
        jiraStoryPopup(response, _injectHtml);
      } 
    }
  );
});

*/

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  (async function () {

    const website = new URL(tabs[0].url).hostname || '';

    if (website.indexOf("experienceleague.adobe.com") > -1) {
      experienceLeaguePopup(
        await getExlMetadata(tabs[0].url),
        _injectHtml
      );
    } else if (website.indexOf("jira.corp.adobe.com") > -1) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { text: "collect_adobedocs_metadata" },
        function (response) {
          console.log(
            "Content script scraped the following data for the extension to display:",
            response
          );

          contentResponse = response;

          if (!response) {
            document.getElementById("error-alert").style.display = "block";

            let head = document.getElementsByTagName("head")[0];
            let metaRefresh = document.createElement("meta");
            metaRefresh.setAttribute("http-equiv", "refresh");
            metaRefresh.setAttribute("content", "2");
            head.appendChild(metaRefresh);

            return;
          } else if (response.website === "JIRA" && response.type === "Story") {
            jiraStoryPopup(response, _injectHtml);
          } 
        }
      );
    } else {
      console.warn("Unsupported web page:", tabs[0]);
    }
  })();
});

function _injectHtml(html, elementId) {
  elementId = elementId || "metadata";

  document.getElementById(elementId).innerHTML = html;

  document.querySelectorAll("img.thumbnail--image").forEach((el) => {
    el.addEventListener("error", (e) => {
      el.parentElement
        .querySelectorAll(".thumbnail--exists-on-cdn")
        .forEach((el) => (el.style.display = "none"));
      el.parentElement
        .querySelectorAll(".thumbnail--missing-on-cdn")
        .forEach((el) => (el.style.display = "inline-flex"));
    });
  });

  delegateEvent('body', 'click', '[data-copy-to-clipboard]', (e) => {
    const el = e.target;
    if (el.tagName === 'TEXTAREA') {
      _copyToClipboard(textarea.value);
    } else {
      const attributeValue = el.getAttribute("data-copy-to-clipboard");

      let candidateElement = null;

      try {
        candidateElement = document.querySelector(attributeValue);
      } catch (error) {
        // This is fine as the value may be text; Silently swallow the error
      }

      if (candidateElement) {
        // If a selector is provied, use that to find the element and copy it's value
        _copyToClipboard(candidateElement.value);
      } else {
        // Else assume the attribute value is the text to copy
        _copyToClipboard(attributeValue);
      }
    }
  });

  delegateEvent('body', 'click', "[data-tabs]", (e) => {
    const el = e.target;
    const tabSetName = el.getAttribute("data-tab-set");
    const tabName = el.getAttribute("data-tabs");

    document.querySelectorAll("[data-tab][data-tab-set='" + tabSetName + "']").forEach((hideEl) => {
      hideEl.style.display = "none";
    });

    document
      .querySelectorAll('[data-tab="' + tabName + '"][data-tab-set=' + tabSetName + ']')
      .forEach((showEl) => {
        showEl.style.display = "block";
      });
  });


  setTimeout(() => {
    document.querySelectorAll("sp-tabs[selected]").forEach((el) => {
      const selectedTabId = el.getAttribute("selected");
      const selectedTab = document.querySelector('[data-tab="' + selectedTabId + '"]');
      if (selectedTab) {
        selectedTab.style.display = "block";
      }

    });
  }, 250);

  
}

function _copyToClipboard(text) {
  if (text) {
    let copyEl = document.getElementById("copy-to-clipboard-input");
    copyEl.value = decodeURIComponent(text);
    copyEl.select();
    copyEl.setSelectionRange(0, 99999);

    navigator.clipboard.writeText(copyEl.value);
  }
}
