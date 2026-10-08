---
title: "Static Analysis of PHP with PHPStan."
slug: "static-analysis-of-php-with-phpstan"
created: "2022-10-09"
updated: "2022-10-09"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Static Analysis of PHP with PHPStan."
originalPublished: "2022-10-09"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/static-analysis-of-php-with-phpstan/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Static Analysis of PHP with PHPStan."
featuredImageCredit: "Photo by Markus Spiske on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@markusspiske"
---

### Static Analysis of PHP with PHPStan.

Writing code that produce no error is difficult. Discuss every edge case is not possible while writing code first time.

taking care of Untyped properties, missing return type on a function, uninitialized private properties, Coding standard violations, Syntax violations and Security vulnerabilities is complex.

Most of the time code work fine until it moves to production server. Production server has lots of real data and sometime invalid and incomplete data that case crash on production. Languages and framework update day by day and as developer we update and refactor you code according to change log.

Refactoring legacy code that rarely runs is our week point that may cause issue that why we need static analysis on our code.

PHPStan is Static Analysis tool for PHP. That help to find errors in your code without actually running it on production and catches whole classes of bugs even before you write tests for the code.

**Installation**

Install PHPStan in your project by using a `composer require` command:

> composer require --dev phpstan/phpstan

And then run it by using its CLI tool:

> vendor/bin/phpstan analyse src

**Configure PHPStan**

PHPStan has multiple configuration that can be parsed by CLI as parameters such as the level of analysis, paths to be analysed, etc. PHPStan use a NEON file for configuration.

basic PHPStan configuration file looks like:

```
parameters:
    level: 6
    paths:
        - src
        - tests
```

Here is the [full configuration reference page](https://phpstan.org/config-reference) on its website.

You can add PHPStan in your GitHub Action so code get tested on every time you push a commit on your PRs.
