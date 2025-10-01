import { OPTIONS } from "../../constants";
import "@spectrum-web-components/progress-circle/sp-progress-circle.js";
import { delegateEvent } from "../../utils";

const REMOVE_SELECTORS = [
  '.back-to-browsing',
  '.breadcrumbs',
  '.article-metadata',
  '.article-metadata-appliesto',
  '.article-metadata-topics',
  '.article-metadata-createdby',
  '.toc',
  '.doc-actions',
  '.mini-toc',
  '.target-insertion'
]
/* HTML */

async function getToolsTabHtml(exl, extensionOptions) {
  const contentApiKey = extensionOptions[OPTIONS.CONTENT_API_KEY];
  
  if (!contentApiKey) {
    return `
    <h4>Sorry! No tools are enabled.</h4>
    <p>Content API key is not set. Please set a Content API key in the extension options.</p>`;
  }

  delegateEvent('body', 'click', '[data-fn-generate-qa]', (e) => {
    const el = document.getElementById('tools-genai-questions');

    el.innerHTML = '<sp-progress-bar style="width: 100%;" label="Generating questions..." indeterminate size="large"></sp-progress-bar>';

    getGenAiQuestionsHtml(exl, contentApiKey).then(html => {
      el.innerHTML = html;
    });
  });


  delegateEvent('body', 'click', '[data-fn-assess-content]', (e) => {
    const el = document.getElementById('tools-content-assessment');

    el.innerHTML = '<sp-progress-bar style="width: 100%;" label="Assessing content..." indeterminate size="large"></sp-progress-bar>';

    getContentAssessmentHtml(exl, contentApiKey).then(html => {
      console.log("DONE");
      el.innerHTML = html;
    });
  });


  return `
    <h4>AI Assistant training (Q&A)</h4>

    <div id="tools-genai-questions">
      <sp-button data-fn-generate-qa>Generate Q&amp;A</sp-button>
    </div>

    <hr style="margin: 1rem 0;"/>

    <h4>AI content assessment (Alpha)</h4>

    <p><em>Content assessment quality is a work in progress</em></p>

    <div id="tools-content-assessment">
      <sp-button data-fn-assess-content>Assess content</sp-button>
    </div>
  `;
}


async function getPageText(exl, contentApiKey) {
  const doc = await getPageHtml(exl, contentApiKey);
  return doc.querySelector('main')?.innerText?.trim() || '';
}


async function getPageHtml(exl, contentApiKey) {
  const response = await fetch(exl.currentDoc.url);
  const text = await response.text();
  
  // create a DOM form text
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  const main = doc.body.querySelector('main');

  // remove junk elements
  REMOVE_SELECTORS.forEach(selector => {
    main.querySelectorAll(selector).forEach(el => el.remove());
  });


  /* Code */
  main.querySelectorAll('pre code').forEach(el => {
    // Find the el's closest parent <table> and replace that <table> with el
    const table = el.closest('table');
    if (table) {
      table.replaceWith(el);
    }
  });
   
  /* Videos */
  const videoPromises = Array.from(main.querySelectorAll('.embed a[href^="https://video.tv.adobe.com/v"]')).map(async el => {
    const match = el.href.match(/\/v\/(\d+)/);
    const videoId = match ? match[1] : null;
    if (videoId) {
      const videoCaptionResponse = await fetch(`https://video.tv.adobe.com/vc/${videoId}/eng.json`);
      if (videoCaptionResponse.ok) {
        const videoJsonData = await videoCaptionResponse.json();
        const videoCaptions = videoJsonData?.captions?.map(caption => caption.content).join(' ') || '';
        el.parentElement.innerHTML = `
            <video src="${el.getAttribute('href')}"/>
            <section aria-labelledby="video-transcript">${videoCaptions?.replace(/\s+/g, ' ').trim()}</section>`;
      } else {  
        el.remove();
      }
    }
  });
  
  await Promise.all(videoPromises);

  /* Slides */
  const slidesPromises = Array.from(main.querySelectorAll('.fragment a[href^="/en/slides/"]')).map(async el => {
    const slidesResponse = await fetch(`https://experienceleague.adobe.com${el.getAttribute('href')}.plain.html`);
    if (slidesResponse.ok) {
      el.parentElement.innerHTML = await slidesResponse.text();
    } else {  
      el.remove();
    }
  });

  await Promise.all(slidesPromises);

  return doc;

}

