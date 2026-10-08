---
title: "Up and Running with Model in Laravel - Advance use of Model"
slug: "up-and-running-with-model-in-laravel-advance-use-of-model"
created: "2022-06-23"
updated: "2022-06-23"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Up and Running with Model in Laravel - Advance use of Model"
originalPublished: "2022-06-23"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/up-and-running-with-model-in-laravel-advance-use-of-model/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Up and Running with Model in Laravel - Advance use of Model"
featuredImageCredit: "Photo by Mohammad Rahmani on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@afgprogrammer"
---

### Up and Running with Model in Laravel - Advance use of Model

This article is for advance user who know basics of Model in Laravel such as relations, soft delete, Mass assignment and Timestamps. now we are goin to discuses about Eager loading, Query Scopes, Accessors and Mutators, Model Events and Model Observers. lets get started.

At the date of publish of this article Laravel 9 is out.

### **Eager Loading**

ORM in Laravel provide very nice and clean solution for N+1 query problem with Eager loading, suppose we have a query and loop that get its image.

> $posts = Post:all();
> foreach($posts as $p){
>  print\_r($p->images());
> }

In this scenario we are executing another query for each item. To prevent this we can do this on database end not on backend. To full fill this issue we can use with() function with query it fill fetch all post along it's images and return it in collation, following example of can can help you.

> $posts = Post:wiht('images')->get();
> foreach($posts as $p){
>  print\_r($p->images);
> }

this will make you query faster and use less CPU time.

### **Query Scopes**

When you have to use where so common, for example we have to fetch all Post with 50 views that mean this post is popular, let have our common way to do.

> $pPost = Post:where('views', '>' , '50')->get();

Lets do it in Laravel way by build scopes, we have to add following code in our Post Model .

> public function scopePopuler($q){
>  return $q->where('views', '>' , '50');
> }

now you call become

> $pPost = Post:populer()->get();

we call combine scopes with each other like

> $pPost = Post:newPosts()->populer()->get();

### **Accessors and Mutators**

suppose we have to make Title of post uppercase and need to store it in lowercase so we will use Attribute type from ORM. following need to add our Post Model

> protected function Title(): Attribute {
>  return Attribute::make(
>  get: fn ($value) => ucfirst($value),
>  set: fn ($value) => strtolower($value),
>  );
> }

### **Model Events**

Laravel had retrieved, creating, created, updating, updated, saving, saved, deleting, deleted, trashed, forceDeleted, restoring, restored, and replicating event that are embedded with Model's lifecycle, Closures are the easy way to do so far. Following code can help you to archive this.

protected static function booted(){
 static::created(function ($post) {
 //
 });
}

### **Observers**

if you are listening to many events for you model you can create observer of group all events in single class. following command help to make observer for a model.

> php artisan make:observer PostObserver - model=Post

it will generate Observer for you mode in App/Observers directory. At last use to add list of observer in you App\Providers\EventServiceProvider class.

> protected $observers = [
> Post::class => [PostObserver::class],
> ];
