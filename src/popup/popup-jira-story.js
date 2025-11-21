import { getResourcesTabHtml } from "./popup-common";
import { getVideoTranscript } from "./utils";
import { delegateEvent } from "../utils";
import moment from "moment";
import { OPTIONS } from "../constants";
import TurndownService from "turndown";
import { genAi } from "../genai/firefall";
import {
  getSystemMessage,
  getUserMessage,
} from "../genai/prompts/jira/markdown/index";
import matter from "simple-front-matter";


const turndownService = new TurndownService();

export default async function jiraStoryPopup(response, callback) {
  chrome.storage.local.get(
    [OPTIONS.CONTENT_API_KEY],
    async function (optionsObj) {
      const contentApiKey = optionsObj[OPTIONS.CONTENT_API_KEY];

      response.jira.descriptionMd = turndownService.turndown(
        response.jira.descriptionHtml
      );

      let markdown = getMarkdown(response.jira);
      let videoTranscript = response.jira.videoId
        ? await getVideoTranscript(response.jira.videoId)
        : "";

      genAi(
        getSystemMessage(),
        getUserMessage({ markdown, videoTranscript }),
        contentApiKey
      ).then(genAiResponse => {


        if (genAiResponse.seoTitle && genAiResponse.seoDescription && genAiResponse.pageTitle && genAiResponse.pageContent) {
          // parse string into frontmatter and markdown content using library that can handle frontmatter and markdown content.
          const parsed = matter(markdown);

          if (genAiResponse.seoTitle.includes("|")) {
            genAiResponse.seoTitle = genAiResponse.seoTitle.split("|")[0].trim();
          }

          parsed.attributes.title = genAiResponse.seoTitle;
          parsed.attributes.description = genAiResponse.seoDescription;
          parsed.body = `# ${genAiResponse.pageTitle}

${genAiResponse.pageContent}

${getVideoMarkdown(response.jira)}

`;

          markdown = stringifyFrontmatter(parsed.attributes, parsed.body);
          document.querySelector('sp-button[data-copy-to-clipboard="#popup-jira-story__genai-markdown"]').disabled = false;

        } else {
            if (!contentApiKey) {
              markdown = `ERROR: Content API key missing from the Chrome extension's options.
              
If you believe need a Content API Key, please contact ORG-SSCHNOOR-ALL@adobe.com`;
            } else {
              markdown = genAiResponse;
            }
        }

        document.getElementById('popup-jira-story__genai-markdown').value = markdown;
      });


      let html = `
            <sp-tabs selected="1">
                <sp-tab data-tabs="1" data-tab-set="main-tabs" label="Markdown" value="1"></sp-tab>
                <sp-tab data-tabs="2" data-tab-set="main-tabs" label="Resources" value="2"></sp-tab>
            </sp-tabs>

            <div data-tab="1" data-tab-set="main-tabs" class="tab-content">
                <br/>
                <br/>

                <sp-button variant="secondary" href="https://81368-exlmpcvideoupload.adobeio-static.net/?load=${new Date().getTime()}#/update/${
        response.jira.jiraId
      }" target="_blank">
                    Add video to Jira
                </sp-button> 

                ${
                  response.jira.publishUrl
                    ? `<sp-button variant="secondary" data-copy-to-clipboard="${response.jira.publishUrl}">
                    Copy publish link
                    </sp-button>`
                    : ""
                }

                ${
                  response.jira.videoId
                    ? `<sp-button variant="secondary" data-copy-to-clipboard="${encodeURIComponent(
                        videoTranscript
                      )}">
                    Copy video transcript
                    </sp-button>`
                    : ""
                }   
                    
                <br/>
                <br/>
                
                    <sp-tabs selected="1-1">
                        <sp-tab data-tabs="1-1" data-tab-set="jira-markdown" label="GenAI Optimized" value="1-1"></sp-tab>
                        <sp-tab data-tabs="1-2" data-tab-set="jira-markdown" label="Original" value="1-2"></sp-tab>
                    </sp-tabs>

                    <br/>

                    <div data-tab="1-1" class="tab-content" data-tab-set="jira-markdown">
                    
                    <sp-button data-copy-to-clipboard="#popup-jira-story__genai-markdown" disabled>
                        Copy GenAI optimized markdown
                    </sp-button>  

                        <br/><br/>

                        <textarea id="popup-jira-story__genai-markdown" class="markdown" readonly>GenAI optimizing the markdown...</textarea>
                    </div>

                    <div data-tab="1-2" class="tab-content" data-tab-set="jira-markdown">
                        ${getWarning(response.jira)}

                        <sp-button data-copy-to-clipboard="#popup-jira-story__markdown">
                            Copy original markdown
                        </sp-button>  

                        <br/><br/>

                        <textarea id="popup-jira-story__markdown" class="markdown" readonly>${markdown}</textarea>
                    </div>
                </div>
                
            <div data-tab="2" data-tab-set="main-tabs" class="tab-content">
                ${getResourcesTabHtml()}
            </div>
        `;

      callback(html);
    }
  );
}

