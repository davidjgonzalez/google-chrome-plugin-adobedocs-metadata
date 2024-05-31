import { initCharts } from "./popup-exl-charts";
import humanizeDuration from "humanize-duration"; // input in milliseconds
import { shortHumanizeDuration } from "./popup-exl";
import { getVideoId, splitArray, getRaw, getValue } from "../../utils";

/* corezsL65FKhZpL5GaAdEDp */

// Production
const ANALYTICS_PROXY_URL = 'https://14257-exlanalytics.adobeioruntime.net/api/v1/web/dx-excshell-1/generic '
// Stage
//const ANALYTICS_PROXY_URL = "https://14257-exlanalytics-stage.adobeioruntime.net/api/v1/web/dx-excshell-1/generic ";

export async function injectAnalyticsTabHtml(analyticsApiKey, analyticsRange, exlData, durations) {
  const analyticsPageName = exlData.analyticsPageName;
  const videos = exlData.videos;
  const videoIds = videos.map((video) => getVideoId(video));

  console.log("Durations", durations);

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
      analyticsRange: analyticsRange
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

    /* Change the value from AppBuilder into a shortHumanized value */
    const avgTimeOnPageIndex = analyticsData.page.findIndex(
      (obj) => obj.id === "avgTimeOnPage"
    );
    analyticsData.page[avgTimeOnPageIndex].value = humanizeDuration(analyticsData.page[avgTimeOnPageIndex].raw * 1000, shortHumanizeDuration);

    console.log("Analytics API data:", analyticsData);

    if (durations?.total) {
      
      analyticsData.page.push({
        text: "Expected time on page",
        value: humanizeDuration(durations.total * 1000, shortHumanizeDuration),
        raw: durations.total,
      });
      /*
      analyticsData.page.push({
        text: "Expected reading time<br/>(text + code)",
        value: humanizeDuration((durations.text.text) * 1000, shortHumanizeDuration),
        raw: durations.text.text,
      });
      */

      analyticsData.page.push({
        text: "Expected text time",
        value: humanizeDuration((durations.text.text) * 1000, shortHumanizeDuration),
        raw: durations.text.text,
      });

      analyticsData.page.push({
        text: "Expected image time",
        value: humanizeDuration((durations.text.images) * 1000, shortHumanizeDuration),
        raw: durations.text.images,
      });

      analyticsData.page.push({
        text: "Expected code time",
        value: humanizeDuration((durations.text.code) * 1000, shortHumanizeDuration),
        raw: durations.text.code,
      });

      analyticsData.page.push({
        text: "Expected video time",
        value: humanizeDuration(durations.videos.total * 1000, shortHumanizeDuration),
        raw: durations.videos.total,
      });
    }

    // Process the engagement status
    let engagementStatusHtml = processEngagementStatus(durations, analyticsData);
    let tablesData = splitArray(analyticsData.page);

    html = `

        ${getAnalyticsMigrationHtml(analyticsRange)}

        <br/>
        ${engagementStatusHtml}

        <h3>Web analytics over the last ${
          analyticsRange
        } days for the page</h3>

        <div class="tables-2">
            ${tablesData
              .map((tableDatum) => {
                return `<table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
                <thead class="spectrum-Table-head">
                    <tr>
                    <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                        Page metric
                    </th>
                    <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                        Value
                    </th>
                </tr>
                </thead>
                <tbody class="spectrum-Table-body">
                    ${tableDatum
                      .map((pageMetric) => {
                        return `<tr class="spectrum-Table-row">
                          <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">${pageMetric.text}</td>
                          <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${pageMetric.value}</td>
                        </tr>`;
                      })
                      .join("")}
                </tbody>
            </table>`;
              })
              .join("")}
        </div>
        
       ${getVideoAnalyticsHtml(videoIds, analyticsData)}
        `;

    document.getElementById("analyticsTabHtml").innerHTML = html;

    initCharts(document, videoIds, analyticsData);
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

function getVideoAnalyticsHtml(videoIds, analyticsData) {
  return videoIds
    .map((videoId) => {
      return `
        <div class="video-analytics-chart">
            ${getVideoDetailsTableHtml(
              videoId,
              analyticsData.page,
              analyticsData.videos[videoId]
            )}

            <div class="chart">
                <canvas id="video-falloff-chart-${videoId}"></canvas>                        
            </div>
        </div>
        `;
    })
    .join("");
}

function processEngagementStatus(durations, analyticsData) {
  let effectiveStatusHtml = "";
  const expectedDuration = durations.total;
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
) {
  const pageViews = getRaw(pageAnalyticsData, "pageViews") || 0;

  const videoName = getValue(videoAnalyticsData, "videoName");
  const videoLength = getRaw(videoAnalyticsData, "videoDuration") || 0;
  const avgTimeSpentWatchingVideo = getRaw(videoAnalyticsData, "avgTimeSpent") || 0;
  const numberOfPlays = getRaw(videoAnalyticsData, "videoPlays") || 0;
  const finishedPlays = Math.round((getRaw(videoAnalyticsData, "playback100") || 0) * numberOfPlays);

  return `
    <h4 class="video-analytics-title">Video analytics for <u>${videoName}</u></h4>

    <div class="tables-3">
        <!-- Thumbnail table -->
        <table spectrum-Table spectrum-Table--sizeS" style="width: 100%">
            <tbody class="spectrum-Table-body">
                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell">
                        <img class="thumbnail" src="https://video.tv.adobe.com/v/${videoId}?format=jpeg" alt="${videoName}" />
                        <div class="thumbnail-id">Id: ${videoId}</div>
                    </td>
                </tr>
            </tbody>
        </table>

        <!-- Table 1 -->
        <table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
                <thead class="spectrum-Table-head">
                    <tr>
                        <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                        Video metric
                    </th>
                    <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap; width: 50%;">
                        Value
                    </th>
                </tr>
            </thead>
            <tbody class="spectrum-Table-body">
                <!--
                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Page views w/ plays</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                        ${numberOfPlays}
                        <span class="slash">/</span>
                        ${100 - Math.round((numberOfPlays / pageViews) * 100)}%
                    </td>
                </tr>

                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Page views w/out plays</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                    ${pageViews - numberOfPlays}
                    <span class="slash">/</span>
                    ${Math.round((numberOfPlays / pageViews) * 100)}%
                    </td>
                </tr>
                -->

                <tr class="spectrum-Table-row">
                    <!-- Avg. played time -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg play time</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                        ${humanizeDuration(
                          Math.round(avgTimeSpentWatchingVideo * 1000),
                          shortHumanizeDuration
                        )}
                        <span class="slash">/</span> 
                        ${Math.round(
                          (avgTimeSpentWatchingVideo / videoLength) * 100
                        )}%
                    </td>                 
                </tr>
                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Avg unplayed time</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                    ${humanizeDuration(
                      videoLength * 1000 -
                        Math.round(avgTimeSpentWatchingVideo * 1000),
                      shortHumanizeDuration
                    )}
                    <span class="slash">/</span> 
                    ${
                      100 -
                      Math.round(
                        (avgTimeSpentWatchingVideo / videoLength) * 100
                      )
                    }%
                    </td>
                </tr>

                <!-- Start vs Finish -->
                <tr class="spectrum-Table-row">
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">% finished</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">                
                    ${Math.round((finishedPlays / numberOfPlays) * 100)}%
                    </td>
                </tr>
            </tbody>
        </table>


        <!-- Table 2 -->
        <table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
            <thead class="spectrum-Table-head">
                <tr>
                    <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap">
                        Video metric
                    </th>
                    <th class="spectrum-Table-headCell" aria-sort="none" style="white-space: nowrap; width: 50%;">
                        Value
                    </th>
                </tr>
            </thead>
            <tbody class="spectrum-Table-body">

                <tr class="spectrum-Table-row">
                    <!-- Video length -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Video length</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">
                        ${humanizeDuration(
                          Math.round(videoLength * 1000),
                          shortHumanizeDuration
                        )}
                    </td>  
                </tr>
                
                <tr class="spectrum-Table-row">
                    <!-- Video starts -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Video starts</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${numberOfPlays}</td>
                </tr>

                <tr class="spectrum-Table-row">
                    <!-- Video finish -->
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="white-space: nowrap">Video finishes</td>
                    <td class="spectrum-Table-cell spectrum-Table-cell--divider" style="width: 50%">${finishedPlays}</td>
                </tr>
            </tbody>
        </table>
    </div>`;
}


function getAnalyticsMigrationHtml(duration = 30) {
    const today = new Date();
    const baseDate = new Date(2024, 5, 1); // May 31, 2024; Date of AA switch-over
    const targetDate = new Date(baseDate);
    targetDate.setDate(baseDate.getDate() + duration);

    let html = '';

    if (today < targetDate) {
      html = `<br/><sp-badge style="width: 100%; background-color: #e57000" size="M" static="black">          
        Web page analytics may be incomplete or skewed due to the reset and migration of Experience League analytics to a new report suite on June 1, 2024.
      </sp-badge><br/>`;
    }

    return html;
}