"use strict";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-light.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";

import "@spectrum-css/alert/dist/index-vars.css";

import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/action-menu/sp-action-menu.js';
import '@spectrum-web-components/button/sp-button.js';
import '@spectrum-web-components/button/sp-clear-button.js';
import '@spectrum-web-components/button/sp-action-button.js';

import "./popup.css";

import moment from 'moment';
import OPTIONS from "../constants";

chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
  chrome.tabs.sendMessage(
    tabs[0].id,
    { text: "collect_adobedocs_metadata" },
    function (response) {
      
        if (!response) {
          document.getElementById("error-alert").style.display = 'block';
          return;
      }

      chrome.storage.sync.get(OPTIONS.FS_CONTENT_ROOT, function (optionsObj) {
        let optionsContentRoot = _getOptionsContentFileSystemPath(optionsObj);

        let ul = document.getElementById("metadata");

        ul.innerHTML = `
          ${getSection("Links", [
            getJira(response.kt),
            getCorpGitEdit(response.gitEdit),
            getPublicGitEdit(response.gitEdit),
            getVsCode(
              optionsContentRoot,
              response.gitRepo,
              response.gitFilename
            ),
          ])}

          ${getSection("Videos", [getVideosMultiControl(response.videos)])}

          ${getSection("Doc details", [
            getLastUpdated("Last updated", response.lastUpdated),
            getMeta("Team", response.team, null),
            getMetas("Versions", response.versions, null),
            getMetas("Topics", response.topics, "None"),
            getMetas("Features", response.features, "None"),
            getThumbnail(response.thumbnail),
          ])}
        `;

        document.querySelectorAll('sp-action-button[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
                el.setAttribute('selectedItemText', '');
                window.open(el.getAttribute('href'), el.getAttribute('target') || null);
            });
        });
      });
    }
  );
});

function getSection(sectionTitle, lists) {
  let html = '';

  for (let i = 0; i < lists.length; i++) {
    html += lists[i];
  }

  if (html) {
    return `<div>
      <p class="spectrum-Heading spectrum-Heading--L spectrum-Heading--light">${sectionTitle}</p>
      <sp-button-group>
        ${html}
      </sp-button-group>
    </div>`;
  } else {
    return "";
  }
}

function getJira(kts) {
  if (!kts) {
    return '';
  }

  let html = '';
  
  for (let kt of kts) {
    /*
    html += `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
              href="https://jira.corp.adobe.com/browse/${kt}" target="_blank">
              <span class="spectrum-ActionButton-label">Jira @ KT-${kt}</span>
            </a>`;
    */

    html += `<sp-action-button href="https://jira.corp.adobe.com/browse/KT-${kt}" target="_blank">Jira @ KT-${kt}</sp-action-button>`
  }

  return html;
}

function getLastUpdated(title, lastUpdated) {
  if (!lastUpdated) {
    return '';
  }

  let m = moment(lastUpdated);

  return ` <sp-action-button selected>${title}: ${m.fromNow()} <em>(${m.format("MM/DD/YYYY")})</sp-action-button>`
}

function getCorpGitEdit(publicGitEdit) {
  if (!publicGitEdit) {
    return '';
  }

  const corpGitEdit = publicGitEdit.replace(
    "//github.com/",
    "//git.corp.adobe.com/"
  );

  return `<sp-action-button href="${corpGitEdit}" target="_blank">Adobe Corp Git</sp-action-button>`

  /*
  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="${corpGitEdit}" target="_blank">
          <span class="spectrum-ActionButton-label">Adobe Corp Git</span>
          </a>`;
    */          
}

function getPublicGitEdit(publicGitEdit) {
  if (!publicGitEdit) {
    return '';
  }

  return `<sp-action-button href="${publicGitEdit}" target="_blank">Github.com</sp-action-button>`

  /*
  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="${publicGitEdit}" target="_blank">
          <span class="spectrum-ActionButton-label">Github.com</span>
          </a>`;
    */          
}

function getVsCode(contentRoot, gitRepo, filename) {
  if (!contentRoot) {
    return '';
  }

  const gitRepoName = gitRepo.substring(gitRepo.lastIndexOf("/") + 1);
  const fileSystemPath = `${contentRoot}${gitRepoName}/${filename}`;

  return `<sp-action-button href="vscode://file/${fileSystemPath}">Open in VS Code</sp-action-button>`


  /*
  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="vscode://file/${fileSystemPath}">
          <span class="spectrum-ActionButton-label">Open in VS Code</span>
          </a>`;
    */          
}

