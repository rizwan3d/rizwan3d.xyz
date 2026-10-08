---
title: "How to speed up your Laravel application with PHP OPcache"
slug: "how-to-speed-up-your-laravel-application-with-php-opcache"
created: "2022-06-21"
updated: "2022-06-21"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "How to speed up your Laravel application with PHP OPcache"
originalPublished: "2022-06-21"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/how-to-speed-up-your-laravel-application-with-php-opcache/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "How to speed up your Laravel application with PHP OPcache"
featuredImageCredit: "Photo by Austin Distel on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@austindistel"
---

## How to speed up your Laravel application with PHP OPcache

Using PHP OPcache is a incer way to inhance performance of PHP. OPcache stores pre-compiled bytecode in memory, which reduce proceess of PHP to load.

## **Server Configure**

**Step 1.1:**

run the following command via your terminal.

> php -m | grep -i opcache

The output that you would see the following result:

> Zend OPcache

If you don't have OPcache enabled, you can install it with the following command on Ubuntu:

> sudo apt install php-opcache

If you are not using Ubuntu, you can install PHP OPcache using pecl:

> [Zend OPcache on PECL](https://pecl.php.net/package/zendopcache)

**Step 1.2:**

Open /etc/php/7.4/fpm/conf.d/10-opcache.ini in you favorite edit. Then at the bottom of the file add the following configuration:

> opcache.memory\_consumption=256
> opcache.interned\_strings\_buffer=64
> opcache.max\_accelerated\_files=32531
> opcache.validate\_timestamps=0
> opcache.enable\_cli=1

**Step 1.3:**

you need to restart PHP FPM:

> systemctl restart php7.4-fpm.service

## **Configure Laravel OPCache**

### **Step 2.1:**

You can install the package via Composer:

> composer require appstract/laravel-opcache

**Step 2.2:**

If you need to change config values, you can publish the config file with:

> php artisan vendor:publish - provider="Appstract\Opcache\OpcacheServiceProvider" - tag="config"

**Step 2.3:**

> php artisan opcache:compile { - force}
