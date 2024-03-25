import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import annotationPlugin from "chartjs-plugin-annotation";
import { getRaw } from "../../utils";

Chart.register(annotationPlugin);

export function createFalloffChart(ctx, analyticsData) {
  const totalVideoPlays = getRaw(analyticsData, "videoPlays") || 0;
  const avgTimeSpent = getRaw(analyticsData, "avgTimeSpent") || 0;
  const videoLength = getRaw(analyticsData, "videoDuration") || 0;

  const data = [
    {
      x: 0,
      y: totalVideoPlays,
    },
    {
      x: Math.round(0.25 * videoLength),
      y: Math.round(get(analyticsData, "playback25") * totalVideoPlays),
    },
    {
      x: Math.round(0.5 * videoLength),
      y: Math.round(get(analyticsData, "playback50") * totalVideoPlays),
    },
    {
      x: Math.round(0.75 * videoLength),
      y: Math.round(get(analyticsData, "playback75") * totalVideoPlays),
    },
    {
      x: Math.round(1 * videoLength),
      y: Math.round(get(analyticsData, "playback100") * totalVideoPlays),
    },
  ];

  new Chart(ctx, {
    type: "line",
    data: {
      datasets: [
        {
          label: "Video plays",
          cubicInterpolationMode: "monotone",
          data: data,
          fill: true,
          borderColor: "#1474e6",
          tension: 0.4,
        },
      ],
    },

    options: {  
      elements: {
        point: {
            radius: 6,
            borderWidth: 2,
            hoverRadius: 8,
            hoverBorderWidth: 2,
            hitRadius: 10,
            backgroundColor: "#1474e6",
        }
      },
      scales: {
        x: {
          // Configure your x-axis as needed, e.g., type might be 'linear', 'time', etc.
          type: "linear",
          position: "bottom",
          title: {
            display: true,
            text: "Time spent watching video"
          },
          min: 0,
          max: videoLength,
          ticks: {
            stepSize: videoLength / 4,
            callback: function (value, index, ticks) {
              // Convert the value (in seconds) to a human-readable format if necessary
              // This is a basic conversion assuming value is in seconds
              if (index < data.length) {
                //return data[index].x;
                return formatDuration(data[index].x);
              } else if (index === data.length) {
                //return videoLength;
                return formatDuration(videoLength);
              } else {
                return null;
              }
            },
          },
        },
        y: {
          type: "linear",
          title: {
            display: true,
            text: "Video plays"
          },
          min: 0,
          max: totalVideoPlays + (totalVideoPlays / 5),
          ticks: {
            stepSize: totalVideoPlays / 5,
            callback: function (value, index, ticks) {
                return Math.round(value);
            },
          },
        },
      },
      plugins: {  
        legend: {
            display: false
        },
        tooltip: {
            padding: 20,
            callbacks: {
                title: function(context) {
                    return `${Math.round((context[0].raw.y / totalVideoPlays) * 100)}% of plays made it to ${formatDuration(context[0].label)}`;
                }
            }
        },
        annotation: {
          annotations: {
            line1: {
              type: "line",
              value: avgTimeSpent,
              scaleID: "x",
              borderColor: "#27c6c1",
              borderWidth: 3,
              label: {
                content: `Avg. time ( ${formatDuration(avgTimeSpent)} )`,
                enabled: true,
                position: "start",
                display: true
              },
            },
          },
        },
      },
    },
  });
}

function get(data, key) {
  return data.find((item) => item.id === key)?.raw;
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  // Format the duration as mm:ss if there are no hours.
  if (hours === 0) {
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    // Format the duration as hh:mm:ss if there is at least one hour.
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
}


export function initCharts(document, videoIds, analyticsData) {
    videoIds.forEach((videoId) => {
  
      createFalloffChart(
        document
          .getElementById(`video-falloff-chart-${videoId}`)
          .getContext("2d"),
        analyticsData.videos[videoId]
      );
    });
  }