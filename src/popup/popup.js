"use strict";

import "@spectrum-css/vars/dist/spectrum-global.css";
import "@spectrum-css/vars/dist/spectrum-medium.css";
import "@spectrum-css/vars/dist/spectrum-light.css";
import "@spectrum-css/page/dist/index-vars.css";
import "@spectrum-css/button/dist/index-vars.css";
import "@spectrum-css/alert/dist/index-vars.css";

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

        ul.innerHTML += `
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

          ${getSection("Video links", [getMpcVideos(response.videos)])}

          ${getSection("Doc details", [
            getLastUpdated("Last updated", response.lastUpdated),
            getMeta("Team", response.team, null),
            getMetas("Versions", response.versions, null),
            getMetas("Topics", response.topics, "None"),
            getMetas("Features", response.features, "None"),
            getThumbnail(response.thumbnail),
          ])}
        `;
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
    html += `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
              href="https://jira.corp.adobe.com/browse/${kt}" target="_blank">
              <span class="spectrum-ActionButton-label">Jira @ KT-${kt}</span>
            </a>`;
  }

  return html;
}

function getLastUpdated(title, lastUpdated) {
  if (!lastUpdated) {
    return '';
  }

  let m = moment(lastUpdated);

  return  `<button class="spectrum-ActionButton is-selected">
            <span class="spectrum-ActionButton-label">${title}: ${m.fromNow()} <em>(${m.format("MM/DD/YYYY")})</em></span>
          </button>`;

}

function getCorpGitEdit(publicGitEdit) {
  if (!publicGitEdit) {
    return '';
  }

  const corpGitEdit = publicGitEdit.replace(
    "//github.com/",
    "//git.corp.adobe.com/"
  );

  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="${corpGitEdit}" target="_blank">
          <span class="spectrum-ActionButton-label">Adobe Corp Git</span>
          </a>`;
}

function getPublicGitEdit(publicGitEdit) {
  if (!publicGitEdit) {
    return '';
  }

  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="${publicGitEdit}" target="_blank">
          <span class="spectrum-ActionButton-label">Github.com</span>
          </a>`;
}

function getVsCode(contentRoot, gitRepo, filename) {
  if (!contentRoot) {
    return '';
  }

  const gitRepoName = gitRepo.substring(gitRepo.lastIndexOf("/") + 1);
  const fileSystemPath = `${contentRoot}${gitRepoName}/${filename}`;

  return `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
            href="vscode://file/${fileSystemPath}">
          <span class="spectrum-ActionButton-label">Open in VS Code</span>
          </a>`;
}

function getThumbnail(thumbnailId) {
  if (!thumbnailId) {
    return '';
  }

  return `
    <a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
              href="https://cdn.experienceleague.adobe.com/thumb/${thumbnailId}" target="thumbnail_${thumbnailId}">
          <span class="spectrum-ActionButton-label">Thumbnail: ${thumbnailId}</span>
    </a>
  `;
}

function getMpcVideos(mpcVideoUrls) {
  let list = "";

  if (!mpcVideoUrls) {
    return '';
  }

  for (const mpcVideoUrl of mpcVideoUrls) {
    const videoIdRegex = /https:\/\/video.tv.adobe.com\/v\/(\d+)[\/?]+.*/gi;

    let videoId = null;

    console.log(videoIdRegex);
    console.log(mpcVideoUrl);
    let match = videoIdRegex.exec(mpcVideoUrl);

    console.log(match);

    console.log("----");

    if (match && match.length === 2) {
      videoId = match[1];
    } else {
      console.log("Could not get video id from: " + mpcVideoUrl);
    }

    if (videoId && !isNaN(videoId)) {
      list += `<a class="spectrum-ActionButton spectrum-ActionButton--emphasized"
                  href="https://publish.tv.adobe.com/search?q=${videoId}" target="mpcVideo_${videoId}">
                <span class="spectrum-ActionButton-label">${videoId}</span>
              </a>`;
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

function getMeta(title, value, missingValue) {
  if (!value) {
    value = missingValue;
  }

  if (value !== null) {
    return `<button class="spectrum-ActionButton is-selected">
              <span class="spectrum-ActionButton-label">${title}: ${value}</span>
            </button>`;
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
    return `<button class="spectrum-ActionButton is-selected">
              <span class="spectrum-ActionButton-label">${title}: ${values.join(
      ", "
    )}</span>
            </button>`;
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
