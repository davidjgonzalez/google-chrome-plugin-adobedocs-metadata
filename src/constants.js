const OPTIONS = {
    FS_CONTENT_ROOT: "gcp-adobedocs-metadata__options__fs-content-root",
    ANALYTICS_API_KEY: "gcp-adobedocs-metadata__options__analytics-api-key",
    ANALYTICS_DAY_RANGE: "gcp-adobedocs-metadata__options__analytics-range",
    CONTENT_API_KEY: "gcp-adobedocs-metadata__options__content-api-key",
    BETA: "gcp-adobedocs-metadata__options__beta"
}

const DURATIONS = {
    // regular reading speed is 200-300 wpm
    AVG_WORDS_PER_MINUTE: 275,
    // words in a code block is 300-400 wpm
    AVG_CODE_WORDS_PER_MINUTE: 375,
    AVG_IMAGE_TIME_IN_S: 3,
};

export { OPTIONS, DURATIONS };