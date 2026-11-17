// Storage key for changes handed from the popup to the GitHub edit page.
export const PENDING_KEY = "adobedocs-improve-pending";

// Pending changes older than this are ignored (the user likely abandoned them).
export const PENDING_MAX_AGE_MS = 30 * 60 * 1000;

// window.postMessage tag shared by the isolated and main-world GitHub content scripts.
export const GITHUB_MESSAGE_TAG = "adobedocs-improve";
