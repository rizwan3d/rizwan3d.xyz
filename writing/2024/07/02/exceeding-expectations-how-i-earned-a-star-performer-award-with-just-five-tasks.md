---
title: "Exceeding Expectations: How I Earned a Star Performer Award with Just Five Tasks"
slug: "exceeding-expectations-how-i-earned-a-star-performer-award-with-just-five-tasks"
created: "2024-07-02"
updated: "2024-07-02"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Exceeding Expectations: How I Earned a Star Performer Award with Just Five Tasks"
originalPublished: "2024-07-02"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/exceeding-expectations-how-i-earned-a-star-performer-award-with-just-five-tasks/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Exceeding Expectations: How I Earned a Star Performer Award with Just Five Tasks"
featuredImageCredit: "Photo by Wan San Yip on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@wansan_99"
---

### Exceeding Expectations: How I Earned a Star Performer Award with Just Five Tasks

This article is about my one-year (seven-month) experience in a product-based software company. When I joined the company, they were stuck with some tasks, and their current developers weren't able to complete them. I got hired as a Senior Software Engineer/ Team lead, and during my interview, the COO asked me if I could understand their system without any help from documentation or other resources. My answer was yes. They were building a medical billing software for New York-based facilities. I had never worked on any medical billing system before.

On my first day, as I received my laptop from IT and got access to code repositories (they used Bitbucket), I started installing my required tools. I found that the product was written in PHP and Angular, but my previous experience was with C# (.NET). The next day, I got my first task, directly assigned by the product owner (who was also the COO).

**Task 1: Understanding the System and Drawing a Diagram**

My first task was to understand the system and draw a diagram that would help new developers understand system modules and their interconnections. I didn't know why they assigned this task to me because it could have been easily done by any of their lead developers who had been working with them from the beginning.

**Solution:**

First, I listed all the modules and separated them into groups based on their interconnections or dependencies, then linked them with other groups. Additionally, I added a reference number to each module and created an Excel sheet to refer to them with the path of the directory in the code structure.

**Task 2: Code Review and Improvement**

In my second task, I had to do a code review and suggest improvements in performance and coding standards.

**Solution:**

First, I created a document about coding standards that included clean code, DRY, and SOLID principles, and shared it with the COO and Operations Manager (Technical). After approval, I started reviewing the code and shared my findings. The improvement document was extensive. The old developers did not follow any standards, and nothing was organized. The system was filled with n+1 problems, the code was very coupled, and there were many other issues. They asked for my opinion on fixing these issues. I suggested rebuilding the whole system, which would take less time than fixing the existing one. However, the COO asked for a quick solution to improve performance due to customer complaints. I performed the following steps to increase performance:

1. Increased the DB instance's hardware specifications, such as RAM and CPU.
2. Archived old DB logs and removed code that stored files such as PDFs and PNGs in logs.
3. Changed log preserving code to async to avoid wait time.
4. Removed n+1 problems from frequently used tables with high data volumes.

**Task 3: Angular and Bootstrap Migration**

The system was developed in Angular 7 and Bootstrap 4, and they wanted to update it to Angular 14 and Bootstrap 5. The old developers were unable to do the Angular migration.

**Solution:**

I started with the Angular migration because changing from Bootstrap 4 to 5 could be easily done with regex-based search and replace. I found that it was not possible to migrate directly from Angular 7 to 14 using the migration tool. I tried to migrate step by step from Angular 7 to 8, then 8 to 9, but it didn't work. After thinking for 2 to 3 hours, I got the idea to create a new project in Angular 14, install all the required NPM packages, and copy all the code from Angular 7 to the new project. This didn't solve all the issues, but the new bugs were understandable. Finally, I completed this task, upgraded from Bootstrap 4 to 5 with regex-based search and replace, and assigned the remaining UI issue to a frontend developer.

**Task 4: Switching from Socket.io to PHP for Notifications**

Previously, they were using Socket.io for push notifications and real-time chat, and they wanted to switch to PHP to keep the application in one tech stack. Before taking ownership of this task, one of the PHP leads and his associate had been working on it but unfortunately failed to deliver. The COO assigned this task to me. At that time, I was working on my personal open-source project, "[phpThoughts](https://github.com/rizwan3d/PhpThoughtshttps://github.com/rizwan3d/PhpThoughts)," which is a Clean Architecture-based PHP framework based on Slim.

**Solution:**

I added support for sockets in [phpThoughts](https://github.com/rizwan3d/PhpThoughts) and deployed it on the dev server, but it stopped working. After communicating with the previous developer, I found they were also stuck on the same issue. I was very confused because it worked perfectly on my local machine. I didn't have direct access to the dev server, as CD was implemented and URLs were provided by the DevOps team. While working on this, I assigned other tasks to my team when they are working on that I noticed that someone was trying to connect to the socket with an invalid route path. I ordered my team to stop working and checked each laptop. On the QA's laptop, the system was sending requests to the server with a different subdomain, trying to connect with my socket. I found that the DevOps team had provided a wrong URL, and finally, my problem got fixed.

**Task 5: Rebuilding the Task Manager**

Performance issues were resolved but not completely. The billing and task modules were still too slow. My task was to rebuild the task manager. I assigned all CRUD operations to my team. Meanwhile, I wrote a migration script for the DB and followed these steps to fulfill the requirements:

1. Designed the system so that completed tasks older than two months could be moved to an inactive task table, which would only be used to search and select data when the user filters for older dates.
2. Added an archive feature for tasks, separating tables to reduce the number of rows and improve speed.
3. Added Redis to other tables such as task status and task type.
4. Addressed the issue of the task count display on all task pages. The count query was taking too much time, so I shifted the count to Redis and updated it when creating new tasks or updating statuses. The Redis value was refreshed by the count query every two hours.

With these steps, I completed my fifth task.

During this period, I also handled additional tasks such as fixing the PDF print issue where the background was showing on signature positions, even though the system was placing PNGs on the PDF. I provided support to customers, assisted them with code reviews and some other small tasks.

**Conclusion**

In my seven months at the product-based software company, I tackled challenging tasks and made significant improvements to the system, ultimately earning the Star Performer Award. Despite not having prior experience with medical billing systems, I successfully navigated and optimized the existing PHP and Angular-based system, leveraging my skills and determination. From creating a comprehensive system diagram to improving coding standards, enhancing performance, and managing complex migrations, each task was an opportunity to demonstrate my problem-solving abilities and technical expertise.

If you found my journey insightful or have faced similar challenges in your career, I'd love to hear your thoughts and experiences. Share your stories or questions in the comments below, and let's start a conversation about overcoming obstacles and achieving success in the tech industry. Don't forget to follow me for more articles on software development, system optimization, and career growth!
