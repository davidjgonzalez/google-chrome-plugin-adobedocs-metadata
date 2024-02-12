import { iso8601DurationToSeconds } from "../utils";
import { createFalloffChart } from "./popup-exl-charts";
import humanizeDuration from "humanize-duration";
import { shortHumanizeDuration } from "./popup-exl";
import { getMpcVideoData, getVideoId } from "../utils";

// Production
//const ANALYTICS_PROXY_URL = 'https://51837-exlanalyticsproxy.adobeioruntime.net/api/v1/web/dx-excshell-1/generic'
// Stage
const ANALYTICS_PROXY_URL =
  "https://51837-exlanalyticsproxy-stage.adobeioruntime.net/api/v1/web/dx-excshell-1/generic";

export async function injectAnalyticsTabHtml(analyticsApiKey, exlData) {
  const analyticsPageName = exlData.analyticsPageName;
  const videos = exlData.videos;
  const videoIds = videos.map((video) => getVideoId(video));

  const analyticsResponse = await fetch(ANALYTICS_PROXY_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json;charset=utf-8",
    },
    body: JSON.stringify({
      pageId: analyticsPageName,
      apiKey: analyticsApiKey,
      videoIds: videoIds.join("|"),
    }),
  });

  let html = "";

  if (analyticsResponse.status >= 500) {
    html = `
        <h2>Sorry!</h2>
        <p>There was an error collecting analytics data. It's unlikely this has anything to do with you though.</p>`;

    document.getElementById("analyticsTabHtml").innerHTML = html;
  } else if (
    analyticsResponse.status >= 400 &&
    analyticsResponse.status < 500
  ) {
    html = `
        <h2>Sorry!</h2>
        <p>You don't have access to analytics!</p>
        <p>Please double check your API key is valid in the extension's options, and try again!</p>`;

    document.getElementById("analyticsTabHtml").innerHTML = html;
  } else if (analyticsResponse.status === 200) {
    const analyticsData = await analyticsResponse.json();

    console.log("Analytics API data:", analyticsData);

    const mpcVideoData = await getMpcVideoData(videos);

    analyticsData.page.push({
        text: "Expected time on page",
        value: humanizeDuration(exlData.duration * 1000, shortHumanizeDuration),
        raw: exlData.duration,
    });

    // Draw analytics tab table
    const rows = analyticsData.page
      .map((pageMetric, index) => {
        let html = "";

        if (index % 2 == 0) {
          html += `<tr class="spectrum-Table-row">`;
        }

        html += `
            <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">${pageMetric.text}</td>
            <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${pageMetric.value}</td>`;

        if (
          index === analyticsData.page.length - 1 &&
          analyticsData.page.length % 2 === 1
        ) {
          html += `
            <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap"></td>
            <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%"></td>`;
        }

        if (index % 2 == 1) {
          html += `</tr>`;
        }

        return html;
      })
      .join("");

    // Process the engagement status
    let engagementStatusHtml = processEngagementStatus(exlData, analyticsData);

    html = `
        <br/>
        ${engagementStatusHtml}

        <h4>Web analytics over the last ${
          analyticsData.scope.duration
        } for the page</h4>

        <table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
          <thead class="spectrum-Table-head">
            <tr>
              ${`<th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                Page metric
              </th>
              <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                Value
              </th>`.repeat(2)}
          </tr>
          </thead>
          <tbody class="spectrum-Table-body">
            ${rows}
          </tbody>
        </table>
                
        <br/>
        <hr/>
        <br/>
        
       ${getChartPlaceholderHtml(videoIds, analyticsData, mpcVideoData)}
        `;

    document.getElementById("analyticsTabHtml").innerHTML = html;

    initCharts(videoIds, mpcVideoData, analyticsData);
  }
}

export function injectNoAnalyticsTabHtml() {
  const html = `
      <p style="margin-top: 2rem;">
        Please provide a valid API key in this extensions options to access web analytics data.
      </p>
      <p>
        If you do not have an API key, or your API key is no longer valid, please contact <a href="mailto:schnoorganization@adobe.com">schnoorganization@adobe.com</a></p>
      </p>
    `;

  document.getElementById("analyticsTabHtml").innerHTML = html;
}

