import { getResourcesTabHtml } from "./popup-common";
import moment from "moment";
import momentDurationFormatSetup from 'moment-duration-format';

momentDurationFormatSetup(moment);

export default function jiraCoursePopup(response, callback) {
    let course = response.jira;
    let communityPost = getCommunityPost(course);

    let html = `
        <sp-tabs selected="1">
            <sp-tab data-tabs="0" label="Jira Description Template" value="0"></sp-tab>        
            <sp-tab data-tabs="1" label="Course/Lesson Markdown" value="1"></sp-tab>
            <sp-tab data-tabs="2" label="Exl Community Post" value="2"></sp-tab>
            <sp-tab data-tabs="3" label="Resources" value="3"></sp-tab>
            </sp-tabs>         

            <br/>
            <br/>  

            <div data-tab="0" class="tab-content">

                <sp-button data-copy-to-clipboard="popup-jira-course__jira-template">
                    Copy Jira description template to clipboard
                </sp-button>  

                <br/>
                <br/>
                <textarea id="popup-jira-course__jira-template" class="markdown" readonly>${getJiraTemplate()}</textarea>
            </div>

            <div data-tab="1" class="tab-content">
            `;
    
                course.lessons.forEach((lesson, lessonIndex) => {
                    let md = getMarkdown(course, lesson, lessonIndex);

                    html += `                         

                    <h3>Lesson ${lessonIndex + 1}</h3> 

                    <h4>Filename: ${getFilename(getLessonId(course, lessonIndex, lesson.revision, lesson.series))}.md</h4>

                    <sp-button data-copy-to-clipboard="popup-jira-course__lesson-${lessonIndex + 1}">
                        Copy lesson ${lessonIndex + 1} to clipboard
                    </sp-button>  

                    <br/>
                    <br/>

                    <textarea id="popup-jira-course__lesson-${lessonIndex + 1}" class="markdown" readonly>${md}</textarea>

                    <hr/>

                    <br/>
                    <br/>
                    `;             
                });
            
        html += `

        </div>

        <div data-tab="2" class="tab-content">
            <br/>
            <br/>
            
            <sp-button data-copy-to-clipboard="popup-jira-course__community-post">
                Copy ExL Community post to clipboard
            </sp-button>  

            <br/>
            <br/>

            <p><strong>Discussion thread title:</strong> Course Discussion: ${course.title}</p>

            <textarea id="popup-jira-course__community-post" class="community-post" readonly>${communityPost}</textarea>

            <br/><br/>

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

function getFilename(lessonId) {
    return lessonId.toLowerCase().replaceAll('.', '-');
}

function firstOnly(value, lessonIndex) {
    if (lessonIndex === 0) {
        return value;
    } else {
        return "''";
    }
}

function lastOnly(value, course, lessonIndex) {
    if (lessonIndex === course.lessons.length - 1) {
        return value;
    } else {
        return "''";
    }
}

function getLessonId(course, lessonIndex, revision, series) {

    if (lessonIndex >= course.lessons.length) { 
        return "''" } 
    else {
        return `${getCourseIdSolution(course.products[0])}-${getCourseIdRole(course.role[0])}-${lessonIndex + 1}-${new Date().getFullYear()}.${revision}.${series}`;
    }
}

function getMarkdown(course, lesson, lessonIndex) {

    let lessonId = getLessonId(course, lessonIndex, lesson.revision, lesson.series);
    let courseDuration = formatDuration(getCourseDuration(course.lessons).humanize());

    let md = `---
title: ${lessonIndex === 0 ? course.title : lesson.title }
description: ${lessonIndex === 0 ? course.description : lesson.description}
solution: ${course.products?.join(', ') || ''} 
role: ${course.role?.join(',') || ''} 
level: ${course.level?.join(',') || ''} 
course-id: ${lessonId}
course-thumbnail: /www/img/thumb/${course.title.toLowerCase().replaceAll(' ', '-')}.png
course-title: ${lesson.title || ''}
course-description: ${lesson.description || ''}
course-path-title: ${firstOnly(course.title, lessonIndex) || ''}
course-path-description: ${firstOnly(course.description, lessonIndex) || ''}
course-url: https://experienceleague.adobe.com/?recommended=${lessonId}#dashboard/learning
course-length: ${firstOnly(courseDuration, lessonIndex) || ''}
course-next: ${getLessonId(course, lessonIndex + 1, lesson.revision, lesson.series)}
course-survey-url: '' 
community-url: ${lesson.communityLink}
community-manager: ${course.assignee}
community-manager-picture: ${getCommunityPicture(course.assignee)}
course-hide: false
award-title: ${lastOnly(course.title, course, lessonIndex) || 'Title of course...' }
award-description: ${lastOnly(course.description, course, lessonIndex) || 'Description of course...'}
archived: false
publish: false
hide: false
menu: ''
training: ''
meta:
  - title: Length
    description: ${getLessonDuration(lesson).humanize()}
  - title: Audience
    description: ${course.role.join(', ')}
guides:`;

let storyIndex = 0;
for (let j in lesson.stories) {
    let story = lesson.stories[j];

  md += `
  - guide-title: ${lesson.title}
    step-title: ${story.title}
    title: ${story.title}
    description: ${lessonIndex === 0 ? course.description : story.description}
    qualifier-id: ${lesson.qualifierId} 
    thumbnail: /www/img/thumb/${story.videoId}.jpeg
    url: ${lessonIndex === 0 ? story.videoUrl : story.publishLink}`;
}

md += `
steps:
    - title: ${lesson.title}
    description: ${lesson.description}
    label: ${lessonIndex === 0 ? 'Get Started' : 'Get Value'}
    guide: ${lesson.qualifierId}
---

# ${lessonIndex === 0 ? course.title : lesson.title}

## Course Description

${lessonIndex === 0 ? course.description : lesson.description}

## What you'll learn {#learn} 
${ lessonIndex === 0 ? `
1. Optional list of learning objectives - only add to first lesson` : `` }

## Let's get learning.

`;

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

function getCourseIdSolution(jiraSolution) {

    let solutions = {
        "Experience Manager": "ExperienceManager",
        "Analytics": "Analytics",
        "Campaign": "Campaign",
        "Experience Cloud": "ExperienceCloud",
        "Audience Manager": "AudienceManager",
        "Customer Journey Analytics": "CustomerJourneyAnalytics",
        "Customer Experience Management": "CXM"
    }

    let solution = solutions[jiraSolution];
    if (!solution) {
        solution = jiraSolution.replaceAll(' ', '');
    }

    return solution;
}

function getCourseIdRole(role) {

    if (['User'].includes(role)) {
        return 'U';
    } else if (['Architect', 'Developer', 'Data Architect', 'Data Engineer'].includes(role)) {
        return 'D';
    } else if (['Administrator'].includes(role)) {
        return 'A';
    } else if (['Leader'].includes(role)) {
        return 'L';
    }

    return '?';
}

function getCommunityPicture(name) {

    const pictures = {
        "David Gonzalez": "https://experienceleaguecommunities.adobe.com/legacyfs/online/avatars/a1007_car_sedan_blue.png",
        "Girish Bedekar": "https://experienceleaguecommunities.adobe.com/t5/image/serverpage/avatar-name/vampire/avatar-theme/candy/avatar-collection/monsters/avatar-display-size/profile/version/2?xdesc=1.0",
        "Daniel Gordon": "https://experienceleaguecommunities.adobe.com/t5/image/serverpage/image-id/26309i06EC86FA92AAE9C7/image-dimensions/150x150/image-coordinates/0%2C0%2C2316%2C2316?v=1.0",
        "Doug Moore": "https://experienceleaguecommunities.adobe.com/t5/image/serverpage/image-id/27685i780BC8DF8A1C6B83/image-dimensions/150x150/image-coordinates/0%2C57%2C572%2C629/constrain-image/false?v=1.0",
        "Sandra Hausmann": "https://experienceleaguecommunities.adobe.com/t5/image/serverpage/image-id/28105i7877BD74D9A7B834/image-dimensions/150x150/image-coordinates/240%2C0%2C1200%2C960?v=1.0",
        "Amelia Waliany": "https://experienceleaguecommunities.adobe.com/legacyfs/online/avatars/a1108419_18921916_10106387200505789_7290354218988888756_n.png",
        "Daniel Wright": "https://experienceleaguecommunities.adobe.com/t5/image/serverpage/image-id/27241i57BD4B9F4A057CB0/image-dimensions/150x150/image-coordinates/23%2C41%2C300%2C318/constrain-image/false?v=1.0"
    }

    return pictures[name] || ''
}


function getJiraTemplate() {

    return `Course title: ...
Course description: ...
Qualifier ID: ######
Revision: #
Series: AAAA
Community link: https://...

Intro name
The intro description on a single line.
KT-#-of-the-intro-video (Jira publishLink set to video link)

Lesson 1 name
Lesson 1 course description on a single line.
KT-#-of-story-in-the-lesson
KT-#-of-story-in-the-lesson
KT-#-of-story-in-the-lesson

Lesson 2 name
Lesson 2 course description on a single line.
KT-#-of-story-in-the-lesson
KT-#-of-story-in-the-lesson
KT-#-of-story-in-the-lesson

!END COURSE
`;

}

function formatDuration(humanized) {

    if ('an hour' === humanized) {
        return '1 hour';
    }

    return humanized;
}