"use strict";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-light.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";

import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons/sp-icons-medium.js';

import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js";

import '@spectrum-web-components/action-menu/sp-action-menu.js';
import '@spectrum-web-components/button/sp-button.js';
import '@spectrum-web-components/button/sp-clear-button.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/tabs/sp-tabs.js';
import '@spectrum-web-components/tabs/sp-tab.js';
import '@spectrum-web-components/status-light/sp-status-light.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';

import "@spectrum-css/alert/dist/index-vars.css";
import "@spectrum-css/table/dist/index-vars.css";
import "@spectrum-css/icon/dist/index-vars.css";
import "@spectrum-css/typography/dist/index-vars.css";

import "./popup.css";

import experienceLeaguePopup from "./popup-exl.js"
import jiraStoryPopup from "./popup-jira-story"
import jiraCoursePopup from "./popup-jira-course";

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    { text: "collect_adobedocs_metadata" },
    function (response) {
        console.log("Content script scraped the following data for the extension to display:")
        console.log(response);
        
        if (!response) {

          document.getElementById("error-alert").style.display = 'block';
          
          let head = document.getElementsByTagName("head")[0];        
          let metaRefresh = document.createElement("meta");
          metaRefresh.setAttribute("http-equiv", "refresh");
          metaRefresh.setAttribute("content", "2");
          head.appendChild(metaRefresh);

          return;

        } else if (response.website === 'EXPERIENCE LEAGUE') {
            // ExL needs to wait until Local Storage is 
            experienceLeaguePopup(response, _injectHtml);
        } else if (response.website === 'JIRA' && response.type === 'Story') {
            jiraStoryPopup(response, _injectHtml); 
        } else if (response.website === 'JIRA' && response.type === 'Initiative') {
            jiraCoursePopup(response, _injectHtml);
        }
    }
  );
});


function _injectHtml(html) {

    document.getElementById("metadata").innerHTML = html;

    document.querySelectorAll('img.thumbnail--image').forEach((el) => {
        el.addEventListener('error', (e) => {
            el.style.display = 'none';
            document.querySelector('.thumbnail--missing-on-cdn').style.display = 'flex';
        });
    });

    document.querySelectorAll('[data-copy-to-clipboard]').forEach((el) => {
        el.addEventListener('click', (e) => {
            _copyToClipboard(el.getAttribute('data-copy-to-clipboard'));
        });
    });

    document.querySelectorAll('[data-tabs]').forEach((el) => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('[data-tab]').forEach((el) => { el.style.display = 'none'; });
            document.querySelectorAll('[data-tab="' + el.getAttribute('data-tabs') + '"]').forEach((el) => {  el.style.display = 'block'; });
        });
    });
}

function _copyToClipboard(text) {
    if (text) {
        let copyEl = document.getElementById("copy-to-clipboard-input");
        copyEl.value = text;
        copyEl.select();
        document.execCommand("copy");
    }
}
