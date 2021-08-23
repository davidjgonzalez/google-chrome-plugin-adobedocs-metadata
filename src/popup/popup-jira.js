import { getResourcesTabHtml } from "./popup-common";

export default function jiraPopup(response, callback) {

    let markdown = getMarkdown(response.jira);

    let html = `
        <sp-tabs selected="1">
            <sp-tab data-tabs="1" label="Markdown" value="1"></sp-tab>
            <sp-tab data-tabs="2" label="Resources" value="2"></sp-tab>
        </sp-tabs>

        <div data-tab="1" class="tab-content">
            <br/>
            <br/>
            
            <sp-button data-copy-to-clipboard="${markdown}">
                Copy Markdown to clipboard
            </sp-button>  

            <br/>
            <br/>

            <textarea class="markdown" readonly>${markdown}</textarea>
        </div>

        <div data-tab="2" class="tab-content">
            ${getResourcesTabHtml()}
        </div>
    `;

    callback(html);
}

function getMarkdown(jira) {

    if (!jira) { return 'Could not collect information from Jira to generate the Markdown :(' };

    let title = parseTitle(jira.title) || 'Missing title';

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

    console.log(jira);

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

    let md = `---
title: ${title}
description: ${description}${

    versions != null ? '\nversion: ' + (versions.length === 0 ? '???' : versions.join(', ')) : ''

}
feature: ???
topic: ???
role: ${jira.role ? jira.role?.join(', ') : '???'}
level: ${jira.level ? jira.level?.join(', ') : '???'}
kt: ${jira.kt}
thumbnail: ${jira.videoId ? jira.videoId : 'KT-' + jira.kt}.jpeg
---

# ${jira.title || 'Missing title'}

${jira.description || 'Missing description'}

${jira.videoId ? '>[!VIDEO](https://video.tv.adobe.com/v/' + jira.videoId + '/?quality=12&learn=on)\n' : ''}`;

    return md;
}



function parseTitle(title) {

    // [Asset Essentials] Getting started with Assets Essentials - Feature Video
    let found = title.match(/[^\]]+](.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video)/i);
    if (found && found.length >= 2 && found[1]) {
        console.log(found);
        return found[1].trim();
    }

    // [Asset Essentials] Getting started with Assets Essentials
    found = title.match(/[^\]]+](.*)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    // ACC - Configure the integration between ACC and AEM - Feature Video
    found = title.match(/[^-]+-(.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    // URS - Project & Repository structure
    found = title.match(/[^-]+-(.*)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    return title;
}