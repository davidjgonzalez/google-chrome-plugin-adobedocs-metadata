
function parseJiraTitle(title) {

    // [Asset Essentials] Getting started with Assets Essentials - Feature Video
    let found = title.match(/[^\]]+](.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video|Course|Lesson)/i);
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    // [Asset Essentials] Getting started with Assets Essentials
    found = title.match(/[^\]]+](.*)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    // ACC - Configure the integration between ACC and AEM - Feature Video
    found = title.match(/[^-]+-(.*)-+\s?(Feature Video|Technical Video|Tutorial|Article|Code Sample|Event|Exercise|Intro Video|Presentation|Value Video|Course|Lesson)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    // URS - Project & Repository structure
    found = title.match(/[^-]+-(.*)/i)
    if (found && found.length >= 2 && found[1]) {
        return found[1].trim();
    }

    return title;
}

export { parseJiraTitle };