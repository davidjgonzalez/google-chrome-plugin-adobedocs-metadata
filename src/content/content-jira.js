import fetch from 'node-fetch';

import './content.css';

function getMetadata(jiraJSON) {

  const metadata = {
    website: 'JIRA',
    currentDoc: {
        host: window.location.host,
        path: window.location.pathname
    },
    jira: parseJiraJSON(jiraJSON)
  };

  return metadata;
}

// Listen for messages
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  // If the received message has the expected format...

  if (msg.text === "collect_adobedocs_metadata") {

    getJira(window.location).then(jiraJSON => { 
        
        getJiraRemoteLinks(jiraJSON.key).then(jiraRemoteLinksJSON  => {

            jiraJSON.remoteLinks = jiraRemoteLinksJSON || [];

            sendResponse(getMetadata(jiraJSON));
        });
    });
    return true;
  }
});


function getJira(url) {
    let jiraId = getJiraId(url);
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

function parseJiraJSON(json) {
    return {
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
        components: parseComponents(json)
    }
}

function parseTitle(json) {
    return json.fields.summary;
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