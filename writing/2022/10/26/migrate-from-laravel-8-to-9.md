---
title: "Migrate from Laravel 8 to 9"
slug: "migrate-from-laravel-8-to-9"
created: "2022-10-26"
updated: "2022-10-26"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Migrate from Laravel 8 to 9"
originalPublished: "2022-10-26"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/migrate-from-laravel-8-to-9/featured.png"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Migrate from Laravel 8 to 9"
---

## Migrate from Laravel 8 to 9

## Minimum Requirements

Laravel 9 can only run-on PHP 8.0 or above because of Symfony 6 components.

## Step 1:

Open composer.json and change version of following dependences.

> "laravel/framework": "9.0",
> "nunomaduro/collision": "6.1",

## Step 2:

Replace the "facade/ignition": "2.5" with "spatie/laravel-ignition": "1.0" and if your using pusher/pusher-php-server with "pusher/pusher-php-server": "5.0".

## Step 3:

Open app/Http/Middleware/TrustProxies.php and replace use Fideloper\Proxy\TrustProxies as Middleware with use Illuminate\Http\Middleware\TrustProxies as Middleware.

New replace

> protected $headers = Request::HEADER\_X\_FORWARDED\_ALL;

with

> protected $headers =
>  Request::HEADER\_X\_FORWARDED\_FOR |
>  Request::HEADER\_X\_FORWARDED\_HOST |
>  Request::HEADER\_X\_FORWARDED\_PORT |
>  Request::HEADER\_X\_FORWARDED\_PROTO |
>  Request::HEADER\_X\_FORWARDED\_AWS\_ELB;

## Step 4:

Last thing is to update composer by just running.

> composer update

Happy Development ....