function getChartPlaceholderHtml(videoIds, analyticsData, mpcVideoData) {
  return videoIds
    .map((videoId) => {
      const mpcData = mpcVideoData.find((datum) => datum.videoId == videoId);
      const videoName = mpcData?.jsonLinkedData?.name;

      const videoAnalyticsData = analyticsData.videos[videoId];
      const pageViews =
        analyticsData.page.find((v) => v.id === "pageViews")?.raw || 0;
      const avgTimeSpentWatchingVideo = humanizeDuration(
        videoAnalyticsData.find((v) => v.id === "avgTimeSpent")?.raw * 1000
      );
      const numberOfPlays = videoAnalyticsData.find(
        (v) => v.id === "videoPlays"
      )?.value;

      return `
        <div class="video-analytics-chart">
            ${getVideoDetailsTableHtml(
              videoId,
              analyticsData.page,
              analyticsData.videos[videoId],
              mpcData
            )}

            <div class="chart">
                <canvas id="video-falloff-chart-${videoId}"></canvas>                        
            </div>
        </div>
        `;
    })
    .join("");
}

function initCharts(videoIds, mpcVideoData, analyticsData) {
  videoIds.forEach((videoId) => {
    const mpcVideoDatum = mpcVideoData.find(
      (datum) => datum.videoId == videoId
    );

    const videoLength = iso8601DurationToSeconds(
      mpcVideoDatum?.jsonLinkedData?.duration
    );

    createFalloffChart(
      document
        .getElementById(`video-falloff-chart-${videoId}`)
        .getContext("2d"),
      videoLength,
      analyticsData.videos[videoId]
    );
  });
}

function processEngagementStatus(exlData, analyticsData) {
  let effectiveStatusHtml = "";
  const expectedDuration = exlData.duration;
  const avgDuration = analyticsData.metrics
    .filter((m) => m.text === "Avg time on page")
    .map((m) => m.raw)[0];

  let el = document.getElementById("efficiency-status");

  if (
    expectedDuration &&
    expectedDuration > 0 &&
    avgDuration &&
    avgDuration > 0
  ) {
    const percentDuration = Math.floor((avgDuration / expectedDuration) * 100);

    let variant = "positive";
    let color = "#017a4e";
    if (percentDuration < 70) {
      variant = "negative";
      color = "#d31411";
    } else if (percentDuration < 80) {
      variant = "notice";
      color = "#e57000";
    }

    effectiveStatusHtml = `<sp-badge style="width: 100%; background-color: ${color}" size="M" static="black">          
          Users engage with this page for <strong>${percentDuration}%</strong> of the expected time, 
          spending <strong>${humanizeDuration(
            avgDuration * 1000
          )}</strong> out of the <strong>expected ${humanizeDuration(
      expectedDuration * 1000
    )}</strong> on average, 
          for ${
            avgDuration - expectedDuration <= 0
              ? "under engagement by"
              : "over engagement by"
          } of <strong>${humanizeDuration(
      Math.abs(expectedDuration - avgDuration) * 1000
    )}</strong>.
        </sp-badge>`;

    el.innerHTML = `
          <sp-status-light size="M" variant="${variant}" data-tooltip="testing 123">${percentDuration}% engagement</sp-status-light>
          <div class="efficiency-tooltip-wrapper">
            <span class="spectrum-Tooltip spectrum-Tooltip--bottom is-open">
              <span class="spectrum-Tooltip-label">

                <table class="efficiency-tooltip-table">
                  <tbody>
                    <tr class="avg-duration">
                      <td>Average engagement</td>
                      <td class="value">${humanizeDuration(
                        avgDuration * 1000,
                        shortHumanizeDuration
                      )}</td>
                    </tr>
                    <tr class="expected-duration">
                      <td>Expected engagement</td>
                      <td class="value">${humanizeDuration(
                        expectedDuration * 1000,
                        shortHumanizeDuration
                      )}</td>
                    </tr>
                    <tr class="duration-difference">
                      <td>${
                        avgDuration - expectedDuration <= 0
                          ? "Under engaged by"
                          : "Over engaged by"
                      }</td>
                      <td class="value">${humanizeDuration(
                        Math.abs(avgDuration - expectedDuration) * 1000,
                        shortHumanizeDuration
                      )}</td>                    
                    </tr>
                  </tbody>
                </table>
          
              </span>
              <span class="spectrum-Tooltip-tip"></span>
            </span>
          </div>
        `;
    el.classList.remove("efficiency-loading");
    el.classList.add("efficiency-loaded");
  } else {
    document.getElementById("efficiency-status")?.remove();
  }
  return effectiveStatusHtml;
}

