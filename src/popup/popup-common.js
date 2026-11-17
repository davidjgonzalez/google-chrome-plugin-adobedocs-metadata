
import { DURATIONS } from "../constants";

function getResourcesTabHtml() {
    return `
        <br/><br/>
        <p class="spectrum-Heading spectrum-Heading--sizeXS spectrum-Heading--light">General</p>

        <ul>
            <li><a href="https://adobe.ly/ExLquickstart" target="1-0">Experience League quick starts</a></li>
            <li><a href="https://adobe.ly/ExLauthoringguide" target="1-1">Authoring Guide for Adobe Writers docs</a>
                <ul>
                    <li><a href="https://experienceleague.adobe.com/en/docs/authoring-guide/using/markdown/markdown-syntax" target="1-1-1">Markdown syntax</a></li>
                    <li><a href="https://experienceleague.adobe.com/en/docs/authoring-guide/using/authoring/using-metadata" target="1-1-2">Metadata and tagging docs</a></li>
                </ul>
            </li>
            <li><a href="https://wiki.corp.adobe.com/display/DMSArchitecture/MPC+Video+vPops" target="1-2">Video vPop standards</a></li>
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
