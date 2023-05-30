import OPTIONS from "../constants";

import './content.css';

function getAnalyticsPageName() {

  // https://git.corp.adobe.com/GP/website/blob/master/src/js/common/analytics.js

  /*
  const type = document.querySelector('meta[name="type"]') !== null ? document.querySelector('meta[name="type"]').content.split(',')[0].trim().toLowerCase() : '';
  let solution = document.querySelector('meta[name="solution"]') !== null ? document.querySelector('meta[name="solution"]').content.split(',')[0].trim().toLowerCase() : `fb ${(((/^\/docs\/([^\/]+)\//).exec(location.pathname) || [])[1] || '').replace(/[-\d+\s+]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  let subsolution = document.querySelector('meta[name="sub-solution"]') !== null ? document.querySelector('meta[name="sub-solution"]').content.split(',')[0].trim().toLowerCase() : '';
  let solutionversion = document.querySelector('meta[name="version"]') !== null ? document.querySelector('meta[name="version"]').content : '';
  */

  const type = document.querySelector('meta[name="type"]') !== null ? document.querySelector('meta[name="type"]').content.split(',')[0].trim().toLowerCase() : '';
  let solution = document.querySelector('meta[name="solution"]') !== null ? document.querySelector('meta[name="solution"]').content.split(',')[0].trim().toLowerCase() : `fb ${(((/^\/docs\/([^\/]+)\//).exec(location.pathname) || [])[1] || '').replace(/[-\d+\s+]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  let subsolution = document.querySelector('meta[name="sub-solution"]') !== null ? document.querySelector('meta[name="sub-solution"]').content.split(',')[0].trim().toLowerCase() : '';
  //let solutionversion = document.querySelector('meta[name="version"]') !== null ? document.querySelector('meta[name="version"]').content : '';

  const title = document.querySelector('title').innerText.split('|')[0].trim();
  
  // Should look like: xl:docs:experience manager:tutorial:osgi services development basics"
  const pageName = `xl:docs:${solution}:${type}:${subsolution ? subsolution + ':' : ''}${title}`.toLowerCase();

  return pageName;
}

function getMetadata() {

  const metadata = {
    website: 'EXPERIENCE LEAGUE',
    currentDoc: {
        host: window.location.host,
        path: window.location.pathname
    },
    analyticsPageName: getAnalyticsPageName(),
    description: getMeta("description"),
    gitEdit: getMeta("git-edit"),
    gitRepo: getMeta("git-repo"),
    gitFilename: getMeta("git-filename"),
    lastUpdated: getMeta("last-update"),
    buildDate: getMeta("build-date"),
    publishUrl: getMeta("publish-url"),
    videos: getMpcVideos(),

    cloud: getMeta("cloud"),
    description: getMetas("description"),
    features: getMetas("feature"),
    hideFromSearch: getMeta("hide") === "true",
    hideFromToc: getMeta("hidefromtoc") === "true",
    kt: getMetas("kt"),
    jira: getMetas("jira"),
    level: getMeta("level"),
    products: getMetas("product"),
    role: getMetas("role"),
    articleId: getMeta("id"),
    lastSubstantialUpdate: getMeta("last-substantial-update"),
    exlId: getMeta("exl-id"),
    solutions: getMetas("solution"),
    subproducts: getMetas("sub-product"),
    docType: getMeta("doc-type"),
    thumbnail: getMeta("thumbnail"),
    title: getElementText("title"),
    topics: getMetas("topic"),
    type: getMeta("type"),
    versions: getMetas("version"),
    recommendations: getMetas("recommendations")
  };

  return metadata;
}

function getMeta(name, defaultValue) {
  let el = document.querySelector("meta[name='" + name + "']");

  if (el) {
    let content = el.getAttribute("content");
    if (content) {
      return content;
    }
  }

  return defaultValue ? defaultValue : null;
}

function getMetas(name, defaultValues) {
  let value = getMeta(name);
  if (value) {
    let values = value.split(",");
    return values.map((val) => val.trim());
  } else {
    return defaultValues ? defaultValues : null;
  }
}

function getMpcVideos() {
  let vidoesUrls = [];
  let videoElements = document.querySelectorAll("iframe[embedded-video]");

  for (let i = 0; i < videoElements.length; i++) {
    let videoElement = videoElements[i];
    vidoesUrls.push(videoElement.getAttribute("src"));
  }

  return vidoesUrls;
}

// Listen for messages
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // If the received message has the expected format...
  if (msg.text === "collect_adobedocs_metadata") {
    let metadata = getMetadata();
    sendResponse(metadata);
  }
});

function getElementText(name, defaultValue) {
    let el = document.querySelector(name);
  
    if (el) {
      let content = el.innerText;
      if (content) {
        return content;
      }
    }
  
    return defaultValue ? defaultValue : null;
  }


/** Extra styles */


chrome.storage.local.get(OPTIONS.EXTRA_STYLES, function (optionsObj) {
    let optionsExtraStyles = optionsObj[OPTIONS.EXTRA_STYLES] || 'none';

    if (optionsExtraStyles && 
            optionsExtraStyles !== 'none' && 
            _isExLDocs()) {
        
        var path = chrome.runtime.getURL(`${optionsExtraStyles}.css`);
        document.body.setAttribute("id", optionsExtraStyles);
        document.head.innerHTML = `<link rel="stylesheet" type="text/css" media="print,screen" href="${path}"></link>` + document.head.innerHTML;    
    } 

    if (_isExLDocs()) {
        var appEl = document.getElementById("app");
        appEl.style.display = 'block';

        var footerEl = document.getElementById("footer");
        footerEl.style.display = 'block';
    }
});


function _isExLDocs() {
    return window.location.hostname.indexOf('experienceleague.') === 0 && window.location.pathname.indexOf('/docs/') === 0;
}

function _injectScript(file, selector) {
  setTimeout(() => {
    var th = document.querySelector(selector);
    var s = document.createElement('script');
    s.setAttribute('type', 'text/javascript');
    s.setAttribute('src', file);
    th.appendChild(s);
  }, 1000);
}
