"use strict";

chrome.runtime.onInstalled.addListener(function () {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, function () {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostSuffix: "adobe.com", pathPrefix: "/" }
          }),
        ],
        actions: [new chrome.declarativeContent.ShowPageAction()],
      },
    ]);
  });
});


chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "getBetaCodes") {
      chrome.storage.local.get(["gcp-adobedocs-metadata__options__beta"], function(result) {
          if (chrome.runtime.lastError) {
              sendResponse({error: chrome.runtime.lastError.message});
              return;
          }

          const codes = result["gcp-adobedocs-metadata__options__beta"].split(",").map((code) => code.trim()) || [];
          sendResponse({
            id: "beta",
            value: codes
          });
      });
      return true; // indicates that the response will be sent asynchronously
  }
});

console.log("Background script loaded");
