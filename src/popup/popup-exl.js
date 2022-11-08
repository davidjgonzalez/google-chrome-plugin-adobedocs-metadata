import moment from 'moment';
import OPTIONS from "../constants";
import { getResourcesTabHtml } from "./popup-common";

import '@spectrum-web-components/status-light';

const Missing = {
    ERROR: 'error',
    NOTICE: 'notice',
    OK: 'ok'
};

export default function experienceLeaguePopup(response, callback) {

   chrome.storage.sync.get(OPTIONS.FS_CONTENT_ROOT, function (optionsObj) {

        let optionsContentRoot = _getOptionsContentFileSystemPath(optionsObj);
        
        let html = `
                    
            ${getStatus(response)}

            <sp-tabs selected="1">
                <sp-tab data-tabs="1" label="General" value="1"></sp-tab>
                <sp-tab data-tabs="2" label="Metadata" value="2"></sp-tab>
                <sp-tab data-tabs="3" label="Resources" value="3"></sp-tab>
            </sp-tabs>

            <div data-tab="1" class="tab-content">
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
                    getDisplayButton(getMeta("Type", response.type, "Missing")),
        
                    getDisplayButton(getDateTime("Last updated", response.lastUpdated)),
                    getDisplayButton(getDateTime("Last built", response.buildDate)),
                    getDisplayButton(getDateTime("Last substantial update", response.lastSubstantialUpdate)),
                            
                    getDisplayButton(getMeta("Hide from Search", response.hideFromSearch ? "Yes" : "No", "No")),
                    getDisplayButton(getMeta("Hide From TOC", response.hideFromToc ? "Yes" : "No",  "No")),
                  ])}      
                  
                  ${getSection("Thumbnail", [getThumbnail(response.thumbnail)])}

            </div>
            
            <div data-tab="2" class="tab-content">
                ${getTable([
                    getDisplayRow(getMeta("Title", response.title, "Missing", Missing.ERROR), "title"),
                    getDisplayRow(getMeta("Description", response.description, "Missing", Missing.ERROR), "description"),
                    getDisplayRow(getMeta("ExL ID", response.exlId, "Missing", Missing.ERROR), "N/A"),
                    getDisplayRow(getMeta("Article ID", response.articleId, "Missing", Missing.ERROR), "N/A"),
                    getDisplayRow(getMeta("Cloud", response.cloud, "Missing", Missing.ERROR), "cloud"),
                    getDisplayRow(getMetas("Product(s)", response.products, "Missing", Missing.ERROR), "product"),
                    getDisplayRow(getMetas("Solution(s)", response.solutions, "Missing", Missing.ERROR), "solution"),
                    getDisplayRow(getMetas("Version(s)", response.versions, null), "version"),

                    getDisplayRow(getMeta("Role", response.role, "Missing", Missing.ERROR), "role"),
                    getDisplayRow(getMeta("Level", response.level, "Missing", Missing.ERROR), "level"),

                    getDisplayRow(getMetas("Topic(s)", response.topics, "Missing", Missing.ERROR), "topic"),
                    getDisplayRow(getMetas("Feature(s)", response.features, "None"), "feature"),
                  
                    getDisplayRow(getMetas("Sub-product(s)", response.subproducts, "Missing", Missing.ERROR), "sub-product"),
                    getDisplayRow(getMeta("Doc-type", response.docType, "Missing", Missing.ERROR), "doc-type"),

                    getDisplayRow(getMeta("Last substantial update", response.lastSubstantialUpdate || "Not set", null), "last-substantial-update"),
                    getDisplayRow(getMeta("Recommendations", response.recommendations, "Default (Catalog, Display)", null), "recommendations"),
                ])}
            </div>

            <div data-tab="3" class="tab-content">
                ${getResourcesTabHtml()}                           
            </div>
        `;
        
        callback(html);

    });
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
  
  
  function getTable(rows) {
      let html = '';
    
      for (let i = 0; i < rows.length; i++) {
          html += rows[i];
      }
    
      if (html) {
        return `
            <br/>
            <table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
                <thead class="spectrum-Table-head">
                  <tr>
                    <th class="spectrum-Table-headCell" aria-sort="descending" tabindex="0">
                      Property
                    </th>
                    <th class="spectrum-Table-headCell" aria-sort="none">
                      Property value
                    </th>
                    <th class="spectrum-Table-headCell">Frontmatter name</th>
                  </tr>
                </thead>
                <tbody class="spectrum-Table-body">
                    ${html}
                </tbody>
            </table>`;
      } else {
        return '';
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
              <sp-icon-chevron-down size="xxs" slot="icon"></sp-icon-chevron-down>
  
              <span slot="label">Jira @ KT-${kt}</span>
  
              <sp-menu-item href="https://jira.corp.adobe.com/browse/KT-${kt}" target="jira_${kt}">
                  Open in Jira
              </sp-menu-item>
              <sp-menu-item data-copy-to-clipboard="KT-${kt}">
                  Copy 'KT-${kt}' to clipboard
              </sp-menu-item>               
          </sp-action-menu>`;
      }
  
    return html;
  }
  
  function getDateTime(title, lastUpdated) {
    if (!lastUpdated) {
      return '';
    }
  
    let m = moment(lastUpdated);
  
    return { 
        title: title,
        value: `${m.fromNow()} <em>(${m.format("MM/DD/YYYY")})</em>`
    };
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
          console.error("Could not get video id from: " + mpcVideoUrl);
        }
    
        if (videoId && !isNaN(videoId)) {
  
              list += `
              <sp-action-menu id="actionMenu_mpcVideos_${videoId}">
                  <sp-icon-chevron-down size="xxs" slot="icon"></sp-icon-chevron-down>
  
                  <span slot="label">MPC @ ${videoId}</span>

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
              </sp-action-menu>
              `;
  
        } else {
          console.error("Invalid video Id: " + videoId);
        }
      }
    
      if (!list) {
          return `<sp-action-button>No videos on the page</sp-action-button>`;
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
              <sp-icon-chevron-down size="xxs" slot="icon"></sp-icon-chevron-down>
  
              <span slot="label">Doc URLs</span>
  
              <sp-menu-item data-copy-to-clipboard="${HOST}${PATH}">
                  Copy 'clean' URL to clipboard
              </sp-menu-item>   
              <sp-menu-item href="https://${exlUrl}" target="_blank"">
                  Production (experienceleague.adobe.com)
              </sp-menu-item>
              <sp-menu-item href="https://${exlStageUrl}" target="_blank"">
                  Stage (experienceleague.corp.adobe.com)
              </sp-menu-item>
              <sp-menu-item href="https://${docsStageUrl}" target="_blank"">
                  Legacy stage (docs-stg.corp.adobe.com)
              </sp-menu-item>                                     
          </sp-action-menu>`;
  }
  
  function getMeta(title, value, missingValue, requirement) {
    let require;

    if (!value) {
      require = requirement;
      value = missingValue;
    }
  
    if (value !== null) {
      return {
          title: title,
          value: value,
          require: require
      };        
    } else {
      return {
      };
    }
  }
  
  function getMetas(title, values, missingValues, requirement) {
    let require;

    if (!values || values.length === 0) {
      
      require = requirement;

      if (missingValues) {
        if (Array.isArray(missingValues)) {
          values = missingValues;
        } else {
          values = [missingValues];
        }
      }
    }
  
    if (values && values.length > 0) {
      return {
          title: title,
          value: values.join(", "),
          require: require
      };
    } else {
      return {};
    }
  }
  
  function getDisplayButton(data) {
    if (data.title && data.value) {
      return `<sp-action-button>${data.title}: ${data.value}</sp-action-button>`;
    } else {
      return '';
    }
  }
  
    function getDisplayRow(data, property) {
        if (data.title && data.value) {

            let status = data.require || Missing.OK;

            return `
                <tr class="spectrum-Table-row metadata-${status.toLowerCase()}">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider">${data.title}</td>
                    <td class="spectrum-Table-cell" data-copy-to-clipboard="${data.value}">${data.value}</td>
                    <td class="spectrum-Table-cell" data-copy-to-clipboard="${property}">${property}</td>
                </tr>`;
        } else {
            return '';
        }
   }
  
    function getStatus(data) {
        if (isAnyMissing([data.exlId, data.products, data.title, data.description, data.cloud, data.solutions, data.role, data.level])) { 
            return `<div class="status"><sp-status-light size="M" variant="negative">Fix metadata</sp-status-light></div>`;
        } else {
            return `<div class="status"><sp-status-light size="M" variant="positive">Metadata good</sp-status-light></div>`;
        }
    }

    function isAnyMissing(values) {
        for (let i in values) {    
            if (isMissing(values[i])) { return true; }
        }

        return false;
    }

    function isMissing(value) {
        return !value || value?.length === 0;
    }