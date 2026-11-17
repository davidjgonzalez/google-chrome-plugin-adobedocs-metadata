// Catalog of content criteria checked by the Improve tab.
//
// kind:   "auto" = deterministic fix in code, "ai" = AI-proposed edit, "flag" = report only (never edited)
// engine: "code" = detected in code, "ai" = detected by the AI, "measure" = needs the live page or network
// batch:  for engine "ai", which AI request handles it ("meta" = metadata/headings/structure/SEO/GEO, "prose" = writing style)
// rule:   instruction given to the AI (engine "ai" only)
// defaultChecked: whether edits for this criterion start selected (flags are never selectable)
//
// Numbers match the criteria list agreed with the content team; gaps are criteria that were dropped.

export const THRESHOLDS = {
  TITLE_MAX: 60,
  DESCRIPTION_MAX: 160,
  STALE_MONTHS: 12,
  MAX_ROLES: 3,
  MAX_STEPS: 8,
  MAX_IMAGES: 100,
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  ZOOM_FACTOR: 2,
  DURATION_TOLERANCE_PCT: 0.25,
  DURATION_TOLERANCE_S: 30,
  MIN_WORDS_NO_VIDEO: 75,
  MAX_WORDS_VIDEO_PAGE: 600,
  MAX_READING_MINUTES_NO_VIDEO: 12,
  MAX_SECTION_WORDS: 300,
  MIN_STEPS_FOR_IMAGES: 6,
  WORDS_PER_ADMONITION: 200,
  MAX_GRADE_LEVEL: 12,
  MAX_AVG_SENTENCE_WORDS: 25,
  MAX_LINKS_TO_CHECK: 60,
};

// doc-type values the AI may suggest. Matches the KT Jira content types, plus Catalog (used on listing pages).
export const DOC_TYPES = [
  "Article",
  "Catalog",
  "Code Sample",
  "Course",
  "Event",
  "Exercise",
  "Feature Video",
  "Intro Video",
  "Lesson",
  "Presentation",
  "Technical Video",
  "Tutorial",
  "Value Video",
];

// v2 role and level tags. Names are the current values from https://experienceleague.adobe.com/api/roles and
// /api/levels; the v2 IDs were taken from published pages (each name always maps to the same ID).
export const ROLES = [
  { name: "Admin", id: "c66ffd68-0f65-42bb-aa23-b4020f12e0bd", about: "owns the technical operation, configuration, permissions, management, and support of the solution" },
  { name: "Developer", id: "ff6a42d2-313e-452e-93a6-792e4fad9ff8", about: "works on implementation, integration, data modeling, data engineering, and QA" },
  { name: "Leader", id: "f8a45b24-4be7-4f1b-909b-60d06b483a20", about: "drives the company's or team's digital strategy" },
  { name: "User", id: "b69b2659-1057-424e-8fc5-ed9e016dc554", about: "uses the product to achieve business objectives" },
];

export const LEVELS = [
  { name: "Beginner", id: "e8ccd51f-da0d-4e3b-939b-e30d5ebb1ea5", about: "introductions and getting started" },
  { name: "Intermediate", id: "b5a62a22-46f7-4f0d-b151-3fc640bef588", about: "assumes basic familiarity with the product" },
  { name: "Experienced", id: "d378ca77-2da1-4f39-ad92-1917fe974a38", about: "advanced, in-depth, or expert topics" },
];

export const CATEGORIES = {
  A: "Title and description",
  B: "Other frontmatter",
  C: "Headings",
  D: "Style and terminology",
  E: "Lists and steps",
  F: "Links",
  G: "Images and video",
  H: "Badges",
  I: "Structure and content",
  J: "Voice and tense",
  K: "Concision",
  L: "Readability",
  M: "Amount of text",
  N: "GEO (AI search)",
  O: "SEO",
  P: "Value framing",
};

const c = (id, cat, kind, engine, source, label, extra = {}) => ({
  id,
  cat,
  kind,
  engine,
  source,
  label,
  defaultChecked: kind !== "flag",
  ...extra,
});

