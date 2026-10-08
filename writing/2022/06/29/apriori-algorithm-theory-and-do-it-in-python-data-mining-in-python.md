---
title: "Apriori Algorithm Theory And Do It In Python- Data Mining In Python"
slug: "apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python"
created: "2022-06-29"
updated: "2022-06-29"
category: "Data Science"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Apriori Algorithm Theory And Do It In Python- Data Mining In Python"
originalPublished: "2022-06-29"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Apriori Algorithm Theory And Do It In Python- Data Mining In Python"
featuredImageCredit: "Photo by Chris Liverani on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@chrisliverani"
---

## Apriori Algorithm Theory And Do It In Python- Data Mining In Python

In 1994, Mr. R. Agarwal and Mr. R. Srikant working to find frequent set of item in Boolean based dataset. They are come up with algorithm named Apriori. We are not going to word it's definition and other theoretical thing, lets get in hand with example.

## **Theory:**

Let we have following dataset with minimum support of 0 and minimum confidence of 50%.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 1](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-1.png)

Support and confidence can be calculatable with following equations.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 2](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-2.png)

Let's get back to business, we need to calculate support of every item in dataset. In simple term how many time item get repeat in dataset.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 3](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-3.png)

compare support of every item with provided minimum support (2) that will be following set.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 4](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-3.png)

Now we need to make candidate set in simple term generate set of combination every item with each other and calculate it's support. Keep in mind it's a set so item cannot get repeated.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 5](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-5.png)

Again we have to compare support of each item with minim supper (2) so, it will become.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 6](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-6.png)

Again we have to make candidate set form upper set with three items and calculate its support.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 7](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-7.png)

Again we have to compare support of each item with minim supper (2) so, it will become.

![Apriori Algorithm Theory And Do It In Python- Data Mining In Python image 8](/assets/images/posts/apriori-algorithm-theory-and-do-it-in-python-data-mining-in-python/content-8.png)

New we report our previous steps to make candidate set form upper set but stop here because we unable to find new frequent items.

We have our most frequent items and we are ready to write our association rules. I will show you association rule for I1,I2,I3 you have to do it you own for I1,I3,I5

[I1 U I2] => [I3] = 2/4\*100=50%
[I1 U I3] => [I2] = 2/4\*100=50%
[I2 U I3] => [I1] = 2/4\*100=50%
[I1] => [I2 U I3] = 2/6\*100=33%
[I2] => [I1 U I3] = 2/7\*100=28%
[I3] => [I1 U I2] = 2/6\*100=33%

As our minimum confidence in 50% so fist 3 rules are strong and we can consider it.

## **Code:**

Let me share data set of 7500 transaction with different products, you can download it form [here](https://drive.google.com/file/d/1y5DYn0dGoSbC22xowBq2d4po6h1JxcTQ/view?usp=sharing).

[**store\_data.csv**
*Edit descript*](https://drive.google.com/file/d/1y5DYn0dGoSbC22xowBq2d4po6h1JxcTQ/view?usp=sharing "https://drive.google.com/file/d/1y5DYn0dGoSbC22xowBq2d4po6h1JxcTQ/view?usp=sharing")

We will use numpy, matplotlib, pandas and apriori libraries, all are so populer except [apriori](https://pypi.org/project/apyori/) with can be download for [here](https://pypi.org/project/apyori/).

[**apyori**
*Apyori is a simple implementation of Apriori algorithm with Python 2.7 and 3.3 - 3.5, provided as APIs and as...*pypi.org](https://pypi.org/project/apyori/ "https://pypi.org/project/apyori/")

**Import Libraries**

> import numpy as np
> import matplotlib.pyplot as plt
> import pandas as pd
> from apyori import apriori

**Read Dataset**

> store\_data = pd.read\_csv('D:\\Datasets\\store\_data.csv', header=None)

you can call head() to see how data look.

> store\_data.head()

**Data Preprocessing**

We need data in list so we can have more calculation on it.

> records = []
> for i in range(0, 7501):
>  records.append([str(store\_data.values[i,j]) for j in range(0, 20)])

**Applying Apriori**

We have discussed enough so, there is no need to explain.

> association\_rules = apriori(records, min\_support=0.0045, min\_confidence=0.2, min\_lift=3, min\_length=2)
> association\_results = list(association\_rules)

**Results**

> for item in association\_rules:

> *# first index of the inner list*
> *# Contains base item and add item*
> pair = item[0]
> items = [x for x in pair]
> print("Rule: " + items[0] + " -> " + items[1])

> *#second index of the inner list*
> print("Support: " + str(item[1]))

> *#third index of the list located at 0th*
> *#of the third index of the inner list*

> print("Confidence: " + str(item[2][0][2]))
> print("Lift: " + str(item[2][0][3])) print("=====================================")
