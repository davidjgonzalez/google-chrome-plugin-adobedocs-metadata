function parseJiraTitle(title) {
  // [Asset Essentials] Getting started with Assets Essentials - Feature Video
  let found = title.match(
    /[^\]]+](.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video|Course|Lesson)/i
  );
  if (found && found.length >= 2 && found[1]) {
    return found[1].trim();
  }

  // [Asset Essentials] Getting started with Assets Essentials
  found = title.match(/[^\]]+](.*)/i);
  if (found && found.length >= 2 && found[1]) {
    return found[1].trim();
  }

  // ACC - Configure the integration between ACC and AEM - Feature Video
  found = title.match(
    /[^-]+-(.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video|Course|Lesson)/i
  );
  if (found && found.length >= 2 && found[1]) {
    return found[1].trim();
  }

  // URS - Project & Repository structure
  found = title.match(/[^-]+-(.*)/i);
  if (found && found.length >= 2 && found[1]) {
    return found[1].trim();
  }

  return title;
}

function getVideoId(videoUrl) {
  const videoIdRegex = /https:\/\/video.tv.adobe.com\/v\/(\d+).*/gi;

  let videoId = null;
  let match = videoIdRegex.exec(videoUrl);

  if (match && match.length === 2) {
    videoId = match[1];
  } else {
    console.error("Could not get video id from: " + videoUrl);
  }

  return videoId;
}

function iso8601DurationToSeconds(duration) {
  if (!duration) {
    console.warn("No duration for video provided");
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

async function getMpcVideoData(videos) {
  const data = [];

  for (let i = 0; i < videos.length; i++) {
    const videoUrl = videos[i];
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
      continue;
    }

    const response = await fetch(
      `https://video.tv.adobe.com/v/${videoId}/?format=json-ld`
    );

    if (!response.ok) {
      console.error("Could not get video duration");
    } else {
      data.push(await response.json());
    }
  }

  console.log("Video data:", data);

  return data;
}


function splitArray(arr) {
  // Calculate the split index
  const middleIndex = Math.ceil(arr.length / 2);

  // Use slice to create the two arrays
  const firstHalf = arr.slice(0, middleIndex);
  const secondHalf = arr.slice(middleIndex);

  return [firstHalf, secondHalf];
}

function getRaw(data, key) {
  return data.find((item) => item.id === key)?.raw;
}

function getValue(data, key) {
  return data.find((item) => item.id === key)?.value;
}


export { parseJiraTitle, getVideoId, iso8601DurationToSeconds, getMpcVideoData, splitArray, getRaw, getValue};
