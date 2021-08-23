

function getResourcesTabHtml() {
    return `
        <p class="spectrum-Heading spectrum-Heading--L spectrum-Heading--light">General</p>

        <ul>
            <li><a href="https://experienceleague.adobe.com/docs/authoring-guide-exl/using/home.html" target="1-1">Authoring Guide for Adobe Writers docs</a></li>
            <li><a href="https://experienceleague.adobe.com/docs/authoring-guide-exl/using/authoring/features/metadata.html" target="1-2">Metadata and tagging docs</a></li>
        </ul>

        <p class="spectrum-Heading spectrum-Heading--L spectrum-Heading--light">Allowed metadata values <em>(Adobe Corp Git)</em></p>

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

        <p class="spectrum-Heading spectrum-Heading--L spectrum-Heading--light">Other helpful tools</em></p>

        <ul>
            <li><a href="http://or1010051255223.corp.adobe.com:4503/content/AemForms/createjirastory.html" target="3-1">Front-matter to Jira Generator <em>(requires Adobe VPN)</em></a></li>                
        </ul>
        `;
}


export { getResourcesTabHtml }
