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

                <sp-button data-copy-to-clipboard="${getJiraTemplate()}">
                Copy Jira description template to clipboard
                </sp-button>  

                <br/>
                <br/>
                <textarea class="markdown" readonly>${getJiraTemplate()}</textarea>

            </div>


            <div data-tab="1" class="tab-content">
            `;
    
            
                course.lessons.forEach((lesson, lessonIndex) => {
                    let md = getMarkdown(course, lesson, lessonIndex);

                    html += `                         

                    <h3>Lesson ${lessonIndex + 1}</h3> 

                    <h4>Filename: ${getFilename(getLessonId(course, lessonIndex, lesson.revision, lesson.series))}.md</h4>

                    <sp-button data-copy-to-clipboard="${md}">
                    Copy lesson ${lessonIndex + 1} to clipboard
                    </sp-button>  

                    <br/>
                    <br/>

                    <textarea class="markdown" readonly>${md}</textarea>

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
title: ${lesson.title || '' }
description: ${lesson.description || ''}
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
award-title: ${lastOnly(course.lessons[0].title, course, lessonIndex) || 'Title of first lesson...' }
award-description: ${lastOnly(course.lessons[0].description, course, lessonIndex) || 'Description of first lesson...'}
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

# ${lesson.title}

## Course Description

${lesson.description}

## What you'll learn {#learn} 
${ lessonIndex === 0 ? `
+ Optional list of learning objectives - only add to first lesson` : `` }

## Let's get learning.

`;

    return md;
}

function getCommunityPost(course) {

    let post = `Use this thread to ask any questions related to the upcoming ${course.title} course on Experience League. 
    
Experts are monitoring this thread to ensure your questions are answered.`;

    return post;
}

function getCommunityPicture(name) {

    if ('David Gonzalez' === name) {
        return 'https://experienceleaguecommunities.adobe.com/legacyfs/online/avatars/a1007_car_sedan_blue.png';
    } else if ('Girish Bedekar' === name) {
        return 'https://experienceleaguecommunities.adobe.com/t5/image/serverpage/avatar-name/vampire/avatar-theme/candy/avatar-collection/monsters/avatar-display-size/profile/version/2?xdesc=1.0'
    }

    return null;
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

function getCourseIdSolution(solution) {

    if (solution === 'Experience Manager') {
        return 'ExperienceManager';
    } else if (solution === 'Analytics') {
        return 'analytics'
    } 

    return '?';
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

function getJiraTemplate() {

    return `Qualifier ID: ######
Revision: #
Series: AAAA
Community Link: https://....

The course name
The course description on a single line.
KT-#-of-the-intro-video

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