async function getGenAiQuestionsHtml(exl, contentApiKey) {
 
  const content = await getPageText(exl, contentApiKey);

  const systemPrompt = `
    You are a helpful assistant that generates insightful metadata, specifically questions and answers, about content to help train other AI models on Adobe products.
    
    * Your task is to analyze the provided content and generate a list of insightful questions along with their corresponding answers.
    * Each question should be clear, concise, and relevant to the content.
    * The answers should be accurate and directly address the questions posed.
    * Avoid generating questions specifically about the documentation itself; instead generate questions that are more general and applicable to the product and its features.
    * Avoid generating questions that are too broad or too specific.
    * Avoid generating questions and answers that are too specific to example, sample, or demo context; instead generate questions and answers that are more general and applicable to the product and its features.
    * Avoid asking about prerequisites or dependencies of the content itself; instead generate questions that are more general and applicable to the product and its features.
    * Ensure the questions and answers scoped to the content provided, and do not include any external information.
    * If the content is insufficient to generate meaningful questions, indicate that no questions can be generated.
    
    Generate as many insightful questions as possible, up to a maximum of 20.
    
    Avoid generating questions that are too broad or too specific;
    Ensure the questions and answers scoped to the content provided, and do not include any external information.
    If the content is insufficient to generate meaningful questions, indicate that no questions can be generated.
    
    Generate as many insightful questions as possible, up to a maximum of 20.

    The output format should be JSON object in the following structure:

    {
      results: [
        { question: "Question 1", answer: "Answer 1" },
        { question: "Question 2", answer: "Answer 2" },
        { question: "Question 3", answer: "Answer 3" },
        { question: "Question 4", answer: "Answer 4" },
        { question: "Question 5", answer: "Answer 5" },            
      ]
    }`;


    const userPrompt = `  
    The content to analyze is below:

    --- 
    
    ${content}
    
    ---

    Ensure the questions are relevant and cover a range of topics within the content.
  `;

  //chrome-extension://amfhglmmhhacmgkbnifpcdnancapklog/
  
  const genAiResponse = await fetch('https://81368-dxpefirefallproxy.adobeio-static.net/api/v1/web/dx-excshell-1/generic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': `${contentApiKey}`
    },
    body: JSON.stringify({
      systemPrompt: systemPrompt.trim(),
      userPrompt: userPrompt.trim(),
    })
  });

  if (!genAiResponse.ok) {
    const json = await genAiResponse.json();
    if (genAiResponse.status === 401) {
      return `<sp-badge style="width: 100%;" size="M" variant="negative">Invalid Content API key</sp-badge>`;      
    } else {
      return `<sp-badge  style="width: 100%;" size="M" variant="negative">Error generating questions: ${genAiResponse.status} -- ${json.error}</sp-badge>`;
    }
  }

  const json = await genAiResponse.json()
  const results = json.results || [];

  return `
    <label>${results.length} questions &amp; answers generated for GenAI training.</label>
    <sp-button style="float: right;" data-copy-to-clipboard="## AI ASSISTANT Q/A\n\n${encodeURIComponent(results.map(r => `Question: ${r.question}\nAnswer: ${r.answer}`).join('\n\n'))}">Copy Q&amp;A to clipboard</sp-button>
    <textarea class="questions">## AI ASSISTANT Q/A

${(results.map(r => `
Question: ${r.question}
Answer: ${r.answer}`).join('\n\n')).trim()}</textarea>`
}



