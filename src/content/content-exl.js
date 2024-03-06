import add from "add";
import OPTIONS from "../constants";

import { initExtraMenu } from "./extra/menu/menu.js";
import "./content.css";

function getAnalyticsPageName() {
  // https://git.corp.adobe.com/GP/website/blob/master/src/js/common/analytics.js

  /*
  const type = document.querySelector('meta[name="type"]') !== null ? document.querySelector('meta[name="type"]').content.split(',')[0].trim().toLowerCase() : '';
  let solution = document.querySelector('meta[name="solution"]') !== null ? document.querySelector('meta[name="solution"]').content.split(',')[0].trim().toLowerCase() : `fb ${(((/^\/docs\/([^\/]+)\//).exec(location.pathname) || [])[1] || '').replace(/[-\d+\s+]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  let subsolution = document.querySelector('meta[name="sub-solution"]') !== null ? document.querySelector('meta[name="sub-solution"]').content.split(',')[0].trim().toLowerCase() : '';
  let solutionversion = document.querySelector('meta[name="version"]') !== null ? document.querySelector('meta[name="version"]').content : '';
  */

  const type =
    document.head.querySelector('meta[name="type"]') !== null
      ? document.head
          .querySelector('meta[name="type"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : "";
  let solution =
    document.head.querySelector('meta[name="solution"]') !== null
      ? document.head
          .querySelector('meta[name="solution"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : `fb ${((/^\/docs\/([^\/]+)\//.exec(location.pathname) || [])[1] || "")
          .replace(/[-\d+\s+]/g, " ")
          .replace(/\s+/g, " ")
          .trim()}`;
  let subsolution =
    document.head.querySelector('meta[name="sub-solution"]') !== null
      ? document.head
          .querySelector('meta[name="sub-solution"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : "";
  //let solutionversion = document.querySelector('meta[name="version"]') !== null ? document.querySelector('meta[name="version"]').content : '';

  const title =
    document.head.querySelector('meta[name="english-title"]')?.content ||
    document.head.querySelector("title").innerText.split("|")[0].trim();

  // Should look like: xl:docs:experience manager:tutorial:osgi services development basics"
  const pageName = `xl:docs:${solution}:${type}:${
    subsolution ? subsolution + ":" : ""
  }${title}`.toLowerCase();

  return pageName;
}

function getMetadata() {
  const metadata = {
    website: "EXPERIENCE LEAGUE",
    currentDoc: {
      host: window.location.host,
      path: window.location.pathname,
    },
    language: document.documentElement.lang || "en",
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
    duration: getMeta("duration"), // in seconds
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
    recommendations: getMetas("recommendations"),
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
  let results = [];
  let videoElements =
    [
      ...document.querySelectorAll(
        "iframe[embedded-video], iframe[src^='https://video.tv.adobe.com/v/']"
      ),
    ] || [];
  if (videoElements) {
    results = videoElements.map((videoElement) =>
      videoElement.getAttribute("src")
    );
  } else {
    videoElements =
      [
        ...document.querySelectorAll(
          "a[href^='https://video.tv.adobe.com/v/']"
        ),
      ] || [];
    results = videoElements.map((videoElement) =>
      videoElement.getAttribute("href")
    );
  }
  return results;
}

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

// Listen for Popup 
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // If the received message has the expected format...
  if (msg.text === "collect_adobedocs_metadata") {
    let metadata = getMetadata();
    sendResponse(metadata);
  }
});


/** Beta  */
initExtraMenu();