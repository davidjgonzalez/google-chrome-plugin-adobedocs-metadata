import { getResourcesTabHtml } from "./popup-common";
import { parseJiraTitle } from "../utils";

export default function jiraStoryPopup(response, callback) {

    let markdown = getMarkdown(response.jira);

    let html = `
        <sp-tabs selected="1">
            <sp-tab data-tabs="1" label="Markdown" value="1"></sp-tab>
            <sp-tab data-tabs="2" label="Resources" value="2"></sp-tab>
        </sp-tabs>

        <div data-tab="1" class="tab-content">
            <br/>
            <br/>
            
            <sp-button data-copy-to-clipboard="popup-jira-story__markdown">
                Copy Markdown to clipboard
            </sp-button>  

            <br/>
            <br/>

            <textarea id="popup-jira-story__markdown" class="markdown" readonly>${markdown}</textarea>
        </div>

        <div data-tab="2" class="tab-content">
            ${getResourcesTabHtml()}
        </div>
    `;

    callback(html);
}

function getMarkdown(jira) {

    if (!jira) { return 'Could not collect information from Jira to generate the Markdown :(' };

    let title = parseJiraTitle(jira.title) || 'Missing title';

    if (title.length > 59) {
        title = title.substring(0, 59) + '&mldr; (Titles should be no more than 60 characters)';
    }

    let description = jira.description || 'Missing description'
    description = description.replace(/(\r\n|\n|\r|\*|)/gm,"").trim();

    if (description.length < 60) {
        description = description + ' (Between 60 and 160 characters)'
    } else if (description.length > 159) {
        description = description.substring(0, 159) + '&mldr; (Descriptions should be between 60 and 160 characters)'
    }

    let versions =  null;

    if (jira.products) { 
        if  (jira.products?.includes('Experience Manager')) {
            versions = versions || [];

            versions.push(...jira.versions?.map(version => { 
                if (version === 'AEM CS') {
                    return 'Cloud Service';
                } else if (version == '6.5') {
                    return '6.5';
                } else if (version === '6.4') {
                    return '6.4';
                }
            }));
        } 

        if (jira.products?.includes('Campaign')) {
            versions = versions || [];

            versions.push(...jira.components?.map(component => { 
                if (component === 'AV V8') {
                    return 'v8';
                } else if (component == 'ACC') {
                    return 'Classic v7';
                } else if (component === 'ACS') {
                    return 'Standard';
                }
            }));
        }
    }

    let levels =  [];
    if (jira.level) { 
        levels.push(...jira.level?.map(level => { 
            if (level === 'Advanced') {
                return 'Experienced';
            } else {
                return level;
            }
        }));
    }

    let roles =  [];
    if (jira.role) {
        roles.push(...jira.role?.map(role => { 
            if (role === 'Business Practitioner') {
                return 'User';
            } else if (role === 'Administrator') {
                return 'Admin';
            } else if (role === 'Executive') {
                return 'Leader';            
            } else {
                return role;
            }
        }));
    }

    let md = `---
title: ${title}
description: ${description}${

    versions != null ? '\nversion: ' + (versions.length === 0 ? '???' : versions.join(', ')) : ''

}
feature: ???
topic: ???
role: ${roles.length > 0 ? roles?.join(', ') : '??? - select one or more: Leader, Architect, Developer, Data Architect, Data Engineer, Admin, User'}
level: ${levels.length > 0 ? levels?.join(', ') : '??? - select one or more: Beginner, Intermediate, Advanced'}
kt: ${jira.kt}
thumbnail: ${jira.videoId ? jira.videoId : 'KT-' + jira.kt}.jpeg
---

# ${title || 'Missing title'}

${jira.description || 'Missing description'}

${jira.videoId ? '>[!VIDEO](https://video.tv.adobe.com/v/' + jira.videoId + '/?quality=12&learn=on)\n' : ''}`;

    return md;
}


