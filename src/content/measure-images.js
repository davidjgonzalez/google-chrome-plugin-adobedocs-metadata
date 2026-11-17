// Reports how article images are rendered on the Experience League page, so the Improve tab can tell
// when a screenshot is shrunk too far to read. The width/height attributes on EDS images are the
// original image dimensions; clientWidth is what the reader actually sees.

function measureImages() {
  const main = document.querySelector("main") || document.body;
  const images = [...main.querySelectorAll("img")]
    .filter((img) => !img.closest("header, footer, nav, .header, .footer, .toc, .mini-toc, .recommendation-more-help"))
    .map((img) => ({
      alt: img.getAttribute("alt") || "",
      naturalWidth: Number(img.getAttribute("width")) || img.naturalWidth || 0,
      clientWidth: img.clientWidth || 0,
      inLink: !!img.closest("a"),
      src: img.currentSrc || img.src,
    }))
    .filter((img) => img.naturalWidth >= 50);

  return { images };
}

export function initMeasureImages() {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.text === "measure_images") {
      sendResponse(measureImages());
    }
  });
}
