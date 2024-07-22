import { delegateEvent } from "../../utils";
const EMPTY_PLAYLIST_HTML = `<p data-playlist-item-empty class="spectrum-Body spectrum-Body--sizeM">No items in playlist</p>`;

let PAGE = {
  title: "",
  url: "",
};

/* HTML */

function getPlaylistTabHtml({ title, metadata, url }) {
  PAGE.title = title;
  PAGE.url = url;

  addPlaylistEventListeners();

  return `
    <h3>Playlist creator</h3>
    <p>This interface helps you define playlist markdown for Experience League.
    Navigate to the desired pages and select the "Add" button below. 
    Once your playlist is complete, click "Copy markdown to clipboard" and paste the content into a new MD file in the <a href="https://git.corp.adobe.com/AdobeDocs/playlists.en" target="_blank" rel="referrer">playlists.en</a> Git repo, then complete the metadata.</p>

    <sp-action-button data-playlist-generate-markdown>Copy markdown to clipboard</sp-action-button>
    <sp-action-button data-playlist-clear>Clear playlist</sp-action-button>

    <ul class="playlist" data-playlist>
        ${getPlaylistItemsHtml()}
    </ul>

    <div data-playlist-add-wrapper>
        ${getPlaylistAddButtonHtml(PAGE, metadata.videos || [], loadPlaylist())}
    </div>`;
}

function getPlaylistItemsHtml() {
  const playlist = loadPlaylist();

  if (playlist.length > 0) {
    return `
        ${loadPlaylist()
          .map((item) => {
            return getPlaylistItemHtml(item);
          })
          .join("")}
      `;
  } else {
    return EMPTY_PLAYLIST_HTML;
  }
}

function getPlaylistAddButtonHtml(page, videos = [], playlist = null) {
  if (playlist === null) {
    playlist = getPlaylist();
  }

  let html = `<sp-action-button disabled>Page already in playlist</sp-action-button>`;

  if (playlist.find((item) => item.url === PAGE.url) === undefined) {
    if (videos.length < 1) {
      html = `<sp-action-button disabled>Page does not have a video</sp-action-button>`;
    } else if (videos.length > 1) {
      html = `<sp-action-button data-playlist-item-title="${PAGE.title}" data-playlist-item-url="${PAGE.url}" data-playlist-add>Add this page to playlist</sp-action-button>
      <br/>
      <div class="spectrum-Badge spectrum-Badge--sizeS spectrum-Badge--orange">
        <span class="spectrum-Badge-label">This page has ${videos.length} videos, only the first is used in a playlist.</span>
      </div>`;

    } else { 
      html = `<sp-action-button data-playlist-item-title="${PAGE.title}" data-playlist-item-url="${PAGE.url}" data-playlist-add>Add this page to playlist</sp-action-button>`;
    }
  } 

  return html;
}

function getPlaylistItemHtml({ title, url }) {
  return `
          <li class="playlist-item" data-playlist-item>
              <a href="${url}" target="_blank" 
                  data-playlist-item-title="${title}" 
                  data-playlist-item-url="${url}" 
                  data-playlist-item-input>${title}</a>
              <button data-playlist-item-move-up>&#8679;</button>
              <button data-playlist-item-move-down>&#8681;</button>
              <button data-playlist-item-remove>&#9932;</button>
          </li>
      `;
}

/* Helpers */

function updatePlaylistAddButton() {
  document.querySelector("[data-playlist-add-wrapper]").innerHTML =
    getPlaylistAddButtonHtml(PAGE);
}

function getPlaylist() {
  return [...document.querySelectorAll("[data-playlist-item-input]")].map(
    (item) => {
      return {
        title: item.getAttribute("data-playlist-item-title"),
        url: item.getAttribute("data-playlist-item-url"),
      };
    }
  );
}

/* Local storage */

function loadPlaylist() {
  return JSON.parse(localStorage.getItem("playlist")) || [];
}

function persistPlaylist() {
  // save playlist input values to local storage
  let playlist = getPlaylist() || [];

  localStorage.setItem("playlist", JSON.stringify(playlist));
}

/* Event listeners */

function addPlaylistEventListeners() {
  delegateEvent("body", "click", "[data-playlist-clear]", clearPlaylist);
  delegateEvent(
    "body",
    "click",
    "[data-playlist-item-remove]",
    removePlaylistItem
  );
  delegateEvent(
    "body",
    "click",
    "[data-playlist-item-move-up]",
    movePlaylistItemUp
  );
  delegateEvent(
    "body",
    "click",
    "[data-playlist-item-move-down]",
    movePlaylistItemDown
  );
  delegateEvent(
    "body",
    "click",
    "[data-playlist-generate-markdown]",
    generateMarkdown
  );
  delegateEvent("body", "click", "[data-playlist-add]", addPlaylistItem);
}

function addPlaylistItem(event) {
  const newItem = {
    title: this.getAttribute("data-playlist-item-title"),
    url: this.getAttribute("data-playlist-item-url"),
  };

  document.querySelector("[data-playlist-item-empty]")?.remove();

  document
    .querySelector("[data-playlist]")
    .insertAdjacentHTML("beforeend", getPlaylistItemHtml(newItem));

  persistPlaylist();
  updatePlaylistAddButton();
}

function clearPlaylist() {
  document.querySelector("[data-playlist]").innerHTML = EMPTY_PLAYLIST_HTML;
  persistPlaylist();
  updatePlaylistAddButton();
}

function removePlaylistItem(event) {
  this.closest("[data-playlist-item]").remove();
  persistPlaylist();
  updatePlaylistAddButton();

  if (getPlaylist().length === 0) {
    document.querySelector("[data-playlist]").innerHTML = EMPTY_PLAYLIST_HTML;
  }
}

function movePlaylistItemUp(event) {
  const item = this.closest("[data-playlist-item]");
  const prevItem = item.previousElementSibling;

  if (prevItem) {
    item.closest("[data-playlist]").insertBefore(item, prevItem);
  }

  persistPlaylist();
}

function movePlaylistItemDown(event) {
  const item = event.target.closest("[data-playlist-item]");
  const nextItem = item.nextElementSibling;

  if (nextItem) {
    item.closest("[data-playlist]").insertBefore(item, nextItem.nextSibling);
  }

  persistPlaylist();
}

function generateMarkdown() {
  const items = getPlaylist().filter((input) => {
    return input.value !== "";
  });

  console.log("Items", items);

  if (items.length === 0) {
    return;
  }

  let markdown = `---
title: Call to action, title case, 60 characters max
description: Call to action, title case, 150 characters max
solution: Add solutions: https://git.corp.adobe.com/AdobeDocs/exl-config/blob/master/metadata-values/solution.yml
role: Admin, Architect, Data Architect, Data Engineer, Developer, Leader, User
level: Beginner, Experienced, Intermediate
feature: ??? - select one or more from: https://adobe.ly/3JfnRW9
topic: ??? - select 0 or more from: https://adobe.ly/3NRHfMp
---

`;

  items.forEach((item) => {
    markdown += `1. ${item.url}\n`;
  });

  // copy to clipboard
  navigator.clipboard.writeText(markdown).then(() => {
    console.log("Markdown copied to clipboard");
  });
}

export { getPlaylistTabHtml };
