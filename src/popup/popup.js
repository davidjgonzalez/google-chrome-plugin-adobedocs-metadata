"use strict";

import "@spectrum-web-components/theme/sp-theme.js";
import "@spectrum-web-components/theme/theme-light.js";
import "@spectrum-web-components/theme/scale-medium.js";
import "@spectrum-web-components/action-menu/sp-action-menu.js";
import "@spectrum-web-components/menu/sp-menu.js";
import "@spectrum-web-components/menu/sp-menu-item.js";

import "@spectrum-css/alert/dist/index-vars.css";

import '@spectrum-web-components/icon/sp-icon.js';
import '@spectrum-web-components/icons/sp-icons-medium.js';

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
          ${getSection("Quick links", [
            getPageLinks(response.currentDoc.host, response.currentDoc.path),
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
            getDateTime("Last updated", response.lastUpdated),
            getDateTime("Build date", response.buildDate),
            getMeta("Team", response.team, null),
            getMetas("Versions", response.versions, null),
            getMetas("Topics", response.topics, "None"),
            getMetas("Features", response.features, "None"),
          ])}

          ${getSection("Thumbnail", [getThumbnail(response.thumbnail)])}
        `;

        document.querySelectorAll('sp-action-button[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
                el.setAttribute('selectedItemText', '');
                window.open(el.getAttribute('href'), el.getAttribute('target') || null);
            });
        });

        document.querySelectorAll('[data-copy-to-clipboard]').forEach((el) => {
            el.addEventListener('click', (e) => {
                _copyToClipboard(el.getAttribute('data-copy-to-clipboard'));
            });
        });

        document.querySelectorAll('sp-action-menu').forEach((activeEl) => {
            activeEl.addEventListener('mousedown', (e) => {
                console.log("mousedown!");
                document.querySelectorAll('sp-action-menu[open]').forEach((el) => {
                    if (activeEl.getAttribute('id') !== el.getAttribute('id')) {
                        el.toggleAttribute('open');
                        console.log("Closed the open: " + el.getAttribute("id")); 
                    }
                });
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
      <div>
        ${html}
      </div>
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
    html += `<sp-action-button href="https://jira.corp.adobe.com/browse/KT-${kt}" target="_blank">Jira @ KT-${kt}</sp-action-button>`
  }

  return html;
}

function getDateTime(title, lastUpdated) {
  if (!lastUpdated) {
    return '';
  }

  let m = moment(lastUpdated);

  return ` <sp-action-button selected>${title}: ${m.fromNow()} <em>(${m.format("MM/DD/YYYY")})</em></sp-action-button>`
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
}

function getPublicGitEdit(publicGitEdit) {
  if (!publicGitEdit) {
    return '';
  }

  return `<sp-action-button href="${publicGitEdit}" target="_blank">Github.com</sp-action-button>`        
}

function getVsCode(contentRoot, gitRepo, filename) {
  if (!contentRoot) {
    return '';
  }

  const gitRepoName = gitRepo.substring(gitRepo.lastIndexOf("/") + 1);
  const fileSystemPath = `${contentRoot}${gitRepoName}/${filename}`;

  return `<sp-action-button href="vscode://file/${fileSystemPath}">Open in VS Code</sp-action-button>`       
}

function getThumbnail(thumbnailId) {
  if (!thumbnailId) {
    return '<div class="thumbnail thumbnail--missing">Missing</div>';
  }

  return `
    <sp-action-button href="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" target="thumbnail_${thumbnailId}">
        ${thumbnailId}
    </sp-action-button>
    <br/>
    <img src="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" class="thumbnail"/>
    `;
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

            list += `
            <sp-action-menu id="actionMenu_mpcVideos_${videoId}" placement="bottom-end">
                <sp-icon slot="icon" size="xxs" name="ui:ChevronDownSmall"></sp-icon>

                <span slot="label">MPC @ ${videoId}</span>
                <sp-menu>
                    <sp-menu-item href="https://publish.tv.adobe.com/search?q=${videoId}" target="mpcAdminConsole_${videoId}">
                        MPC Admin console
                    </sp-menu-item>
                    <sp-menu-item href="https://video.tv.adobe.com/v/${videoId}/?quality=12&amp;learn=on" target="mpcDirectVideo_${videoId}">
                        Direct video link
                    </sp-menu-item>
                    <sp-menu-item data-copy-to-clipboard="${videoId}">
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


function getPageLinks(host, path) {
    const DOCS_PROD_DOMAIN = 'docs.adobe.com';
    const DOCS_STAGE_DOMAIN = 'docs-stg.corp.adobe.com';
    const EXL_PROD_DOMAIN = 'experienceleague.adobe.com';
    const EXL_STAGE_DOMAIN = 'experienceleague.corp.adobe.com';

    // <meta name="publish-url" content="https://experienceleague.corp.adobe.com/docs/experience-manager-learn/foundation/security/develop-for-cross-origin-resource-sharing.html">
    // <meta name="publish-url" content="https://docs.adobe.com/content/help/en/experience-manager-learn/assets/overview.html">

    const HOST = host;
    const PATH = path;
    const DOCS_PATH_PREFIX = '/content/help/en';
    const EXL_PATH_PREFIX = '/docs';

    let docsUrl;
    let docsStageUrl;
    let exlUrl;
    let exlStageUrl;

    debugger 

    if (HOST === DOCS_PROD_DOMAIN || HOST === DOCS_STAGE_DOMAIN) {
        docsUrl = DOCS_PROD_DOMAIN + PATH;
        docsStageUrl = DOCS_STAGE_DOMAIN + PATH;
        exlUrl = EXL_PROD_DOMAIN + EXL_PATH_PREFIX + PATH.substring(DOCS_PATH_PREFIX.length);
        exlStageUrl = EXL_STAGE_DOMAIN + EXL_PATH_PREFIX + PATH.substring(DOCS_PATH_PREFIX.length);
    } else {
        docsUrl = DOCS_PROD_DOMAIN + DOCS_PATH_PREFIX + PATH.substring(EXL_PATH_PREFIX.length);
        docsStageUrl = DOCS_STAGE_DOMAIN + DOCS_PATH_PREFIX + PATH.substring(EXL_PATH_PREFIX.length);
        exlUrl = EXL_PROD_DOMAIN + PATH;
        exlStageUrl = EXL_STAGE_DOMAIN + PATH;
    }

    return `
        <sp-action-menu id="actionMenu_pageLinks" placement="bottom-start">
            <sp-icon slot="icon" size="xxs" name="ui:ChevronDownSmall"></sp-icon>

            <span slot="label">Doc urls</span>
            <sp-menu>
                <sp-menu-item href="https://${docsUrl}" target="_blank"">
                    Production (docs.adobe.com)
                </sp-menu-item>
                <sp-menu-item href="https://${docsStageUrl}" target="_blank"">
                    Stage (docs-stg.corp.adobe.com)
                </sp-menu-item>
                <sp-menu-item href="https://${exlUrl}" target="_blank"">
                    Production (experienceleague.adobe.com)
                </sp-menu-item>
                <sp-menu-item href="https://${exlStageUrl}" target="_blank"">
                    Stage (experienceleague.corp.adobe.com)
                </sp-menu-item>                         
            </sp-menu>
        </sp-action-menu>`;
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
    if (text) {
        let copyEl = document.getElementById("copy-to-clipboard-input");
        copyEl.value = text;
        copyEl.select();
        document.execCommand("copy");
    }
}