function getThumbnail(thumbnailId) {
  if (!thumbnailId) {
    return '';
  }

  return `<sp-action-button href="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" target="thumbnail_${thumbnailId}">
             Thumbnail: ${thumbnailId}
          </sp-action-button>`;
}


function getVideos(mpcVideoUrls, renderFunction) {
    let list = "";
  
    if (!mpcVideoUrls) {
      return '';
    }
  
    for (const mpcVideoUrl of mpcVideoUrls) {
      const videoIdRegex = /https:\/\/video.tv.adobe.com\/v\/(\d+)[\/?]+.*/gi;
  
      let videoId = null;  
      let match = videoIdRegex.exec(mpcVideoUrl);
  
      if (match && match.length === 2) {
        videoId = match[1];
      } else {
        console.log("Could not get video id from: " + mpcVideoUrl);
      }
  
      if (videoId && !isNaN(videoId)) {
        list += renderFunction(videoId);
      } else {
        console.error("Invalid video Id: " + videoId);
      }
    }
  
    if (!list) {
      return `<button class="spectrum-ActionButton is-selected">
                <span class="spectrum-ActionButton-label">No videos</span>
              </button>`;
    } else {
      return list;
    }
  }
  

function getVideosMultiControl(mpcVideoUrls) {
    let list = "";
  
    if (!mpcVideoUrls) {
      return '';
    }
  
    for (const mpcVideoUrl of mpcVideoUrls) {
      const videoIdRegex = /https:\/\/video.tv.adobe.com\/v\/(\d+)[\/?]+.*/gi;
  
      let videoId = null;  
      let match = videoIdRegex.exec(mpcVideoUrl);
  
      if (match && match.length === 2) {
        videoId = match[1];
      } else {
        console.log("Could not get video id from: " + mpcVideoUrl);
      }
  
      if (videoId && !isNaN(videoId)) {
        //list += renderFunction(videoId);

            list += `
            <sp-action-menu placement="top-start">
                <sp-icon slot="icon" size="xxs" name="ui:ChevronDownSmall"></sp-icon>
                <span slot="label">MPC @ ${videoId}</span>
                <sp-menu>
                    <sp-menu-item href="https://publish.tv.adobe.com/search?q=${videoId}" target="mpcAdminConsole_${videoId}">
                        MPC Admin console
                    </sp-menu-item>
                    <sp-menu-item href="https://video.tv.adobe.com/v/${videoId}/?quality=12&amp;learn=on" target="mpcDirectVideo_${videoId}">
                        Direct video link
                    </sp-menu-item>
                    <sp-menu-item>
                        Copy '${videoId}' to clipboard
                    </sp-menu-item>               
                </sp-menu>
            </sp-action-menu>
            `;

      } else {
        console.error("Invalid video Id: " + videoId);
      }
    }
  
    if (!list) {
        return `<sp-action-button selected>No videos on the page</sp-action-button>`;
    } else {
      return list;
    }
  }

function renderMpcAdminConsoleLinks(videoId) {
    return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
                href="https://publish.tv.adobe.com/search?q=${videoId}" target="mpcAdminConsole_${videoId}">
                    <span class="spectrum-ActionButton-label">${videoId}</span>
            </a>`;
}

function renderMpcDirectVideoLinks(videoId) {
    return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
                href="https://video.tv.adobe.com/v/${videoId}/?quality=12&amp;learn=on" target="mpcDirectVideo_${videoId}">
                    <span class="spectrum-ActionButton-label">${videoId}</span>
            </a>`;
}


function getMeta(title, value, missingValue) {
  if (!value) {
    value = missingValue;
  }

  if (value !== null) {
    return `<sp-action-button selected>${title}: ${value}</sp-action-button>`;
  } else {
    return "";
  }
}

function getMetas(title, values, missingValues) {
  if (!values || values.length === 0) {
    if (missingValues) {
      if (Array.isArray(missingValues)) {
        values = missingValues;
      } else {
        values = [missingValues];
      }
    }
  }

  if (values && values.length > 0) {
    return `<sp-action-button selected>${title}: ${values.join(", ")}</sp-action-button>`;
  } else {
    return "";
  }
}

function _getOptionsContentFileSystemPath(obj) {
  let value = obj[OPTIONS.FS_CONTENT_ROOT];

  if (value && value.length > 0) {
    if (value.charAt(value.length - 1) !== "/") {
      value = value + "/";
    }

    return value;
  }

  return "";
}

function _copyToClipboard(text) {
    let copyEl = document.getElementById("copy-paste-input");
    copyEl.value = text;
    copyEl.select();
    copyEl.setSelectionRange(0, 99999);
    document.execCommand("copy");
    alert(copyEl.value);
    //copyEl.value = '';
}
