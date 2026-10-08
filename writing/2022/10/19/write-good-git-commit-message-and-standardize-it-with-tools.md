---
title: "Write good Git commit message and standardize it with tools."
slug: "write-good-git-commit-message-and-standardize-it-with-tools"
created: "2022-10-19"
updated: "2022-10-19"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Write good Git commit message and standardize it with tools."
originalPublished: "2022-10-19"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/write-good-git-commit-message-and-standardize-it-with-tools/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Write good Git commit message and standardize it with tools."
featuredImageCredit: "Photo by Vanna Phon on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@phonvanna"
---

## Write good Git commit message and standardize it with tools.

I am writing this to sum up all the information that I gained with experience and learned for different sources about making a nice and understandable commit message.

My commit message look like.

> Type: Subject

Commit message is split into two parts, type and subject. Type tells what you for example did you fix the things or refactored the code and subject describe what you did actually in other term short explanation of task.

## **Type:**

**Build:** Build related changes such as add or removed dependency packages.
**Feat:** A new feature (Sprint task.)
**Fix:** A bug fix.
**Docs:** Documentation related changes.
**Refactor:** refactoring of code.
**Perf:** A code that improves performance.
**Style:** A code that is related to styling.

## Subject:

Subject must be use imperative, present tense (eg: use "add" instead of "added" or "adds")
don't use period (.) at end of commit message.

You can also use tools like [Glitter](https://github.com/Milo123459/glitter) or [Commitizen](http://commitizen.github.io/cz-cli/) to standardize your commit messages.

You can use your JIRA or Click Up ticket in the commit message so that everything can be link or trace back anytime and the codebase remain maintainable for future developers.