async function getContentAssessmentHtml(exl, contentApiKey) {
 
  const content = (await getPageHtml(exl, contentApiKey)).documentElement.outerHTML;

  const systemPrompt = `You are a content evaluator for Adobe Experience League web pages that provide enablement content for using Adobe's Enterprise products. I will provide the HTML content of a page (or the raw text) and/or a URL.

Your task is to assess the content and provide an overall quality score from 0 to 100, where:

* 100 = perfect enablement content
* 50 = average/adequate but flawed
* 0 = extremely poor

### General Evaluation Instructions:

* Evaluate the content as it actually exists. Only suggest improvements that are directly relevant to this page. Avoid generic advice.
* If the text is very short but clearly communicates its point (e.g., a video page with only a short intro), recognize that brevity can be a strength and do not suggest adding filler text.
* If the content is very long or mixes many semi-related topics, reduce its score significantly (closer to 40 or below) and suggest breaking it into smaller, more focused pages.
* If the HTML contains a video, evaluate the **video transcript text** as the video's content. Assume end users listen to the video but do not read the transcript. Be forgiving of transcription errors.
* Do **not** score the transcript for style, grammar, or readability. Instead, score it for **accuracy and completeness of the content covered in the video.**
* When evaluating structure, pay attention to '<div>' elements under '<main>'. Their class attributes (e.g., "accordion", "tab") indicate how content is visually presented.

### Evaluation Categories:

1. **Clarity & Structure**

   * Is the page well-organized and easy to navigate?
   * Is the information presented in a logical order?
   * Are technical terms explained for the target audience?
   * Note: Transcript clarity should not be scored. Only evaluate transcript for accuracy and completeness.

2. **Ease of Consumption**

   * Is the content concise, avoiding unnecessary jargon?
   * Is the writing “short and sweet,” without fluff?
   * Is it segmented with headings, lists, or visuals where appropriate?
   * Are there too many nested accordions or tabs hiding content?
   * **Length Guidance:**

     * A short video + little text = good, score higher.
     * Long walls of text with no video = bad, score lower.
     * A page that tries to cover too many loosely related topics = bad, score lower. Suggest breaking it into focused pages.
   * Do not evaluate transcript for readability.

3. **Accuracy & Completeness**

   * Is the content technically accurate and up to date?
   * Does it cover all necessary steps/configurations?
   * Only suggest checking links if there's clear evidence they are outdated or broken.

4. **Visual & Interactive Elements**

   * Are images, videos, accordions, or tabs used effectively?
   * Do they enhance understanding instead of distracting?
   * Is the primary medium (video vs. text) being respected?
   * Example: If the page is designed around a short video, don't penalize it for having less text.

---

## Scoring Rubric

Use the following as scoring anchors when deciding the overall score:

* **90-100 (Excellent)**

  * Clear, well-structured, concise, and technically accurate.
  * Good use of visuals, videos, or interactive elements.
  * The right balance of text and media.
  * Focused on a single topic or task.
  * Example: A short page with a video and minimal text that cleanly introduces the topic.

* **75-89 (Good but improvable)**

  * Generally accurate and usable, but could be shorter, clearer, or more focused.
  * May include minor redundancy, jargon, or weak segmentation.
  * Example: A well-written page that drifts into tangential details or has a bit too much text.

* **55-74 (Average / Adequate)**

  * Usable but flawed.
  * May be too long, too dense, or cover too many semi-related topics in one place.
  * Structure may be unclear or over-rely on hidden content (e.g., accordions, tabs).
  * Example: A long text-heavy page that technically covers the topic but overwhelms the reader.

* **30-54 (Poor)**

  * Hard to consume, overly long, or poorly structured.
  * Tangential or unfocused content dominates.
  * Lacks sufficient segmentation or visuals.
  * Example: A page that tries to explain multiple topics at once, with a wall of text and no video.

* **0-29 (Extremely Poor)**

  * Incoherent, outdated, or missing critical steps.
  * Fails to address the intended topic.
  * Content is so confusing or overwhelming that it's unusable.
  * Example: A very long, poorly written page with irrelevant content and no clear purpose.


---

## Category Output

For each category, provide:

* Category score (0-100)
* Actionable suggestions for improvement. Provide specific examples of what can be corrected or improved for each suggestion. Do not make generic suggestions, instead explicitly cite where and what is wrong with the content and how to fix it. Remember transcript text will NOT be seen by end users. It is only provided so you can evaluate the contents of the video. Do not make recommendations on how the transcript is presented.

---

## Output Format

Format your response exactly as JSON like this:


  {
    "overall_score": 0,
    "categories": [
      {
        "name": "Category 1",
        "score": 0,
        "suggestions": []
      },
      ...
    ]
  }


Provide detailed, objective feedback and make the suggestions practical and actionable.
`;


    const userPrompt = `  
    The content to assess and evaluate is below:

    --- 
    
    ${content}
    
    ---

  `;

  //chrome-extension://amfhglmmhhacmgkbnifpcdnancapklog/
  
  const genAiResponse = await fetch('https://81368-dxpefirefallproxy.adobeio-static.net/api/v1/web/dx-excshell-1/generic', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': `${contentApiKey}`
    },
    body: JSON.stringify({
      systemPrompt: systemPrompt.trim(),
      userPrompt: userPrompt.trim(),
    })
  });

  if (!genAiResponse.ok) {
    const json = await genAiResponse.json();
    if (genAiResponse.status === 401) {
      return `<sp-badge style="width: 100%;" size="M" variant="negative">Invalid Content API key</sp-badge>`;      
    } else {
      return `<sp-badge  style="width: 100%;" size="M" variant="negative">Error generating questions: ${genAiResponse.status} -- ${json.error}</sp-badge>`;
    }
  }

  const json = await genAiResponse.json()
  const results = json || { categories: [] };

  return `

    <h4>Overall score: ${results.overall_score}</h3>

   <table class="spectrum-Table spectrum-Table--sizeS" style="width: 100%">
      <thead class="spectrum-Table-head">
        <tr>
          <th class="spectrum-Table-headCell">
            Category
          </th>
          <th class="spectrum-Table-headCell">
            Score
          </th>
          <th class="spectrum-Table-headCell">
            Evaluation
          </th>
        </tr>
      </thead>
      <tbody class="spectrum-Table-body">
        ${results.categories.map(cat => `
          <tr class="spectrum-Table-row">
            <td class="spectrum-Table-cell">${cat.name}</td>
            <td class="spectrum-Table-cell">${cat.score}</td>
            <td class="spectrum-Table-cell">
              <ul style="margin: 0; padding-left: 1rem;" class="bad">${cat.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </sp-table>
  `;
}



export { getToolsTabHtml };





