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
          
          let head = document.getElementsByTagName("head")[0];        
          let metaRefresh = document.createElement("meta");
          metaRefresh.setAttribute("http-equiv", "refresh");
          metaRefresh.setAttribute("content", "2");
          head.appendChild(metaRefresh);

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

          ${getSection("Videos", [
              getVideosMultiControl(response.videos)
          ])}

          ${getSection("Doc details", [
            getMeta("Type", response.type, "Missing"),

            getDateTime("Last updated", response.lastUpdated),
            getDateTime("Last built", response.buildDate),

            getMeta("Hide (from Google)", response.hide, response.hide ? "Yes" : "No"),
            getMeta("Allow as Google snippet", response.snippet, response.snippet ? "Yes" : "No"),
            getMeta("Hide From TOC", response.hideFromToc, response.hideFromToc ? "No" : "Yes"),
          ])}

          ${getSection("Doc metadata", [
            //getMeta("Title", response.title, "Missing"),
            //getMeta("Description", response.description, "Missing"),

            getMetas("Solution(s)", response.solutions, "Missing"),
            getMetas("Product(s)", response.products, "Missing"),
            getMetas("Sub-Product(s)", response.subproducts, null),
            getMetas("Version(s)", response.versions, null),

            getMetas("Feature(s)", response.features, "None"),
            getMetas("Topic(s)", response.topics, "None"),

            getMeta("Role", response.role, "Missing"),
            getMeta("Level", response.level, "Missing")
          ])}

          ${getSection("Thumbnail", [getThumbnail(response.thumbnail)])}
        `;

        /*
        document.querySelectorAll('sp-action-button[href]').forEach((el) => {
            el.addEventListener('click', (e) => {
                el.setAttribute('selectedItemText', '');
                window.open(el.getAttribute('href'), el.getAttribute('target') || null);
            });
        });
        */

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
    //html += `<sp-action-button href="https://jira.corp.adobe.com/browse/KT-${kt}" target="_blank">Jira @ KT-${kt}</sp-action-button>`
    if (kt === 'None' || kt === 'none') {
        continue;

    }
    html += `
        <sp-action-menu id="actionMenu_jira_${kt}" placement="bottom-end">
            <sp-icon slot="icon" size="xxs" name="ui:ChevronDownSmall"></sp-icon>

            <span slot="label">Jira @ KT-${kt}</span>
            <sp-menu>
                <sp-menu-item href="https://jira.corp.adobe.com/browse/KT-${kt}" target="jira_${kt}">
                    Open in Jira
                </sp-menu-item>
                <sp-menu-item data-copy-to-clipboard="KT-${kt}">
                    Copy 'KT-${kt}' to clipboard
                </sp-menu-item>               
            </sp-menu>
        </sp-action-menu>`;
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
  if (!contentRoot || !gitRepo || !filename) {
    return '';
  }

  const gitRepoName = gitRepo.substring(gitRepo.lastIndexOf("/") + 1);
  const fileSystemPath = `${contentRoot}${gitRepoName}/${filename}`;

  return `<sp-action-button href="vscode://file/${fileSystemPath}">Open in VS Code</sp-action-button>`       
}

function getThumbnail(thumbnailId) {
  if (!thumbnailId) {
    return '<div class="thumbnail thumbnail--missing">Thumbnail not set</div>';
  }

  return `
    <sp-action-button href="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" target="thumbnail_${thumbnailId}">
        ${thumbnailId}
    </sp-action-button>
    <br/>
    <img src="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" 
        class="thumbnail thumbnail--image"/>
    <div class="thumbnail thumbnail--missing-on-cdn">
        ${thumbnailId} <span class="thumbnail--missing-on-cdn-message">missing on CDN</span>
    </div>
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
                       Open in MPC Admin console
                    </sp-menu-item>
                    <sp-menu-item href="https://video.tv.adobe.com/v/${videoId}/?quality=12&amp;learn=on" target="mpcDirectVideo_${videoId}">
                        Direct video link
                    </sp-menu-item>
                    <sp-menu-item data-copy-to-clipboard="${videoId}">
                        Copy '${videoId}' to clipboard
                    </sp-menu-item>  
                    <sp-menu-item data-copy-to-clipboard="<iframe width=&quot;1280&quot; height=&quot;720&quot; src=&quot;https://video.tv.adobe.com/v/${videoId}/?quality=12&amp;learn=on&quot; frameborder=&quot;0&quot; webkitallowfullscreen mozallowfullscreen allowfullscreen scrolling=&quot;no&quot;></iframe>">
                        Copy embed code to clipboard
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
                <sp-menu-item href="https://${exlUrl}" target="_blank"">
                    Production (experienceleague.adobe.com)
                </sp-menu-item>
                <sp-menu-item href="https://${exlStageUrl}" target="_blank"">
                    Stage (experienceleague.corp.adobe.com)
                </sp-menu-item>
                <sp-menu-item href="https://${docsStageUrl}" target="_blank"">
                    Legacy stage (docs-stg.corp.adobe.com)
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
