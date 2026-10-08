---
title: "No More MVC - Organize Big Projects In Laravel PHP"
slug: "no-more-mvc-organize-big-projects-in-laravel-php"
created: "2022-06-24"
updated: "2022-06-24"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "No More MVC - Organize Big Projects In Laravel PHP"
originalPublished: "2022-06-24"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/no-more-mvc-organize-big-projects-in-laravel-php/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "No More MVC - Organize Big Projects In Laravel PHP"
featuredImageCredit: "Photo by Jeff Sheldon on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@ugmonk"
---

### No More MVC - Organize Big Projects In Laravel PHP

Staring of every project is form one question how we have to organize project? everyone know about 3 layer design named MVC but it's not enough to manage large projects. lets start it by going down in it.

### **What MVC provide?**

The Model-View-Controller (MVC) provide to division on data layer, manipulation on data (Controller) and on view. Moreover Laravel provide you more control on UI elements, you can make reusable widgets.

### **What MVC not provide?**

The MVC model cannot helps you to manage complexities of data in simple term you less control on controller side.

even you cannot have a appropriate way to manage you routes.

### **Solution?**

We have another modified approach that extend MVC to Hierarchical-model-view-controller (HMVC) which provide you more control on structuring you project.

### **How HMVC work?**

The HMVC is collation of mobile MVC structure, each part of execute separately. each module has it own Views, Controller, Routes, Config, Migrations and Model.

### **Why HMVC?**

- Modularization: it provide higher level of modulization.
- Reusability: it make code to be reusable like other Laravel packages.
- Extendibility: it provide maximum extendibility because it provide every module Separately, new extendibility act as now package.

### **How to achieve HMVC in Laravel?**

[Laragine](https://github.com/yepwoo/laragine) is a best Laravel package which help to provide HMVC. It help to manage CRUD operation with Unit Test, Factories, Migration etc. but you have to add Routes by your own.

Package: [yepwoo/laragine](https://github.com/yepwoo/laragine)
Documentation: [Laragine documentation](https://yepwoo.com/products/laragine/docs/v2/introduction)

### **Conclusion**

HMVC just extend you MVC to make manage thing more organized.