function getVideoDetailsTableHtml(
  videoId,
  pageAnalyticsData,
  videoAnalyticsData,
  mpcVideoData
) {
  const videoName = mpcVideoData.jsonLinkedData.name || "Unknown video name";
  const pageViews =
    pageAnalyticsData.find((v) => v.id === "pageViews")?.raw || 0;
  const avgTimeSpentWatchingVideo =
    videoAnalyticsData.find((v) => v.id === "avgTimeSpent")?.raw || 0;

  const numberOfPlays = videoAnalyticsData.find(
    (v) => v.id === "videoPlays"
  )?.value;

  const videoLength = iso8601DurationToSeconds(
    mpcVideoData?.jsonLinkedData?.duration
  );

  return `
    <h4>Video analytics for ${videoName} ( ID: ${videoId} )</h4>
    <table class="video-analytics-details spectrum-Table spectrum-Table--sizeS" style="width: 100%">
            <thead class="spectrum-Table-head">
                <tr>
                    <th class="spectrum-Table-headCell" aria-sort="none" ></th>
                ${`<th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                    Video metric
                </th>
                <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap; width: 50%;">
                    Value
                </th>`.repeat(2)}
            </tr>
            </thead>
            <tbody class="spectrum-Table-body">
                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" rowspan="5">
                        <br/>
                        <img class="thumbnail" src="https://video.tv.adobe.com/v/${videoId}?format=jpeg" alt="${videoName}" />
                    </td>

                    <!-- Video plays -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Video plays</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${numberOfPlays}</td>

                    <!-- Page views without plays -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Page views w/out plays</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${
                      pageViews - numberOfPlays
                    }</td>
                </tr>

                <tr class="spectrum-Table-row">
                    <!-- Video length -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Video length</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                        ${humanizeDuration(
                          Math.round(videoLength * 1000),
                          shortHumanizeDuration
                        )}</td>
                    
                        <!-- Page vs Plays -->
                        <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: wrap">% page views w/ plays</td>
                        <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${Math.round(
                          (numberOfPlays / pageViews) * 100
                        )}%</td>
                    </tr>

                <tr class="spectrum-Table-row">
                    <!-- Avg play time -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg. play time</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                        ${humanizeDuration(
                          Math.round(avgTimeSpentWatchingVideo * 1000),
                          shortHumanizeDuration
                        )}</td>

                    <!-- Avg. unwatched time -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg. unplayed time</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                    ${humanizeDuration(
                        (videoLength * 1000) - Math.round(avgTimeSpentWatchingVideo * 1000),
                        shortHumanizeDuration
                      )}
                    </td>
                </tr>


                <tr class="spectrum-Table-row">
                <!-- Avg % played -->
                <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg. % played</td>
                <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                    ${Math.round(
                      (avgTimeSpentWatchingVideo / videoLength) * 100
                    )}%</td>

                <!-- Non-video duration -->
                <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg. % unplayed</td>
                <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                ${100 - Math.round(
                    (avgTimeSpentWatchingVideo / videoLength) * 100
                  )}%
                </td>
            </tr>
            </tbody>
            </table>`;
}
