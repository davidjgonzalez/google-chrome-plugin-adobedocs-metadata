// Keep in sync w Duration script and popup-exl.js -> getResourcesHTML tab.

import { DURATIONS } from "../../constants";

const AVG_WORDS_PER_MINUTE = DURATIONS.AVG_WORDS_PER_MINUTE;
const AVG_CODE_WORDS_PER_MINUTE = DURATIONS.AVG_CODE_WORDS_PER_MINUTE;
const AVG_IMAGE_TIME_IN_S = DURATIONS.AVG_IMAGE_TIME_IN_S;

import readingTime from "reading-time/lib/reading-time";

// Returns the total duration in seconds
export async function getDurations(html = "", videoIds = []) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  doc
    .querySelectorAll(
      ".back-to-browsing, .breadcrumbs, .video-transcript, .embed, .recommendation-more-help, .toc, .mini-toc, .doc-actions, .target-insertion, .article-metadata-createdby, .article-metadata-topics, .article-metadata"
    )
    .forEach((el) => {
      // Remove content not relevant to time.
      el.remove();
    });

  // Handle fragments
  await Promise.all(Array.from(doc.querySelectorAll("div.fragment a[href^='/']")).map(async (el) => {
    const response = await fetch(`https://experienceleague.adobe.com${el.getAttribute('href')}.plain.html`);
    if (response.ok) {
      el.parentElement.innerHTML = await response.text();
    } else {
      el.remove();
    }
  }));

  const durations = {
    total: 0,
    text: {
      total: 0,
      text: 0,
      images: 0,
      code: 0,
    },
    videos: {
      total: 0,
      each: [],
    },
  };

  for (let i = 0; i < videoIds.length; i++) {
    let mpcJson = (await getVideoDurationInSeconds(videoIds[i])) || 0;

    if (mpcJson?.jsonLinkedData?.duration === "PT0H0M0S") {
      console.warn(
        "BAD DATA: Zero length MPC Video duration for video ID:",
        videoIds[i]
      );
      continue;
    }

    const videoDuration = iso8601DurationToSeconds(
      mpcJson?.jsonLinkedData?.duration || 0
    );

    durations.videos.each.push(videoDuration);
  }

  durations.videos.total = durations.videos.each.reduce((a, b) => a + b, 0);

  // Add the reading time based on word count
  durations.text = estimateReadingTime(doc);

  durations.total = Math.ceil(durations.videos.total + durations.text.total);

  return durations;
}

function estimateReadingTime(doc) {
  // parse Document from html

  let codeHtml = "";
  doc.documentElement.querySelectorAll("main pre > code").forEach((code) => {
    codeHtml += code.outerHTML;
    code.remove();
  });

  // Images
  let imageCount = doc.documentElement.querySelectorAll("main picture").length;  

  // Estimate reading time
  const text = doc.documentElement
    .querySelector("main")
    ?.innerText.replace(/\s{2,}/g, " ");
  const textStats = readingTime(`<p>${text}<p>`, {
    wordsPerMinute: AVG_WORDS_PER_MINUTE,
  });

  textStats.input = text;
  textStats.time = textStats.time;
  console.log("Reading time: text stats", textStats);

  const codeStats = readingTime(codeHtml.replace(/\s{2,}/g, " "), {
    wordsPerMinute: AVG_CODE_WORDS_PER_MINUTE,
  });

  codeStats.input = codeHtml;
  console.log("Reading time: code stats", codeStats);

  // reading-time.time is in milliseconds
  let durations = {
    text: Math.ceil(textStats.time / 1000),
    code: Math.ceil(codeStats.time / 1000),
    images: (imageCount * AVG_IMAGE_TIME_IN_S) || 0,
  };

  durations.total = durations.text + durations.code + durations.images;

  return durations;
}

async function getVideoDurationInSeconds(videoId) {
  const response = await fetch(
    `https://video.tv.adobe.com/v/${videoId}?format=json-ld`
  );

  if (!response.ok) {
    console.warn("Could not get video duration for video ID:", videoId, `https://video.tv.adobe.com/v/${videoId}?format=json-ld`);
    return 0;
  }

  const json = await response.json();
  return json;
}

function iso8601DurationToSeconds(duration) {
  if (!duration) { 
    return 0;   
  }

  const regex = /PT(\d+H)?(\d+M)?(\d+S)?/;
  const matches = duration.match(regex);
  let hours = 0;
  let minutes = 0;
  let seconds = 0;

  if (matches[1]) {
    hours = parseInt(matches[1]);
  }
  if (matches[2]) {
    minutes = parseInt(matches[2]);
  }
  if (matches[3]) {
    seconds = parseInt(matches[3]);
  }

  let result = hours * 3600 + minutes * 60 + seconds;

  return result;
}
