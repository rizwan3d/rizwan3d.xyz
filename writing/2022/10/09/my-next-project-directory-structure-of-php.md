---
title: "My Next Project Directory Structure Of PHP"
slug: "my-next-project-directory-structure-of-php"
created: "2022-10-09"
updated: "2022-10-09"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "My Next Project Directory Structure Of PHP"
originalPublished: "2022-10-09"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/my-next-project-directory-structure-of-php/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "My Next Project Directory Structure Of PHP"
featuredImageCredit: "Photo by Andreas Klassen on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@schmaendels"
---

## My Next Project Directory Structure Of PHP

Every time I have stated new project, thinking about best directory structure is problem. I have tried to may directory structure that may fit my need of SOLID principles and design patterns.

Most simple one is Controller, Model, View most of developer think this one best because of MVC model but this is not so good for larger projects and cannot provide higher level of Separation of concern.

I have check directory structure of many open-source framework like Laravel, CakePHP, Yii etc but none of them satisfy my need, therefor after lots of experiments and productive hour I have designed best directory structure. Currently I think this one best but there is nothing like end maybe it stop full fulling my need in future.

![My Next Project Directory Structure Of PHP image 1](/assets/images/posts/my-next-project-directory-structure-of-php/content-1.png)

## **Framework**

Framework contain everything that required to load project and reusable in whole project like bootstrap.php, load all Middleware, Routes etc.

## Modules

This directory is most import that has all the business logic, Model and views. this is split in Domain, Presentation, Repository and Services. Domain has all Model and its exceptions; Presentation has Actions (I am not use controllers right now) and Middleware. Complete directory structure is presented below.

![My Next Project Directory Structure Of PHP image 2](/assets/images/posts/my-next-project-directory-structure-of-php/content-2.png)

![My Next Project Directory Structure Of PHP image 3](/assets/images/posts/my-next-project-directory-structure-of-php/content-3.png)

## Public

This one is a starting point of system that load functions from frameworks bootstrap.php

Following is complete image of project in VS Code.

![My Next Project Directory Structure Of PHP image 4](/assets/images/posts/my-next-project-directory-structure-of-php/content-4.png)

This is all for now on my finding on directory structure.

Repository Link: [GrowBit-Tech/noname: New PHP Framework for Large Projects. (github.com)](https://github.com/GrowBit-Tech/noname)
