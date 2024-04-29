
import { DURATIONS } from "../constants.js";

function getResourcesTabHtml() {
    return `
        <br/><br/>
        <p class="spectrum-Heading spectrum-Heading--sizeXS spectrum-Heading--light">General</p>

        <ul>
            <li><a href="https://adobe.ly/ExLquickstart" target="1-0">Experience League quick starts</a></li>
            <li><a href="https://experienceleague.adobe.com/docs/authoring-guide-exl/using/home.html" target="1-1">Authoring Guide for Adobe Writers docs</a></li>
            <li><a href="https://experienceleague.adobe.com/docs/authoring-guide-exl/using/authoring/features/metadata.html" target="1-2">Metadata and tagging docs</a></li>
        </ul>

        <hr/>

        <p class="spectrum-Heading spectrum-Heading--sizeXXS spectrum-Heading--light">Allowed metadata values <em>(Adobe Corp Git)</em></p>

        <ul>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/product.yml" target="2-2">Product</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/cloud.yml" target="2-3">Cloud</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/solution.yml" target="2-4">Solution</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/version.yml" target="2-5">Version</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/type.yml" target="2-6">Type</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/topic.yml" target="2-7">Topic</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/feature.yml" target="2-8">Feature</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/role.yml" target="2-9">Role</a></li>
            <li><a href="https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/level.yml" target="2-10">Level</a></li>                
        </ul>

        <hr/>
    
        <p class="spectrum-Heading spectrum-Heading--sizeS spectrum-Heading--light">About this extension</em></p>

        <p>
            This Chrome extension is intended to help Adobe Experience League authors to understand and manage content.
        </p>

        <sp-button size="s" href="https://chrome.google.com/webstore/detail/adobedocs-metadata/likkkalbnnlnmneamhdhofdglodgmgjc" target="_blank">Download the extension</sp-button>

        <p>
            This extension supports exposing metadata about the active Experience League content page on:
            <ul>
                <li>https://experienceleague.adobe.com/</li>
                <li>https://experienceleague.corp.adobe.com/</li>
            </ul>
            
            Expected durations on Experience League pages are computed by:

            <ul>
                <li>Text is estimated at ${DURATIONS.AVG_WORDS_PER_MINUTE} words per minute.</li>
                <li>Text expected time estimates each image on page takes ${DURATIONS.AVG_IMAGE_TIME_IN_S} seconds to look at.</li>
                <li>Text expected time does not include transcript or article metadata.</li>
                <li>Code blocks are estimated at ${DURATIONS.AVG_CODE_WORDS_PER_MINUTE} words per minute.</li>
                <li>Video duration us determined by length of video(s) on page.</li>
            </ul>
        </p>
        
        <p>
            This extension supports generating Markdown from KT Jira issues from:
            <ul>
                <li>https://jira.corp.adobe.com/docs</li>
            </ul>
        </p>

        <p>
            Jira descriptions are parsed from the top of the description down to the first instance of the string <pre>!END DESCRIPTION</pre>.
        </p>
        `;
}


export { getResourcesTabHtml }
