export async function getVideoTranscript(videoId) {
    try {
        let response = await fetch(`https://video.tv.adobe.com/vc/${videoId}/eng.json`);
        let json = await response.json();

        if (!json.captions || !Array.isArray(json.captions)) return "";

        let paragraphs = [];
        let currentParagraph = [];

        for (const caption of json.captions) {
            let content = caption.content.replace(/\s+/g, " ").trim();
            if (content) {
                if (caption.startOfParagraph && currentParagraph.length) {
                    paragraphs.push(currentParagraph.join(" "));
                    currentParagraph = [];
                }
                currentParagraph.push(content);
            }
        }
        if (currentParagraph.length) {
            paragraphs.push(currentParagraph.join(" "));
        }

        return paragraphs.join("\n\n");
    } catch (error) {
        console.error("Error fetching video transcript:", error);
        return "Unable to get video transcript from MPC. This is likely due to the video missing captions.";
    }
}