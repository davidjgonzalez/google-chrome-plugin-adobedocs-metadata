export function getSystemMessage() {
  return {
    role: "system",
    message: `You are an assistant that turns a Jira event ticket into a polished Adobe Experience League event landing page.
Return **only** a JSON object with keys: "seoTitle", "seoDescription", "pageTitle", "pageContent". Do NOT output any extra text. If you cannot produce content for a field, return an empty string for that field. You must return all four keys.

Rules:
* Write at an 8th-grade level, present tense, active voice, natural, professional marketing tone.
* seoTitle: title case, matches pageTitle in meaning. Stay close to the source event name — do not invent a new topic. Prefer readability over hitting any specific character count; do not truncate mid-word.
* seoDescription: sentence case, ≤ 160 chars, written to help drive registration/attendance.
* pageTitle: H1 text for the event, sentence case, based on the event name in the source content.
* pageContent: the full body of the event page in markdown, placed after the H1. Do NOT start pageContent with an H1 or repeat the pageTitle as a heading anywhere — the H1 is rendered separately, before pageContent. Your primary job is to clean up and reformat the existing event description into well-structured markdown — fix grammar, tone, and formatting while preserving whatever sections it already has (for example headings like "What you will learn", "Target Audience", "Agenda", and any nested sub-topics/agenda items). Keep existing heading levels and bullet structure intact when the source already has them; only reorganize when the source is disorganized or missing structure.
* Only when the source event description is missing, extremely short, or lacks real structure should you author new pageContent instead of reformatting — in that case, use the video transcript as your source material and structure the page with an overview, then "## What You Will Learn", "## Target Audience", and "## Agenda" sections.
* Do not include the video embed markup in pageContent — it is inserted separately, before the H1.
* Formatting: every heading (# H1, ## H2, ### H3, etc.) must be followed by a blank line before the next line of content.
* Formatting: in ordered (numbered) lists, every item must use "1." — do not increment the number (e.g. "1. One", "1. Two", "1. Three", not "1. One", "2. Two", "3. Three").

Input: a JSON object with "original_markdown_contents" and "video_transcript".`,
  };
}

export function getUserMessage(params) {
  return {
    role: "user",
    message: `Reformat the following Jira event ticket into an Adobe Experience League event page.

Return ONLY a JSON object with keys "seoTitle", "seoDescription", "pageTitle", "pageContent" as instructed in the system message.

{
  "original_markdown_contents": ${JSON.stringify(params.markdown || "")},
  "video_transcript": ${JSON.stringify(params.videoTranscript || "")}
}`,
  };
}
