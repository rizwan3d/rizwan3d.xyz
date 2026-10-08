---
title: "Hello SDL: Your First Graphics Window C#"
slug: "hello-sdl-your-first-graphics-window-c"
created: "2017-06-17"
updated: "2017-06-17"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Hello SDL: Your First Graphics Window C#"
originalPublished: "2017-06-17"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/hello-sdl-your-first-graphics-window-c/featured.png"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Hello SDL: Your First Graphics Window C#"
---

first we have to download SDL form GitHub and add dll in reference. add some required namespaces SDL as shown blow.

---

### Hello SDL: Your First Graphics Window C#

first we have to download [SDL](https://github.com/flibitijibibo/SDL2-CS) form [GitHub](https://github.com/flibitijibibo/SDL2-CS) and add dll in reference. add some required namespaces SDL as shown blow.

needed now [IntPtr](https://msdn.microsoft.com/en-us/library/system.intptr%28v=vs.110%29.aspx) to store address of window and Surface.

public IntPtr \_Window; // pointer for SDL window

public IntPtr \_Surface; // ponter for surface

A SDL surface is just a 2D image. A 2D image can be loaded from a file or it can be the image inside of a window. In this case it will be the image we see inside of the window on the screen. After declaring our window and screen surface, we initialize SDL. You can't call any SDL functions without initializing SDL first. Since all we care about is using SDL's video subsystem, we will only be passing it the SDL\_INIT\_VIDEO flag.

SDL\_Init(SDL\_INIT\_VIDEO) is use to init the sdl and it return -1 if it fail so use use like this.

if (SDL\_Init(SDL\_INIT\_VIDEO | SDL\_INIT\_AUDIO) < 0)

throw (new InvalidOperationException("Error occurred while initializing SDL"));

now it's time to create a window.If SDL initialized successfully, we'll want to create a window using SDL\_CreateWindow. The first argument sets the window's caption or this part of the window: The next two arguments define the x and y position the window is created in. Since we don't care where it is created, we just put SDL\_WINDOWPOS\_UNDEFINED for the x and y position.

The next two arguments define the window's width and height. The last argument are the creation flags. SDL\_WINDOW\_SHOWN makes sure the window is shown when it is created.

If there is an error, SDL\_CreateWindow returns NULL. If there's no window, we want to throw exception.

// if succeeded create our window

\_Window = SDL\_CreateWindow("title of window", SDL\_WINDOWPOS\_CENTERED,

SDL\_WINDOWPOS\_CENTERED,600,800, SDL\_WindowFlags.SDL\_WINDOW\_SHOWN);

// if the window creation succeeded create our renderer

if (\_Window == null || \_Window == IntPtr.Zero)

throw (new InvalidOperationException("Error occurred while initializing Window"));

If the window was created successfully, we want to get the window's surface so we can draw to it. SDL\_GetWindowSurface does just this.To keep this tutorial simple, all we're going to do here is fill the window's surface white using SDL\_FillRect. Don't worry too much about this function here. This tutorial is only concerned about getting a window to pop up. An important thing to know about rendering is that just because you've drawn something to the screen surface doesn't mean you'll see it. After you've done all your drawing you need to update the window so it shows everything you drew. A call to SDL\_UpdateWindowSurface will do this. If all we do is create the window, fill it, and update it, all we're going to see is a window flash for a second and then close. To keep it from disappearing, we'll call SDL\_Delay. SDL\_Delay will wait for a given amount of milliseconds. A millisecond is 1/1000 of a second. This means the code above will make the window wait for 2000 1/1000 of a second or 2 seconds. An important thing to note is that when SDL is delaying, it cannot accept input from the keyboard or mouse. Don't panic when you run this program and it doesn't respond. We haven't given it the code to handle the mouse and keyboard.

screenSurface = SDL\_GetWindowSurface( window );

SDL\_FillRect( screenSurface, NULL, SDL\_MapRGB( screenSurface->format, 0xFF, 0xFF, 0xFF ) );

SDL\_UpdateWindowSurface( window );

After the window has delayed there for 2 seconds, we'll destroy the window to free its memory. This will also take care of the SDL\_Surface we got from it. After everything is deallocated, we quit SDL and return 0 to terminate the program.

SDL\_DestroyWindow( window );

reference:
 [Lazy Foo SDL tutorial](http://lazyfoo.net/tutorials/SDL/01_hello_SDL/index2.php)
