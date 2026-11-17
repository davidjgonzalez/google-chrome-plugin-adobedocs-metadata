export async function getExlMetadata(url) {

  const response = await fetch(url);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const metadata = {
    website: "EXPERIENCE LEAGUE",
    currentDoc: {
      host: new URL(url).hostname,
      path: new URL(url).pathname,
      url: new URL(url).href,
    },
    language: doc.documentElement.lang || "en",
    analyticsPageName: (await getCoursePageName(url, doc)) || getAnalyticsPageName(doc),
    description: getMeta(doc, "description"),
    gitEdit: getMeta(doc, "git-edit"),
    gitRepo: getMeta(doc, "git-repo"),
    gitFilename: getMeta(doc, "git-filename"),
    lastUpdated: getMeta(doc, "last-update"),
    buildDate: getMeta(doc, "build-date"),
    publishUrl: getMeta(doc, "publish-url"),
    videos: getMpcVideos(doc),
    videoIds: getMpcVideoIds(doc),
    cloud: getMeta(doc, "cloud"),
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
    html: html,
  };

  return metadata;
}

function getMeta(doc, name, defaultValue) {
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

function getMpcVideoIds(doc) {
  let videoUrls = getMpcVideos(doc);

  return videoUrls.map((url) => {
    const regex = /https:\/\/video\.tv\.adobe\.com\/v\/(\d+)[^\)]*/g;

    const match = regex.exec(url);
    if (match) {
      return match[1];
    }
  });
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


/**
 * Course module and step pages carry no type/solution meta and don't contain the
 * course or module names, so the name is built from the parent pages:
 *   module: xl:learn:courses:<solution>:<course>:<module>
 *   step:   xl:learn:courses:<solution>:<course>:<module>:<step>
 * Returns null for any other page, or on any failure, so the caller falls back
 * to getAnalyticsPageName.
 */
async function getCoursePageName(url, doc) {
  try {
    const theme = getMeta(doc, "theme") || "";
    const isStep = /\bcourse-step\b/.test(theme);
    const isModule = /\bcourse-module\b/.test(theme);
    if (!isStep && !isModule) {
      return null;
    }

    const parsedUrl = new URL(url);
    const parts = parsedUrl.pathname.split("/").filter(Boolean); // [lang, courses, course, module, step?]
    if (parts[1] !== "courses" || parts.length !== (isStep ? 5 : 4)) {
      return null;
    }

    const base = `${parsedUrl.origin}/${parts[0]}/courses`;
    const courseUrl = `${base}/${parts[2]}`;
    const moduleUrl = `${courseUrl}/${parts[3]}`;

    const fetchDoc = async (u) => {
      const res = await fetch(u);
      if (!res.ok) {
        throw new Error(`${res.status} fetching ${u}`);
      }
      return new DOMParser().parseFromString(await res.text(), "text/html");
    };
    const getTitle = (d) =>
      d.head.querySelector('meta[name="english-title"]')?.getAttribute("content") ||
      d.head.querySelector("title")?.textContent.split("|")[0].trim() ||
      "";

    const [courseDoc, moduleDoc] = await Promise.all([
      fetchDoc(courseUrl),
      isModule ? doc : fetchDoc(moduleUrl),
    ]);

    const solution = (getMeta(courseDoc, "solution") || "").split(",")[0].trim();
    const courseTitle = getTitle(courseDoc);
    const moduleTitle =
      moduleDoc.querySelector(".module-meta > div:first-child > div")?.textContent.trim() ||
      getTitle(moduleDoc);
    const stepTitle = isStep ? getTitle(doc) : "";

    if (!solution || !courseTitle || !moduleTitle || (isStep && !stepTitle)) {
      return null;
    }

    return `xl:learn:courses:${solution}:${courseTitle}:${moduleTitle}${isStep ? ":" + stepTitle : ""}`.toLowerCase();
  } catch (e) {
    console.log("Could not build course analytics page name, using default", e);
    return null;
  }
}

function getAnalyticsPageName(doc) {

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
    doc.head.querySelector('meta[name="english-title"]')?.getAttribute("content") ||
    doc.head.querySelector("title").innerText.split("|")[0].trim();

  const url = doc.head.querySelector('meta[property="og:url"]')?.getAttribute("content") || "";
  const urlPath = new URL(url).pathname;
  const siteSections = urlPath.split("/");
  const siteSection = siteSections[2] || "";

    // xl:learn:acrobat sign:playlist:get started with acrobat sign for administrators
    // "xl:learn:browse:data collection";
  // Should look like: xl:docs:experience manager:tutorial:osgi services development basics"
  // "xl:learn:experience manager cloud manager:perspective:aem cloud manager onboarding playbook"
  let pageName;
  
  if (type === 'playlist') {
    // Playlust page
    pageName = `xl:learn:${solution}:${type}:${subsolution ? subsolution + ":" : ""}${title}`;

  } else if (type === 'perspective') {
    // Perspectives page
    pageName = `xl:learn:${solution}:${type}:${subsolution ? subsolution + ":" : ""}${title}`;

  } else if (
    siteSection === 'courses' &&
    type === 'course' &&
    siteSections.filter(Boolean).length === 3
  ) {
    // Course landing page (/<lang>/courses/<course>). Module and step pages
    // have no type/solution meta and still use the fallback below.
    // Should look like: xl:learn:courses:experience manager:manage and deliver digital assets using adobe experience manager
    pageName = `xl:learn:courses:${solution}:${title}`;

  } else if (siteSection === 'docs' && siteSections.length > 3) {
    // Docs page
    
    pageName = `xl:docs:${solution}:${type}:${subsolution ? subsolution + ":" : ""}${title}`;
  
  } else if (siteSection === 'browse') {
    // Browse page

    pageName = `xl:learn:browse:${title}`;

  } else {

    pageName = `xl:learn:${title}`;

  }

  pageName = pageName.toLowerCase();

  return pageName;
}