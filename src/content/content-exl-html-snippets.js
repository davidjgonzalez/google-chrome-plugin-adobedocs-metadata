// CTA Labels - The key must appear in the img's src attribute to use the label
const LABELS = {
    "video.tv.adobe.com": "Watch the video",
    "fallback-label": "Learn more"
};

// Set to false to NOT update the web page with the cards HTML
const PREVIEW = true;



/** DO NOT CHANGE ANYTHING BELOW THIS LINE! **/

function cardsHtml(cards) {
  let cardHtml = `<div class="columns is-multiline">`;

  cards.forEach((card, index) => {
    cardHtml += `<div class="column is-half-tablet is-half-desktop is-one-third-widescreen" aria-label="${
          card.title
        }" tabIndex="${index}">
        <div class="card" style="height: 100%; display: flex; flex-direction: column; height: 100%;">
        <div class="card-image">
          <figure class="image x-is-16by9">
            <a href="${card.link}" title="${card.title}" tabindex="-1">
              <img class="is-bordered-r-small" src="${modifyUrl(card.img.src)}" alt="${card.img.getAttribute("alt") || card.title}">
            </a>
          </figure>
        </div>
        <div class="card-content is-padded-small" style="display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between;">
            <div class="top-card-content">
                ${
                  1 === 2 && card.subtitle
                    ? `<span style="font-style: italic;" class="is-size-6">${card.subtitle}</span>`
                    : ""
                }
                <p class="headline is-size-6 has-text-weight-bold">
                    <a href="${card.link}" title="${card.title}">${card.title}</a>
                </p>
                <p class="is-size-6">${card.body}</p>
            </div>
            <a href="${
              card.link
            }" class="spectrum-Button spectrum-Button--outline spectrum-Button--primary spectrum-Button--sizeM" style="align-self: flex-start; margin-top: 1rem;">
              <span class="spectrum-Button-label has-no-wrap has-text-weight-bold">${
                card.ctaLabel
              }</span>
            </a>
          </div>
        </div>
      </div>`;
  });

  cardHtml += `</div>`;

  return cardHtml;
}


function getCtaLabel(card) {
    let found = Object.keys(LABELS).find(key => {
        var regex = new RegExp(key);
        return regex.test(card.img.src);
    });


    return found ? LABELS[found] : LABELS["fallback-label"];
}

document.querySelectorAll('[data-id="body"] table tbody').forEach((table) => {
  let cards = [];

  table.querySelectorAll("tr td").forEach((cell) => {
    if (cell.innerText.trim() !== "") {
      let card = {
        link: cell.querySelector("a")?.getAttribute("href"),
        title: Array.from(cell.querySelectorAll("a")).find(
          (a) => a.innerText.trim() !== ""
        )?.innerText,
        subtitle: cell.querySelector("em")?.innerText,
        img: cell.querySelector("img"),
        body: cell
          .querySelector("p")
          ?.innerHTML.trim()
          .replace(/^<br\s*\/?>|<br\s*\/?>$/gi, "")
      };
      card.ctaLabel = getCtaLabel(card);
      if (card.link) {
        card.link = modifyLink(card.link);
      }
      
      cards.push(card);
    }
  });

  if (PREVIEW) {
    table.closest("div.table-container").outerHTML = cardsHtml(cards);
  }

  console.group("-".repeat(10) + " Begin cards HTML for copy/paste " + "-".repeat(10));
  console.log(cardsHtml(cards));
  console.groupEnd("-".repeat(10) + " End cards HTML for copy/paste " + "-".repeat(10));
});

function modifyUrl(url) {
  if (!url) return url;

  url = url.replace('https://experienceleague.corp.adobe.com', 'https://experienceleague.adobe.com');
  return url;
}

function modifyLink(link) {
  if (!link) return link;

  // Check if card.link starts with '/' and ends with '?lang=en'
  if (link.startsWith('/') && link.endsWith('?lang=en')) {
      // Prefix with 'https://experienceleague.adobe.com' and remove '?lang=en'
      link = 'https://experienceleague.adobe.com' + link.slice(0, -8);
  }

  return modifyUrl(link);
}