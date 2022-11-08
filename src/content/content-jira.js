import fetch from 'node-fetch';

import './content.css';
import { parseJiraTitle } from '../utils';

async function getMetadata(jiraJSON) {

   console.log("Jira JSON:", jiraJSON);

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
        description: parseDescription(json, '!END DESCRIPTION'),
        kt: parseKT(json),
        role: parseRoles(json),
        level: parseLevels(json),
        versions: parseVersions(json),
        topics: '',
        features: '',
        videoId: parseVideoId(json),
        videoUrl: parsePublishVideoUrl(json),
        publishUrl: parsePublishUrl(json),
        products: parseProducts(json),
        components: parseComponents(json),
        duration: parseDuration(json),
        publishLink: parsePublishLink(json),
        docType: parseDocType(json),
    }
}

async function parseJiraCourseJSON(json) {
    let lessons = await parseLessons(json);

    return {
        jiraId: json.key,
        title: lessons[0].course?.title || 'Missing course title',
        assignee: parseAssignee(json),
        description: lessons[0].course?.description || 'Missing course description',
        kt: parseKT(json),
        role: parseRoles(json),
        level: parseLevels(json),
        products: parseProducts(json),
        components: parseComponents(json),
        duration: parseDuration(json),
        lessons: lessons
    }
}

function parseTitle(json) {
    return parseJiraTitle(json.fields.summary);
}

function parseCourseDefinition(json) {
    return parseDescription(json);
}

function parseDescription(json, delimiter) {
    let description = json.fields.description;

    if (delimiter) {
        let endDescriptionIndex = (description || '').indexOf(delimiter);

        if (endDescriptionIndex >= 0) {
            description = description.substring(0, endDescriptionIndex);
        }
    }

    return description?.trim();
}

function parseAssignee(json) {
    return json.fields.assignee?.displayName || 'None';

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

        if (remoteLink?.object?.url.indexOf('https://publish.tv.adobe.com/') === 0 ||
                    remoteLink?.object?.url.indexOf('https://video.tv.adobe.com/v/') === 0) {
            
            // Use first video link found
            return remoteLink?.object?.url;
        }
    }
}

function parseVideoId(json) {
    let videoUrl = parseVideoUrl(json);

    if (videoUrl) {
        if (videoUrl.match(/https:\/\/publish.tv.adobe.com\/bucket\/\d+\/category\/\d+\/video\/(\d+)(\/?)(.*)/i)) {
            return videoUrl.match(/https:\/\/publish.tv.adobe.com\/bucket\/\d+\/category\/\d+\/video\/(\d+)(\/?)(.*)/i)[1];
        } else if (videoUrl.match(/https:\/\/video.tv.adobe.com\/v\/([\d]+)\/?.*/i)) {
            return videoUrl.match(/https:\/\/video.tv.adobe.com\/v\/([\d]+)\/?.*/i)[1];
        }
    }

    return null;
}

function parsePublishVideoUrl(json) {
    let videoId = parseVideoId(json);

    if (videoId) {
        return `https://video.tv.adobe.com/v/${videoId}/?quality=12&learn=on`
    } else {
        return '';
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

function parseDocType(json) {
    return json?.fields?.customfield_18101?.value;
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
    let stories = [];

    const lines = (parseCourseDefinition(json) || '').split('\r\n')
    let lesson = {};

    let courseTitle = '';
    let courseDescription = '';
    let qualifierId = '';
    let revision = '';
    let series = '';
    let menu = '';
    let communityLink = '';


    for (let i in lines) {
        let line = lines[i].trim();

        if (line === '!END COURSE') {
            return lessons;
        } else if (line?.toLowerCase().startsWith("course title:")) {
            courseTitle = line.substring("course title:".length).trim(); 
        } else if (line?.toLowerCase().startsWith("course description:")) {
            courseDescription = line.substring("course description:".length).trim();                        
        } else if (line?.toLowerCase().startsWith("qualifier id:")) {
            qualifierId = parseInt(line.toLowerCase().substring("qualifier id:".length).trim());      
        } else if (line?.toLowerCase().startsWith("revision:")) {
            revision = line.substring("revision:".length).trim();            
        } else if (line?.toLowerCase().startsWith("series:")) {
            series = line.substring("series:".length).trim();            
        } else if (line?.toLowerCase().startsWith("menu:")) {
            menu = line.substring("menu:".length).trim();            
        } else if (line?.toLowerCase().startsWith("community link:")) {
            communityLink = line.substring("community link:".length).trim();  
            if (communityLink.startsWith('[')) {
                communityLink = communityLink.substring(1);
            }    
            if (communityLink.endsWith(']')) {
                communityLink = communityLink.substring(0, communityLink.length - 1);
            }    
        } else if (!line && stories.length > 0) { // If its blank line, and there are stories    
            lessons.push({
                course: {
                    title: courseTitle,
                    description: courseDescription
                },
                title: lesson.title || "Enter lesson title",
                description: lesson.description || "Enter lesson description",
                stories: stories,
                qualifierId: qualifierId + lessons.length,
                revision: revision,
                series: series,
                communityLink: communityLink,
                menu: menu,
                index: lessons.length
            });
            lesson = {};
            stories = [];
        } else if (line) {
            let match = regex.exec(line);

            if (match && match[0]) {
                let jiraId = match[0];

                let jiraJSON = await getJira(jiraId);

                if (jiraJSON.fields?.issuetype?.name === 'Story') {
                    jiraJSON.remoteLinks = await getJiraRemoteLinks(jiraJSON.key) || [];                        
                    stories.push(await parseJiraStoryJSON(jiraJSON));
                }
            } else {          
      
                if (!lesson.title) {
                    lesson.title = line.trim();
                } else if (!lesson.description) {
                    lesson.description = line.trim();
                }
            }
        }
    }

    return lessons;
}
