import OPTIONS from "./constants";

import './content.css';

function getMetadata() {
  const metadata = {
    currentDoc: {
        host: window.location.host,
        path: window.location.pathname
    },
    kt: getMetas("kt"),
    team: getMeta("team"),
    gitEdit: getMeta("git-edit"),
    gitRepo: getMeta("git-repo"),
    gitFilename: getMeta("git-filename"),
    lastUpdated: getMeta("last-update"),
    buildDate: getMeta("build-date"),
    thumbnail: getMeta("thumbnail"),
    publishUrl: getMeta("publish-url"),
    versions: getMetas("version"),
    topics: getMetas("topics"),
    features: getMetas("feature"),

    videos: getMpcVideos(),
  };

  return metadata;
}

function getMeta(name) {
  let el = document.querySelector("meta[name='" + name + "']");

  if (el) {
    let content = el.getAttribute("content");
    if (content) {
      return content;
    }
  }

  return null;
}

function getMetas(name) {
  let value = getMeta(name);
  if (value) {
    let values = value.split(",");
    return values.map((val) => val.trim());
  } else {
    return null;
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


/** Extra styles */

chrome.storage.sync.get(OPTIONS.EXTRA_STYLES, function (optionsObj) {
    let optionsExtraStyles = optionsObj[OPTIONS.EXTRA_STYLES] || 'none';

    if (optionsExtraStyles && 
            optionsExtraStyles !== 'none' && 
            _isExLDocs()) {
        
        var path = chrome.extension.getURL(`${optionsExtraStyles}.css`);
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