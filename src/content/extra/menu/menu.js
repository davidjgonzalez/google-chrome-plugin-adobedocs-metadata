

function _injectScript(file, selector) {
  setTimeout(() => {
    var th = document.querySelector(selector);
    var s = document.createElement("script");
    s.setAttribute("type", "module");
    s.setAttribute("data-adobedocs-plugin-root", chrome.runtime.getURL("/"));
    s.setAttribute("src", file);
    th.appendChild(s);
  }, 0);
}

async function addMenu() {
    //const pluginId = "adobedocs-chrome-extesion-menu";
    
    const PLUGIN_HOST = chrome.runtime.getURL("/");

    const EXTERNAL_HOST =
    "https://dxenablementbeta.blob.core.windows.net/adobedocs-chrome-extension/menu";
  let htmlResponse = await fetch(`${EXTERNAL_HOST}/index.html`);
  let html = await htmlResponse.text();

  document.body
    .querySelector("header")
    .insertAdjacentHTML("afterend", html);

  _injectScript(`${PLUGIN_HOST}extra/menu/index.js`, "body");
}

let hasMutation = false;
let hasExtensionData = false;
let isInitialized = false;
let beta = [];

function tryMenu() {
    if (hasMutation && hasExtensionData && !isInitialized) {
        isInitialized = true;
        if (beta.some((code) => code === "menu")) {            
            addMenu();
        }    
    }
}

// Function to execute when the elements are added
const callback = function (mutationsList, observer) {
  for (const mutation of mutationsList) {
    if (mutation.type === "attributes") {
      // Check if the mutated element matches the desired selector

      if (
        mutation.target.matches(".header.block") &&
        mutation.target.getAttribute("data-block-status") === "loaded"
      ) {
        hasMutation = true;
        tryMenu();

        // Remember to disconnect the observer when you're done observing (to avoid memory leaks)
        observer.disconnect();
      }
    }
  }
};

chrome.runtime.sendMessage({action: "getBetaCodes"}, function(response) {
    if (response.error) {
        console.error(response.error);
    } else {
        beta = response.value;
        hasExtensionData = true;
        tryMenu();    }
});



// Create an instance of MutationObserver with the callback
const observer = new MutationObserver(callback);

// Options for the observer (which mutations to observe)
const config = { attributes: true, subtree: true, attributeOldValue: true };

export function initExtraMenu() {
    if (window.location.hostname.indexOf("experienceleague.") > -1) {
        // Start observing the document body for configured mutations
        observer.observe(document.body, config);
    }
}
