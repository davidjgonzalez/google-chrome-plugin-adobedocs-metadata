"use strict";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-lightest.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";

import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons/sp-icons-medium.js';

import "@spectrum-web-components/icons-workflow/icons/sp-icon-chevron-down.js";
import "@spectrum-web-components/icons-workflow/icons/sp-icon-arrow-down.js";

import '@spectrum-web-components/action-menu/sp-action-menu.js';
import '@spectrum-web-components/button/sp-button.js';
import '@spectrum-web-components/toast/sp-toast.js';

import '@spectrum-web-components/button/sp-clear-button.js';
import '@spectrum-web-components/action-button/sp-action-button.js';
import '@spectrum-web-components/tabs/sp-tabs.js';
import '@spectrum-web-components/tabs/sp-tab.js';
import '@spectrum-web-components/status-light/sp-status-light.js';
import '@spectrum-web-components/progress-circle/sp-progress-circle.js';

import "@spectrum-css/vars/dist/spectrum-global.css";
import "@spectrum-css/vars/dist/spectrum-medium.css";
import "@spectrum-css/vars/dist/spectrum-lightest.css";
import "@spectrum-css/page/dist/index-vars.css";
import "@spectrum-css/inlinealert/dist/index-vars.css";
import "@spectrum-css/button/dist/index-vars.css";
import "@spectrum-css/table/dist/index-vars.css";
import "@spectrum-css/textfield/dist/index-vars.css";
import "@spectrum-css/fieldlabel/dist/index-vars.css";
import "@spectrum-css/typography/dist/index-vars.css";
import "@spectrum-css/toast/dist/index-vars.css";

import "./popup.css";

import experienceLeaguePopup from "./popup-exl.js"
import jiraStoryPopup from "./popup-jira-story"
import jiraCoursePopup from "./popup-jira-course";

let contentResponse;

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    { text: "collect_adobedocs_metadata" },
    function (response) {

        console.log("Content script scraped the following data for the extension to display:", response);
        
        contentResponse = response;

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


function _injectHtml(html, elementId) {
    elementId = elementId || 'metadata';

    document.getElementById(elementId).innerHTML = html;

    document.querySelectorAll('img.thumbnail--image').forEach((el) => {
        el.addEventListener('error', (e) => {
            el.parentElement.querySelectorAll('.thumbnail--exists-on-cdn').forEach((el) => el.style.display = 'none' );
            el.parentElement.querySelectorAll('.thumbnail--missing-on-cdn').forEach((el) => el.style.display = 'inline-flex' );
        });
    });

    document.querySelectorAll('[data-copy-to-clipboard]').forEach((el) => {
        el.addEventListener('click', (e) => {
            let textarea = document.getElementById(el.getAttribute('data-copy-to-clipboard'));

            if (textarea) {
                _copyToClipboard(textarea.value);
            } else {
                _copyToClipboard(el.getAttribute('data-copy-to-clipboard'));
            }
        });
    });

    document.querySelectorAll('[data-tabs]').forEach((el) => {
        el.addEventListener('click', (e) => {
            document.querySelectorAll('[data-tab]').forEach((el) => { el.style.display = 'none'; });
            document.querySelectorAll('[data-tab="' + el.getAttribute('data-tabs') + '"]').forEach((el) => {  el.style.display = 'block'; });
        });
    });

    setTimeout(() => {
        console.log('height', document.body.offsetHeight);
        if (document.querySelector('[data-tab="1"]').offsetHeight > 600) {
            const el = document.querySelector('.scroll-down');
            if (el) { el.style.display = 'block'; }
        }
    }, 250);
}

function _copyToClipboard(text) {
    if (text) {
        let copyEl = document.getElementById("copy-to-clipboard-input");
        copyEl.value = text;
        copyEl.select();
        copyEl.setSelectionRange(0, 99999);

        navigator.clipboard.writeText(copyEl.value);
    }
}
