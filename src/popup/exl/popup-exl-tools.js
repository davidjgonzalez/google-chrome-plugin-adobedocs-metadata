import { OPTIONS } from "../../constants";
import "@spectrum-web-components/progress-circle/sp-progress-circle.js";

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

  getGenAiQuestionsHtml(exl, contentApiKey).then(html => {
    document.getElementById('tools-genai-questions').innerHTML = html;
  });

  return `
    <h4>GenAI training</h4>

    <div id="tools-genai-questions">
      <sp-progress-circle label="Generating questions..." indeterminate size="large"></sp-progress-circle>
    </div>
  `;
}

async function getGenAiQuestionsHtml(exl, contentApiKey) {

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

  const videoPromises = Array.from(main.querySelectorAll('.embed a[href^="https://video.tv.adobe.com/v"]')).map(async el => {
    const match = el.href.match(/\/v\/(\d+)/);
    const videoId = match ? match[1] : null;
    if (videoId) {
      const videoJson = await fetch(`https://video.tv.adobe.com/vc/${videoId}/eng.json`);
      const videoJsonData = await videoJson.json();
      const videoCaptions = videoJsonData.captions.map(caption => caption.content).join(' ');
      el.textContent = videoCaptions;
    }
  });
  
  await Promise.all(videoPromises);

  // get the text content
  const content = main.innerText?.trim();

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
    <textarea class="questions">${(results.map(r => `
Question: ${r.question}
Answer: ${r.answer}`).join('\n\n')).trim()}</textarea>`
}


export { getToolsTabHtml };