function getWarning(jira) {
  let messages = [];

  let description = jira.description || "";
  description = description.replace(/h\d\. AI ASSISTANT Q\/A.*/im, "").trim();

  if (!jira.title || jira.title?.length > 59) {
    messages.push(
      "Titles should be no more than 60 characters, but is " +
        (jira.title?.length || 0) +
        " characters."
    );
  }
  if (!description || description?.length < 60 || description?.length > 160) {
    messages.push(
      "Descriptions should be between 60 and 160 characters, but is " +
        (description?.length || 0) +
        " characters"
    );
  }
  if (!jira.docType) {
    messages.push(
      "Content Type should be set on Jira issue to popular doc-type metadata."
    );
  }
  if (!jira.videoId) {
    messages.push("Could not detect a linked MPC video on Jira.");
  }

  if (messages.length > 0) {
    return `<div class="spectrum-Toast spectrum-Toast--negative" style="max-inline-size: 100%; width: 100%;">
                    <div class="spectrum-Toast-body" style="padding: 0">
                        <div class="spectrum-Toast-content">
                            <ul>
                            ${messages
                              .map((message) => {
                                return `<li>${message}</li>`;
                              })
                              .join("")}
                            </ul>
                        </div>
                    </div>
                </div><br/><br/>`;
  } else {
    return "";
  }
}

function getMarkdown(jira) {
  var today = new Date();

  if (!jira) {
    return "Could not collect information from Jira to generate the Markdown &#9785;";
  }

  let title = jira.title || "Missing title";

  if (title.length > 59) {
    //title = title + ' (Titles should be no more than 60 characters, but is ' + title.length + ' characters)';
  }

  let description =
    jira.descriptionMd || jira.description || "Missing description";
  //description = description.replace(/(\r\n|\n|\r|\*|)/gm,'').trim();
  description = description.replace(/h\d\. AI ASSISTANT Q\/A.*/im, "").trim();

  let versions = null;

  if (jira.products) {
    if (jira.products?.includes("Experience Manager")) {
      versions = versions || [];

      versions.push(
        ...jira.versions?.map((version) => {
          if (version === "AEM CS") {
            return "Experience Manager as a Cloud Service";
          } else if (version == "6.5 LTS") {
            return "Experience Manager 6.5 LTS";
          } else if (version == "6.5") {
            return "Experience Manager 6.5";
          } else if (version === "6.4") {
            return "Experience Manager 6.4";
          }
        })
      );
    }

    if (jira.products?.includes("Campaign")) {
      versions = versions || [];

      versions.push(
        ...jira.components?.map((component) => {
          if (component === "AV V8") {
            return "Campaign v8";
          } else if (component == "ACC") {
            return "Campaign Classic v7";
          } else if (component === "ACS") {
            return "Campaign Standard";
          }
        })
      );
    }
  }

  let levels = [];
  if (jira.level) {
    levels.push(
      ...jira.level?.map((level) => {
        if (level === "Advanced") {
          return "Experienced";
        } else {
          return level;
        }
      })
    );
  }

  let roles = [];
  if (jira.role) {
    roles.push(
      ...jira.role?.map((role) => {
        if (role === "Business Practitioner") {
          return "User";
        } else if (role === "Administrator") {
          return "Admin";
        } else if (role === "Executive") {
          return "Leader";
        } else {
          return role;
        }
      })
    );
  }

  let md = `---
title: ${title}
description: ${jira.description?.replace(/(\r\n|\n|\r|\*|)/gm, "").trim()}${
    versions != null
      ? "\nversion: " + (versions.length === 0 ? "???" : versions.join(", "))
      : ""
  }
feature: ??? - select one or more from: https://adobe.ly/3JfnRW9
topic: ??? - select 0 or more from: https://adobe.ly/3NRHfMp
role: ${
    roles.length > 0
      ? roles?.join(", ")
      : "??? - select one or more: Leader, Architect, Developer, Data Architect, Data Engineer, Admin, User"
  }
level: ${
    levels.length > 0
      ? levels?.join(", ")
      : "??? - select one or more: Beginner, Intermediate, Experienced"
  }
doc-type: ${jira.docType}${
    jira.duration != null
      ? `\nduration: ${convertToSeconds(jira.duration)}`
      : ""
  }
last-substantial-update: ${
    today.getUTCFullYear() +
    "-" +
    ("0" + (today.getUTCMonth() + 1)).slice(-2) +
    "-" +
    ("0" + today.getUTCDate()).slice(-2)
  }
jira: ${jira.jiraId}${
    jira.videoId
      ? ""
      : `\nthumbnail: ${jira.videoId ? jira.videoId : jira.jiraId}.jpeg`
  }
---

# ${title || "Missing title"}

${description || "Missing description"}

${
  jira.videoId
    ? ">[!VIDEO](https://video.tv.adobe.com/v/" +
      jira.videoId +
      "/?learn=on&enablevpops)\n"
    : ""
}`;
  return md;
}

function convertToSeconds(time) {
  var timeMoment = moment(time, "HH:mm:ss");
  var hours = timeMoment.hours();
  var minutes = timeMoment.minutes();
  var seconds = timeMoment.seconds();

  return hours * 3600 + minutes * 60 + seconds;
}



function stringifyFrontmatter(attributes, body) {
    const yaml = Object.entries(attributes)
      .map(([key, value]) => `${key}: ${value}`.trim())
      .join("\n");
  
    return `---\n${yaml}\n---\n\n${body.trim()}`;
  }

  function getVideoMarkdown(jira) {
    return jira.videoId
    ? ">[!VIDEO](https://video.tv.adobe.com/v/" +
      jira.videoId +
      "/?learn=on&enablevpops)\n"
    : ""
  }