export const CRITERIA = [
  // A. Title and description
  c(1, "A", "flag", "code", "Guide", "Title is missing"),
  c(2, "A", "ai", "ai", "Guide", "Title is over 60 characters", { batch: "meta", rule: "The `title` frontmatter value must be 60 characters or fewer (see title_length in the facts). Only report it when it's over 60; a shorter title is fine. Shorten it to as close to 60 characters as you can without going over, keeping the key terms: count them before answering." }),
  c(3, "A", "ai", "ai", "Guide", "Title isn't in title case", { batch: "meta", rule: "The `title` frontmatter value must use title case." }),
  c(4, "A", "auto", "code", "Guide", "Title includes a pipe or product suffix"),
  c(5, "A", "ai", "ai", "Guide", "Title names the product", { batch: "meta", rule: "The `title` frontmatter value should not include the product name (the site appends it automatically), unless the page is about an integration with another product, in which case name only the other product." }),
  c(6, "A", "ai", "ai", "Guide", "Description is missing", { batch: "meta", rule: "The `description` frontmatter field must exist and have a value. If it is missing or empty, write one from the page content (edit the existing empty line, or flag if there is no description line to edit)." }),
  c(7, "A", "ai", "ai", "Guide", "Description is over 160 characters", { batch: "meta", rule: "The `description` frontmatter value must be 160 characters or fewer (see description_length in the facts). Only report it when it's over 160; a shorter description is fine. Shorten it to as close to 160 characters as you can without going over, keeping the key terms: count them before answering." }),
  c(8, "A", "ai", "ai", "Guide", "Description doesn't follow the \"Learn about/how to\" pattern", { batch: "meta", rule: "The `description` should start with \"Learn about…\" for concept pages or \"Learn how to…\" (or a direct imperative verb) for task pages, name the feature or concept in the first sentence, and use the second sentence as a call to action." }),
  c(9, "A", "auto", "code", "Guide", "\"Experience Cloud\" in title or description"),
  c(10, "A", "ai", "ai", "Guide", "Title, description, H1, and intro don't share key terms", { batch: "meta", rule: "The title, description, and first paragraph should share the page's key search terms. Propose minimal edits to whichever is missing them. Don't edit the H1 for this, and don't add the product name to the H1." }),
  c(11, "A", "ai", "ai", "Guide", "Description is missing former names or synonyms", { batch: "meta", rule: "Where relevant, the description should include previous product names (for example Scene7, SiteCatalyst, demdex) or common synonyms readers search for. Only add terms that are clearly relevant to the page." }),

  // B. Other frontmatter
  c(12, "B", "auto", "code", "Guide", "Deprecated seo-title / seo-description"),
  c(13, "B", "auto", "code", "Guide", "Deprecated feature-set / sub-feature"),
  c(14, "B", "auto", "code", "Guide", "Legacy exl-id", { defaultChecked: false }),
  c(15, "B", "ai", "code", "Guide", "Role or level is missing"),
  c(16, "B", "flag", "code", "Guide", "Too many roles tagged"),
  c(17, "B", "ai", "ai", "Guide", "Doc-type is missing or doesn't fit", {
    // Handled by its own AI request (see runDocType in checks-ai.js), not one of the shared batches.
    batch: "doctype",
    rule: `Pick the doc-type that best describes the page, from exactly this list: ${DOC_TYPES.join(", ")}. Guidance: a page built around one video is a video type (Feature Video = what a feature does and how to use it; Technical Video = developer or admin depth; Intro Video = high-level introduction to a product or area; Value Video = business value and outcomes; Presentation = a recorded talk or slides); step-by-step hands-on instructions are a Tutorial (or Exercise/Lesson when part of a course); explanatory text without a primary video is an Article; a page that mainly provides sample code is a Code Sample; a page that mainly lists or links other content is a Catalog. A page with several videos on one feature (for example in tabs) is still a video type.`,
  }),
  c(18, "B", "auto", "measure", "BP", "Duration doesn't match the page"),
  c(19, "B", "flag", "code", "BP", "Last substantial update is stale"),
  c(20, "B", "auto", "code", "Guide", "last-substantial-update isn't a valid date"),

  // C. Headings
  c(23, "C", "flag", "code", "Guide", "Page doesn't have exactly one H1"),
  c(26, "C", "ai", "ai", "Guide", "Headings aren't in sentence case", { batch: "meta", rule: "All headings (H1 through H6) must use sentence case. Keep product names, feature names, and acronyms capitalized as they officially are." }),
  c(27, "C", "ai", "ai", "Guide", "Task headings use gerunds", { batch: "meta", rule: "Task headings must start with an imperative verb, not a gerund (\"Configure SSO\", not \"Configuring SSO\")." }),
  c(28, "C", "ai", "ai", "Guide", "Headings use -ment / -ion nouns", { batch: "meta", rule: "Headings should not use nominalizations ending in -ment or -ion where a verb works (\"Create a roadmap\", not \"Roadmap creation\")." }),
  c(29, "C", "ai", "ai", "Guide", "Single-word abstract headings", { batch: "meta", rule: "Headings must not be a single abstract word like \"Overview\", \"Introduction\", or \"Details\". Name what the section covers." }),
  c(30, "C", "ai", "ai", "Guide", "Headings are too long", { batch: "meta", rule: "Headings should be about five words or fewer and never over 69 characters." }),
  c(31, "C", "ai", "ai", "Guide", "Heading punctuation", { batch: "meta", rule: "Headings must not contain apostrophes or sentence punctuation. Use a question mark only for a real question. A colon in a \"Step 1: …\" label and punctuation inside product names or code are fine." }),
  c(32, "C", "auto", "code", "Guide", "Badges in headings"),
  c(33, "C", "ai", "ai", "Guide", "Headings name the product", { batch: "meta", rule: "Remove product names from headings unless leaving them out would cause confusion." }),
  c(34, "C", "ai", "ai", "Guide", "Heading isn't followed by body text", { batch: "meta", rule: "Every heading must be followed by at least one sentence of body text, not directly by a note, list, table, image, or link. Propose a short lead-in sentence where one is missing, based only on the section's content." }),
  c(35, "C", "ai", "ai", "Guide", "Page opens with a note or warning", { batch: "meta", rule: "The page must not open with an admonition (>[!NOTE], >[!TIP], >[!IMPORTANT], >[!WARNING], etc.) right after the H1; regular paragraph text comes first. Propose moving or introducing it with a sentence." }),
  c(36, "C", "ai", "ai", "Guide", "H1 doesn't match the title", { batch: "meta", rule: "Report only when the H1 is about a different topic than the `title` frontmatter. A shorter H1 is fine: the H1 doesn't need every word of the title, and never add the product name (the guide already implies it) or other words just to make them match." }),

  // D. Style and terminology
  c(37, "D", "ai", "ai", "Guide", "Sentences over 35 words", { batch: "prose", rule: "Split or tighten sentences longer than about 35 words." }),
  c(38, "D", "ai", "ai", "Guide", "Retired product terms", { batch: "prose", rule: "Replace only these retired terms: \"Marketing Cloud\" → \"CX Enterprise\", \"DTM\"/\"Dynamic Tag Management\" → \"Data Collection\" (tags), \"Launch\" (only when it means the retired Adobe tag-management product) → \"Data Collection\" or \"tags\", \"DPS\", and \"Campaign Classic\" → \"Campaign v8\" or \"Campaign Classic v7\" as appropriate. Every other Adobe product name is current; never rename it. Don't change UI labels or quoted UI strings." }),
  c(39, "D", "auto", "code", "Guide", "\"Experience Cloud\" in body text"),
  c(40, "D", "ai", "ai", "Guide", "Non-inclusive language", { batch: "prose", rule: "Use inclusive terms: whitelist → allowlist, blacklist → denylist, master/slave → primary/replica (or primary/secondary), master branch → main, white hat/black hat → ethical/unethical, salesman → sales representative, chairman → moderator. Leave UI labels unchanged." }),
  c(41, "D", "ai", "ai", "Guide", "Gendered language", { batch: "prose", rule: "Don't use he/she or s/he; use gender-neutral wording and address the reader as \"you\" where possible." }),
  c(42, "D", "ai", "ai", "Guide", "\"the\" before product names", { batch: "prose", rule: "Don't put \"the\" before Adobe product names unless it's part of the official name." }),
  c(43, "D", "ai", "ai", "Guide", "Date format", { batch: "prose", rule: "In body text only, write dates as full month name, day, comma, four-digit year (\"January 5, 2026\"). Don't use numeric-only dates in prose. Never change dates in frontmatter (such as last-substantial-update), code, URLs, or file names; those use machine formats on purpose." }),
  c(44, "D", "ai", "ai", "Guide", "Em dashes", { batch: "prose", rule: "Avoid em dashes (—) in technical prose; rewrite with commas, parentheses, or separate sentences." }),
  c(45, "D", "auto", "code", "Guide", "\"filename\" or \"dropdown list\""),
  c(46, "D", "ai", "ai", "Guide", "UI strings in quotation marks", { batch: "prose", rule: "Don't wrap UI strings in quotation marks; quotation marks are only for quoting people. Use **bold** for UI labels instead." }),
  c(47, "D", "ai", "ai", "Guide", "Missing Oxford comma", { batch: "prose", rule: "Use the Oxford (serial) comma in lists of three or more items." }),
  c(48, "D", "ai", "ai", "Guide", "Product name not spelled out on first mention", { batch: "prose", rule: "Use the full Adobe product name on first mention in body text; later mentions can drop \"Adobe\"." }),

  // E. Lists and steps
  c(49, "E", "auto", "code", "Guide", "Numbered items don't use 1."),
  c(51, "E", "ai", "ai", "Guide", "List without a lead-in", { batch: "prose", rule: "Introduce each list with a complete sentence or a lead-in ending in a colon." }),
  c(52, "E", "auto", "code", "Guide", "List items end with ; or ,"),
  c(53, "E", "ai", "ai", "Guide", "Steps with more than one action", { batch: "prose", rule: "Each numbered step should contain one action. Split steps that combine more than about three clicks or decisions." }),
  c(54, "E", "ai", "ai", "Guide", "Step formatting (verb, capital, period)", { batch: "prose", rule: "Each numbered step should begin with an imperative verb, start with a capital letter, and end with a period (unless the step is only user-typed input)." }),
  c(55, "E", "flag", "code", "Guide", "Procedure has too many steps"),
  c(56, "E", "ai", "ai", "Guide", "Prerequisites inside the steps", { batch: "prose", rule: "Conceptual information and prerequisites must come before the first numbered step, not inside the steps." }),
  c(57, "E", "ai", "ai", "Guide", "Non-standard UI verbs", { batch: "prose", rule: "Use standard UI verbs: Open/Close for applications, Go to for locations, Select for choosing values, Click for primary actions. Avoid naming the control type (\"button\", \"link\") unless needed for clarity." }),
  c(58, "E", "ai", "ai", "Guide", "Steps rely on screenshots", { batch: "prose", rule: "Each step must state its action and goal in text, not rely only on a screenshot." }),

  // F. Links
  c(59, "F", "auto", "measure", "Guide", "Insecure http:// links"),
  c(60, "F", "auto", "measure", "BP", "Redirected links"),
  c(61, "F", "auto", "measure", "Guide", "Legacy domain links"),
  c(62, "F", "flag", "measure", "Guide", "Broken links"),
  c(63, "F", "flag", "code", "Guide", "Links to missing anchors"),
  c(64, "F", "auto", "code", "Guide", "Bare URLs"),
  c(67, "F", "ai", "ai", "BP", "Non-descriptive link text", { batch: "prose", rule: "Link text must not be \"click here\", \"here\", \"this link\", \"read more\", or a raw URL. Rewrite the link text to describe the target; never change the URL." }),
  c(68, "F", "flag", "code", "Guide", "Absolute links within the same guide"),
  c(69, "F", "auto", "code", "Guide", "Cross-guide links don't open in a new tab"),

  // G. Images and video
  c(70, "G", "ai", "ai", "Guide", "Images without alt text", { batch: "prose", rule: "Every image (![alt](path)) must have alt text. Write it from the surrounding text: the UI element named in the step, the nearest heading, or the feature name. Never change the image path." }),
  c(71, "G", "ai", "ai", "BP", "Generic alt text", { batch: "prose", rule: "Alt text must not be a file name or a generic word like \"image\", \"screenshot\", or \"picture\". Rewrite it from the surrounding context; never change the image path." }),
  c(72, "G", "ai", "ai", "Guide", "Alt text doesn't match its context", { batch: "prose", rule: "Alt text should match the UI element being documented, the nearest related heading, or the feature name. Never change the image path." }),
  c(73, "G", "flag", "code", "Guide", "Too many images"),
  c(74, "G", "flag", "measure", "Guide", "Images over 5 MB"),
  c(76, "G", "flag", "code", "Guide", "Video not hosted on MPC"),
  c(77, "G", "auto", "code", "BP", "Non-standard MPC video URL"),
  c(78, "G", "flag", "measure", "BP", "Video missing English captions"),
  c(136, "G", "auto", "measure", "BP", "Screenshot too small to read"),
  c(137, "G", "flag", "measure", "BP", "Image is enlarged and may look blurry"),

  // H. Badges
  c(88, "H", "flag", "code", "Guide", "Too many or time-sensitive badges"),

  // I. Structure and content
  c(90, "I", "ai", "ai", "Guide", "No intro paragraph about the page", { batch: "meta", rule: "Right after the H1, the page must open with a paragraph that says what the page covers. Propose one based only on the page content and transcript if it's missing." }),
  c(92, "I", "flag", "ai", "BP", "Page covers several topics", { batch: "meta", rule: "Flag (don't edit) if the page is very long and covers several loosely related topics that would work better as separate pages." }),
  c(93, "I", "ai", "ai", "Guide", "FAQ format", { batch: "meta", rule: "Only if the page has an FAQ section: questions are short (heading length) and answers start with Yes or No where the question allows it." }),
  c(94, "I", "flag", "ai", "BP", "Outdated product versions", { batch: "meta", rule: "Flag (don't edit) references to product versions or technologies that look outdated (for example AEM 6.4, Flash, Internet Explorer)." }),
  c(95, "I", "flag", "ai", "BP", "Text contradicts the video", { batch: "meta", rule: "If a video transcript is provided, flag (don't edit) statements in the page text that contradict the transcript." }),

  // J. Voice and tense
  c(96, "J", "ai", "ai", "BP", "Passive voice", { batch: "prose", rule: "Rewrite passive-voice sentences in active voice only when the actor is clear (usually \"you\" or the product) and the active version is shorter or clearer. Leave passive voice that describes system behavior or states (\"The package is installed to /apps\", \"Requests are cached\") or where the actor is unknown or unimportant. Keep the meaning and technical terms exactly. Pick at most the 8 clearest cases on the page." }),
  c(97, "J", "ai", "ai", "BP", "Too many gerunds", { batch: "prose", rule: "Rewrite sentences that stack gerunds (\"By configuring and enabling…\") into direct verbs." }),
  c(98, "J", "ai", "ai", "BP", "Future tense", { batch: "prose", rule: "Use present tense: \"The dialog opens\", not \"The dialog will open\"." }),
  c(99, "J", "ai", "ai", "Guide", "Doesn't address the reader as \"you\"", { batch: "prose", rule: "Address the reader as \"you\" rather than \"the user\" or \"we\" when describing what the reader does." }),
  c(100, "J", "ai", "ai", "Guide", "Nominalizations", { batch: "prose", rule: "Replace nominalizations with verbs (\"perform a configuration of\" → \"configure\", \"make a selection\" → \"select\")." }),

  // K. Concision
  c(101, "K", "auto", "code", "BP", "Wordy phrases"),
  c(102, "K", "ai", "ai", "BP", "Filler and hedging words", { batch: "prose", rule: "Remove filler and hedging words: simply, just, easily, obviously, basically, very, really, and \"please\" in instructions." }),
  c(103, "K", "ai", "ai", "BP", "Throat-clearing openers", { batch: "prose", rule: "Remove throat-clearing openers like \"It is important to note that\", \"Note that\", \"There is/There are…\", \"This article will explain…\"." }),
  c(104, "K", "ai", "ai", "BP", "Redundant content", { batch: "prose", rule: "Remove sentences that repeat a point already made on the page." }),
  c(105, "K", "ai", "ai", "BP", "Marketing language", { batch: "prose", rule: "On instructional doc types (Tutorial, Article, Exercise, Lesson, Code Sample, Documentation), remove marketing adjectives like powerful, seamless, robust, best-in-class. This does not apply to Value, Feature, or Intro videos." }),

  // L. Readability
  c(106, "L", "flag", "code", "BP", "Reading level is high"),
  c(107, "L", "flag", "code", "Guide", "Long average sentence length"),
  c(108, "L", "ai", "ai", "BP", "Long paragraphs", { batch: "prose", rule: "Split paragraphs longer than about 4–5 sentences or 100 words, or turn enumerable content into a list." }),
  c(109, "L", "ai", "ai", "BP", "Acronyms not spelled out", { batch: "prose", rule: "Spell out acronyms on first use, followed by the acronym in parentheses, unless the acronym is far better known than its expansion (for example API, URL, HTML)." }),
  c(110, "L", "flag", "ai", "BP", "Inconsistent terminology", { batch: "prose", rule: "Flag (don't edit) places where the same thing is called by two different names on the page." }),
  c(111, "L", "ai", "ai", "BP", "Vague \"This\" or \"It\"", { batch: "prose", rule: "Replace a sentence-initial \"This\" or \"It\" with the specific noun when the referent is unclear." }),
  c(112, "L", "auto", "code", "BP", "Latin abbreviations"),
  c(113, "L", "auto", "code", "BP", "Exclamation marks"),
  c(114, "L", "ai", "ai", "BP", "Double negatives", { batch: "prose", rule: "Rewrite double negatives (\"not uncommon\") as positive statements." }),

  // M. Amount of text
  c(115, "M", "flag", "code", "BP", "Too little text"),
  c(116, "M", "flag", "code", "BP", "Too much text for a video page"),
  c(117, "M", "flag", "code", "BP", "Page is very long"),
  c(118, "M", "flag", "code", "Guide", "Wall of text"),
  c(119, "M", "flag", "code", "Guide", "Steps without screenshots"),
  c(120, "M", "flag", "code", "Guide", "Too many notes and warnings"),

  // N. GEO
  c(121, "N", "ai", "ai", "Guide", "Section doesn't stand on its own", { batch: "meta", rule: "Each H2 section should make sense if extracted alone. Fix references like \"as mentioned above\" or pronouns that point to earlier sections." }),
  c(122, "N", "ai", "ai", "BP", "Section buries the main point", { batch: "meta", rule: "Each section should open with its main point or direct answer, then the detail." }),
  c(123, "N", "ai", "ai", "BP", "Concept isn't defined", { batch: "meta", rule: "Concept pages should plainly state \"X is a…\" near the top. Only use facts from the page or transcript." }),
  c(124, "N", "ai", "ai", "Guide", "Vague headings", { batch: "meta", rule: "Headings should be specific and descriptive (\"Configure SSO for Assets\"), not vague (\"Setup\", \"Details\", \"More\")." }),
  c(125, "N", "ai", "ai", "BP", "Unclear \"it\"", { batch: "prose", rule: "In body text (not headings), use the feature name instead of \"it\" or \"this feature\" when the sentence would be unclear on its own." }),
  c(126, "N", "flag", "ai", "Guide", "Key facts only in images or video", { batch: "meta", rule: "Flag (don't edit) when key facts like limits, defaults, prerequisites, or supported versions seem to be only in images or the video rather than in the text." }),
  c(128, "N", "ai", "ai", "Guide", "Video takeaways missing from the text", { batch: "meta", rule: "On pages with a video and a transcript, the page text should include the main takeaways (for example a short \"What you'll learn\" list). Propose a short summary drawn only from the transcript, not the full transcript." }),
  c(129, "N", "ai", "ai", "BP", "Vague wording", { batch: "prose", rule: "Replace vague wording with specifics found on the page or in the transcript (\"within 15 minutes\" rather than \"quickly\"). If no specific is available, leave it." }),
  c(130, "N", "ai", "ai", "BP", "Comparison should be a table or list", { batch: "meta", rule: "When prose compares several options, settings, or plans, propose a table or list instead." }),
  c(131, "N", "ai", "ai", "Guide", "Common question not clearly answered", { batch: "meta", rule: "If the page answers a frequently asked question, it should be answered in a clearly labeled place. Only flag or edit when it's clearly needed." }),

  // O. SEO
  c(132, "O", "ai", "ai", "Guide", "Key terms missing from H2s", { batch: "meta", rule: "H2 headings should include the page's key search terms where it reads naturally." }),
  c(133, "O", "flag", "code", "Guide", "Non-descriptive image file names"),
  c(134, "O", "flag", "code", "Guide", "No related content linked"),
  c(135, "O", "flag", "code", "Guide", "File name isn't clean"),

  // P. Value framing
  c(141, "P", "ai", "ai", "Guide", "Page doesn't say why it matters", { batch: "meta", rule: "The opening paragraph should say what the page covers and why it matters to the reader: the problem it solves or the outcome it enables. Calibrate to doc type: strongest for Value/Feature/Intro videos, brief and practical for tutorials and how-tos, none needed for troubleshooting or reference. Value must be a concrete outcome, not marketing adjectives. Only state value supported by the page text or transcript; if none is supported, use action \"flag\" instead of inventing a benefit." }),
  c(142, "P", "ai", "ai", "BP", "Task section doesn't say when or why", { batch: "meta", rule: "Each section that contains a numbered procedure should have one sentence before the steps saying when or why you'd do this. Don't repeat the same value statement across sections. Only state value supported by the page text or transcript; if none is supported, use action \"flag\" instead of inventing one." }),
];

export const CRITERIA_BY_ID = Object.fromEntries(CRITERIA.map((cr) => [cr.id, cr]));

export function aiCriteria(batch) {
  return CRITERIA.filter((cr) => cr.engine === "ai" && cr.batch === batch);
}
