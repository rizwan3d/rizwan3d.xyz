---
title: "Get rid of If-Else - Strategy Design Pattern"
slug: "get-rid-of-if-else-strategy-design-pattern"
created: "2022-06-27"
updated: "2022-06-27"
category: "software-engineering"
description: "Replacing multiple if-else conditions with a Dictionary (Hash Map) in C#, and how this resembles the Strategy Design Pattern."
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d/get-rid-of-if-else-strategy-design-pattern-9f229b3db703"
canonicalUrl: "https://medium.com/@rizwan3d/get-rid-of-if-else-strategy-design-pattern-9f229b3db703"
originalTitle: "Get rid of If-Else - Strategy Design Pattern"
originalPublished: "2022-06-27"
author: "Muhammad Rizwan"
tags: "design-patterns, strategy, strategy-design-pattern, csharp, software-engineering"
featuredImage: ""
sourceImageCredit: ""
sourceImageCreditUrl: ""
importMethod: "medium-article-original-user-provided"
importedAt: "2026-10-08"
featured: true
---

# Get rid of If-Else - Strategy Design Pattern

Most of the time we have multiple if else to do work based on string, number or a enum that can be replaceable with Dictionary (Hash Map in other term). this method is look a like strategy design Pattern.

Examples are in C# but you do it in any language.

let suppose you code look like

```csharp
void performAction(string actionName) {
    if (actionName == "delete") {
        delete();
    } else if (actionName == "edit") {
        edit();
    } else if (actionName == "add") {
        add();
    }
}
```

this one can be replace with this one

```csharp
class Action
{
    var strategy = new Dictionary<string, Delegate>();

    Action()
    {
        dico["delete"] = new Func<int>(delete);
        dico["edit"] = new Func<int>(edit);
        dico["add"] = new Func<dynamic>(add);
    }

    public dynamic performAction(string actionName,dynamic data = null){

        if(strategy.ContainsKey(actionName)){
            return strategy[actionName].DynamicInvoke(data);
        }

        throw new InvalidOperationException("Action cannot exit");
    }

    private bool delete(int id)
    {
        return true;
    }

    private bool edit(int id)
    {
        return true;
    }

    private bool add(dynamic data)
    {
        return true;
    }
}
```
## Why this method?

* It make code more clear and readable

* It implement SOLID principles such as Single responsibility.

* System is open to extendibility rather than modification (Open/Close Principle).

## Strategy Design Pattern

Actual design pattern can be implement based on abstraction using interfaces I will write another Article on Strategy Design Pattern.
