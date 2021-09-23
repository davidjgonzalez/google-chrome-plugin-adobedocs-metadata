import fetch from 'node-fetch';

import './content.css';
import { parseJiraTitle } from '../utils';

async function getMetadata(jiraJSON) {

  const metadata = {
    website: 'JIRA',
    type: jiraJSON.fields?.issuetype?.name || 'Story',
    currentDoc: {
        host: window.location.host,
        path: window.location.pathname
    }
  };

  if (metadata.type === 'Initiative') {
    metadata.jira = await parseJiraCourseJSON(jiraJSON);
  } else {
    metadata.jira = await parseJiraStoryJSON(jiraJSON);
  }

  return metadata;
}

// Listen for messages
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // If the received message has the expected format...

  if (msg.text === "collect_adobedocs_metadata") {

    let jiraId = getJiraId(window.location);

    getJira(jiraId).then(jiraJSON => {         
        if (jiraJSON.issuetype?.name === 'Initiative') {
            jiraJSON.lessons = parseLessons(jiraJSON);
            getMetadata(jiraJSON).then(metadata => sendResponse(metadata));
        } else {
            getJiraRemoteLinks(jiraJSON.key).then(jiraRemoteLinksJSON  => {
                jiraJSON.remoteLinks = jiraRemoteLinksJSON || [];    
                getMetadata(jiraJSON).then(metadata => sendResponse(metadata));
            });
        }    
    });
    return true;
  }
});

function getJira(jiraId) {
    const JIRA_URL = `/rest/api/latest/issue/${jiraId}`;

    if (jiraId) {
        return fetch(JIRA_URL).then(res => res.json());
    } 
}

function getJiraRemoteLinks(jiraId) {
    const JIRA_URL = `/rest/api/latest/issue/${jiraId}/remotelink`;
    return fetch(JIRA_URL).then(res => res.json());
}

function getJiraId(windowLocation) {
    let found = windowLocation.href.match(/https:\/\/jira.corp.adobe.com\/.*(KT-\d+).*/i);

    if (found.length === 2) {
        return found[1];
    } 
}

async function parseJiraStoryJSON(json) {
    return {
        jiraId: json.key,
        title: parseTitle(json),
        description: parseDescription(json),
        kt: parseKT(json),
        role: parseRoles(json),
        level: parseLevels(json),
        versions: parseVersions(json),
        topics: '',
        features: '',
        videoId: parseVideoId(json),
        publishUrl: parsePublishUrl(json),
        products: parseProducts(json),
        components: parseComponents(json),
        duration: parseDuration(json),
        publishLink: parsePublishLink(json)
    }
}

async function parseJiraCourseJSON(json) {
    return {
        jiraId: json.key,
        title: parseTitle(json),
        description: parseDescription(json),
        kt: parseKT(json),
        duration: parseDuration(json),
        lessons: await parseLessons(json)
    }
}

function parseTitle(json) {
    return parseJiraTitle(json.fields.summary);
}

function parseDescription(json) {
    return json.fields.description;
}

function parseKT(json) {
    return json?.key?.substring('KT-'.length);
}

function parsePublishUrl(json) {
    return json?.fields?.customfield_30500;
}

function parseVideoUrl(json) {
    for (let key in json.remoteLinks) {
        let remoteLink = json.remoteLinks[key];

        if (remoteLink?.object?.url.indexOf('https://publish.tv.adobe.com/') === 0) {
            
            // Use first video link found
            return remoteLink?.object?.url;
        }
    }
}

function parseVideoId(json) {
    let videoUrl = parseVideoUrl(json);

    if (videoUrl) {
        return videoUrl.match(/https:\/\/publish.tv.adobe.com\/bucket\/\d+\/category\/\d+\/video\/(\d+)(\/|\?)(.*)/i)[1];
    }
}

function parseVersions(json) {
    return json?.fields?.fixVersions.map(version => version.name);
}

function parseRoles(json) {
    return json?.fields?.customfield_31900?.map(role => role.value);
}

function parseLevels(json) {
    return json?.fields?.customfield_24403?.map(level => level.value);
}

function parseProducts(json) {
    return json?.fields?.customfield_17100?.map(product => product.value);
}

function parseComponents(json) {
    return json?.fields?.components?.map(component => component.name);
}

function parseDuration(json) {
    return json?.fields?.customfield_32300 || '00:00:00';
}

function parsePublishLink(json) {
    return json?.fields?.customfield_30500 || '';
}

async function parseLessons(json) {
    const regex = /KT-\d+/;
    
    const lessons = [];
    let lesson = [];

    const lines = (parseDescription(json) || '').split('\r\n')
    let lessonTitle;

    for (let i in lines) {
        let line = lines[i];

        if (!line.trim() && lesson.length > 0) {
            if (lessonTitle) {
                lesson.title = lessonTitle;
            }

            lessons.push({
                title: lessonTitle || "Enter lesson title",
                stories: lesson
            });
            lesson = [];
        } else if (line.trim()){
            let match = regex.exec(line);

            if (match && match[0]) {
                let jiraId = match[0];

                let jiraJSON = await getJira(jiraId);

                if (jiraJSON.fields?.issuetype?.name === 'Story') {
                    jiraJSON.remoteLinks = await getJiraRemoteLinks(jiraJSON.key) || [];                        
                    lesson.push(await parseJiraStoryJSON(jiraJSON));
                }
            } else {                
                lessonTitle = line.trim();
            }
        }
    }

    return lessons;
}