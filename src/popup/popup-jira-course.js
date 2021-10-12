import { getResourcesTabHtml } from "./popup-common";
import moment from "moment";
import momentDurationFormatSetup from 'moment-duration-format';
momentDurationFormatSetup(moment);


export default function jiraCoursePopup(response, callback) {

    let course = response.jira;
    let markdown = getMarkdown(course);
    let communityPost = getCommunityPost(course);

    let html = `
        <sp-tabs selected="1">
            <sp-tab data-tabs="1" label="Course Definition" value="1"></sp-tab>
            <sp-tab data-tabs="2" label="Exl Community Post" value="2"></sp-tab>
            <sp-tab data-tabs="3" label="Resources" value="3"></sp-tab>
        </sp-tabs>

        <div data-tab="1" class="tab-content">
            <br/>
            <br/>
            
            <sp-button data-copy-to-clipboard="${markdown}">
                Copy course definition to clipboard
            </sp-button>  

            <br/>
            <br/>

            <textarea class="markdown" readonly>${markdown}</textarea>
        </div>

        <div data-tab="2" class="tab-content">
            <br/>
            <br/>
            
            <sp-button data-copy-to-clipboard="${communityPost}">
                Copy ExL Community post to clipboard
            </sp-button>  

            <br/>
            <br/>

            <p><strong>Discussion thread title:</strong> Course Discussion: ${course.title}</p>

            <textarea class="community-post" readonly>${communityPost}</textarea>

            <br/></br>

            Instructions

            <ol>
                <li>Create a new <strong>Discussions</strong> post on the appropriate <a target="_blank" href="https://experienceleaguecommunities.adobe.com/">ExL Community</a></strong></li>
                <li>Save this discussion and copy the URL and paste it into your course description.</li>
                <li>When the course is published, Copy the live production URL for the course.</li>
                <li>Go back into your course, and simply edit the wording, removing "upcoming", and making the course name into a link.</li>
                 
            </ol>
        </div>

        <div data-tab="3" class="tab-content">
            ${getResourcesTabHtml()}
        </div>
    `;

    callback(html);
}

function getMarkdown(course) {

    let md = `
*AIRTABLE REF*:

*Course title*: ${course.title}

*Course description*: <Enter course description...>

*Course screenshot thumbnail*: <attach 16:10 image to this jira>

*What you will learn*:
    
    * Learning objective 1
    * Learning objective 2
    * Learning objective 3

*Course duration:* ${getCourseDuration(course.lessons).format('hh:mm:ss')}

*ExL Community Link*:

----

*Intro Video title*: Introduction to ${course.title}

*Intro Video description*: <Enter intro video description...>

*Intro Video link*: https://video.tv.adobe.com/v/###
`;

    for (let i in course.lessons) {
        let lesson = course.lessons[i];

        md += `
----

*Lesson Jira ID*:

*Lesson title*: ${lesson.title}

*Lesson description*:

*Lesson duration*: ${getLessonDuration(lesson).format('hh:mm:ss')}

||KT||Title||Description||Link||Duration||
`;

        for (let j in lesson.stories) {
            let story = lesson.stories[j];
            md += `|${story.jiraId}|${story.title}|${story.description}|${story.publishLink || 'TBD' }|${getStoryDuration(story).format('hh:mm:ss')}|
`;
        }
    }

    return md;
}

function getCommunityPost(course) {

    let post = `Use this thread to ask any questions related to the upcoming ${course.title} course on Experience League. 
    
Experts are monitoring this thread to ensure your questions are answered.`;

    return post;
}


function getCourseDuration(lessons) {
    let total = moment.duration(0);

    for (let i in lessons) {
        total.add(getLessonDuration(lessons[i]));
    }

    return total;
}

function getLessonDuration(lesson) {
    let total = moment.duration(0);
    
    for (let i in lesson.stories) {
        total.add(getStoryDuration(lesson.stories[i]));
    }

    return total;
}

function getStoryDuration(story) {
    let m = moment.duration(story.duration);

    if (!m.isValid()) { 
        m = moment.duration('00:00:00');
    } 
    
    return m;
}