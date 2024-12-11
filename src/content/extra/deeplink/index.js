let beta = [];


export function decorate() { 

    setTimeout(() => {

         // List of heading tags
    const headingTags = ["H1", "H2", "H3", "H4", "H5", "H6"];

    headingTags.forEach(tag => {
        // Select all headings of this type with an ID
        const headings = document.querySelectorAll(`${tag}[id]`);

        headings.forEach(heading => {
            // Create the link icon
            const linkIcon = document.createElement("span");
            linkIcon.innerHTML = "🔗"; // You can replace this with any icon
            linkIcon.style.cursor = "pointer";
            linkIcon.style.visibility = "hidden"; // Initially hidden
            linkIcon.style.position = "absolute";
            linkIcon.style.left = "-1.24em"; // Position to the left of the heading

            let hideTimeout;

            // Add hover effect to show/hide the icon
            const showIcon = () => {
                clearTimeout(hideTimeout);
                linkIcon.style.visibility = "visible";
            };

            const hideIcon = () => {
                hideTimeout = setTimeout(() => {
                    linkIcon.style.visibility = "hidden";
                }, 300);
            };

            heading.addEventListener("mouseenter", showIcon);
            heading.addEventListener("mouseleave", hideIcon);
            linkIcon.addEventListener("mouseenter", showIcon);
            linkIcon.addEventListener("mouseleave", hideIcon);

            // Copy the deeplink to clipboard when the icon is clicked
            linkIcon.addEventListener("click", (event) => { clickHandler(event, heading) });

            // Make the heading itself clickable
            heading.style.cursor = "pointer";
            heading.addEventListener("click", (event) => { clickHandler(event, heading) });

            heading.style.position = "relative";
            heading.prepend(linkIcon);
        });
    });

    }, 600);
    
};

function clickHandler(event, heading) {
    event.stopPropagation(); // Prevent triggering other click handlers

    const url = `${window.location.origin}${window.location.pathname}#${heading.id}`;
    navigator.clipboard.writeText(url).then(() => {
        console.log("ExL header deeplink copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy link: ", err);
    });
}

export function copyDeepLink() {
    if (beta.some((code) => code === "copy-deeplink")) {            
        decorate();
    }    
}


chrome.runtime.sendMessage({action: "getBetaCodes"}, function(response) {
    if (response.error) {
        console.error(response.error);
    } else {
        beta = response.value;
        copyDeepLink();    }
});
