export async function getExlMetadata(url) {

  const response = await fetch(url);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  console.log('doc', doc);
  const metadata = {
    website: "EXPERIENCE LEAGUE",
    currentDoc: {
      host: new URL(url).hostname,
      path: new URL(url).pathname,
    },
    language: doc.documentElement.lang || "en",
    analyticsPageName: getAnalyticsPageName(doc),
    description: getMeta(doc, "description"),
    gitEdit: getMeta(doc, "git-edit"),
    gitRepo: getMeta(doc, "git-repo"),
    gitFilename: getMeta(doc, "git-filename"),
    lastUpdated: getMeta(doc, "last-update"),
    buildDate: getMeta(doc, "build-date"),
    publishUrl: getMeta(doc, "publish-url"),
    videos: getMpcVideos(doc),

    cloud: getMeta(doc, "cloud"),
    description: getMetas(doc, "description"),
    features: getMetas(doc, "feature"),
    hideFromSearch: getMeta(doc, "hide") === "true",
    hideFromToc: getMeta(doc, "hidefromtoc") === "true",
    kt: getMetas(doc, "kt"),
    jira: getMetas(doc, "jira"),
    level: getMeta(doc, "level"),
    duration: getMeta(doc, "duration"), // in seconds
    products: getMetas(doc, "product"),
    role: getMetas(doc, "role"),
    articleId: getMeta(doc, "id"),
    lastSubstantialUpdate: getMeta(doc, "last-substantial-update"),
    exlId: getMeta(doc, "exl-id"),
    solutions: getMetas(doc, "solution"),
    subproducts: getMetas(doc, "sub-product"),
    docType: getMeta(doc, "doc-type"),
    thumbnail: getMeta(doc, "thumbnail"),
    title: getElementText(doc, "title"),
    topics: getMetas(doc, "topic"),
    type: getMeta(doc, "type"),
    versions: getMetas(doc, "version"),
    recommendations: getMetas(doc, "recommendations"),
  };

  return metadata;
}

function getMeta(doc, name, defaultValue) {
  console.log(doc, name, defaultValue);
  let el = doc.querySelector("meta[name='" + name + "']");

  if (el) {
    let content = el.getAttribute("content");
    if (content) {
      return content;
    }
  }

  return defaultValue ? defaultValue : null;
}

function getMetas(doc, name, defaultValues) {
  let value = getMeta(doc, name);
  if (value) {
    let values = value.split(",");
    return values.map((val) => val.trim());
  } else {
    return defaultValues ? defaultValues : null;
  }
}

function getMpcVideos(doc) {
  let videoElements =
    [...doc.querySelectorAll("a[href^='https://video.tv.adobe.com/v/']")] || [];

  return videoElements.map((videoElement) => videoElement.getAttribute("href")) || [];
}

function getElementText(doc, name, defaultValue) {
  let el = doc.querySelector(name);

  if (el) {
    let content = el.innerText;
    if (content) {
      return content;
    }
  }

  return defaultValue ? defaultValue : null;
}



function getAnalyticsPageName(doc) {
  // https://git.corp.adobe.com/GP/website/blob/master/src/js/common/analytics.js

  /*
  const type = doc.querySelector('meta[name="type"]') !== null ? doc.querySelector('meta[name="type"]').content.split(',')[0].trim().toLowerCase() : '';
  let solution = doc.querySelector('meta[name="solution"]') !== null ? doc.querySelector('meta[name="solution"]').content.split(',')[0].trim().toLowerCase() : `fb ${(((/^\/docs\/([^\/]+)\//).exec(location.pathname) || [])[1] || '').replace(/[-\d+\s+]/g, ' ').replace(/\s+/g, ' ').trim()}`;
  let subsolution = doc.querySelector('meta[name="sub-solution"]') !== null ? doc.querySelector('meta[name="sub-solution"]').content.split(',')[0].trim().toLowerCase() : '';
  let solutionversion = doc.querySelector('meta[name="version"]') !== null ? doc.querySelector('meta[name="version"]').content : '';
  */

  const type =
  doc.head.querySelector('meta[name="type"]') !== null
      ? doc.head
          .querySelector('meta[name="type"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : "";
  let solution =
  doc.head.querySelector('meta[name="solution"]') !== null
      ? doc.head
          .querySelector('meta[name="solution"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : `fb ${((/^\/docs\/([^\/]+)\//.exec(location.pathname) || [])[1] || "")
          .replace(/[-\d+\s+]/g, " ")
          .replace(/\s+/g, " ")
          .trim()}`;
  let subsolution =
    doc.head.querySelector('meta[name="sub-solution"]') !== null
      ? doc.head
          .querySelector('meta[name="sub-solution"]')
          .content.split(",")[0]
          .trim()
          .toLowerCase()
      : "";
  //let solutionversion = doc.querySelector('meta[name="version"]') !== null ? doc.querySelector('meta[name="version"]').content : '';

  const title =
    doc.head.querySelector('meta[name="english-title"]')?.content ||
    doc.head.querySelector("title").innerText.split("|")[0].trim();

  // Should look like: xl:docs:experience manager:tutorial:osgi services development basics"
  const pageName = `xl:docs:${solution}:${type}:${
    subsolution ? subsolution + ":" : ""
  }${title}`.toLowerCase();

  return pageName;
}