---
title: "WebSocket for real-time communication in C# and Typescript - Part 1 (Connection)"
slug: "websocket-for-real-time-communication-in-c-and-typescript-part-1-connection"
created: "2023-01-12"
updated: "2023-01-12"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: ""
originalTitle: "WebSocket for real-time communication in C# and Typescript - Part 1 (Connection)"
originalPublished: "2023-01-12"
author: "Muhammad Rizwan"
tags: ""
series: "WebSocket for real-time communication in C# and Typescript"
seriesSlug: "websocket-for-real-time-communication-in-c-and-typescript"
seriesPart: 1
featuredImage: "/assets/images/posts/websocket-for-real-time-communication-in-c-and-typescript-part-1-connection/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "WebSocket for real-time communication in C# and Typescript - Part 1 (Connection)"
featuredImageCredit: "Photo by Christopher Robin Ebbinghaus on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@cebbinghaus"
---

## WebSocket for real-time communication in C# and Typescript - Part 1 (Connection)

WebSockets are a protocol for bi-directional, real-time communication between clients and servers over the web. They allow a browser or other client to establish a connection to a server and maintain that connection open for real-time communication. This can be useful for a wide range of applications, such as real-time chat, multiplayer games, and live data updates.

Here's an example of a WebSocket server written in C# using the `System.Net.WebSockets` namespace:

The above server creates an instance of `HttpListener` and listens on the `http://localhost:8080/` URL. When a client connects, it checks if the request is a WebSocket request, and if so, it accepts the WebSocket connection and starts a new task to handle the socket. The task uses a loop to wait for messages from the client and sends a response back to the client.

And here is an example of a client written in TypeScript using the `ws` library:

This client creates a new instance of `WebSocket` and connects to the server at "ws://localhost:8080/". It sets up event handlers for the `onopen`, `onmessage`, `onclose`, and `onerror` events to handle different aspects of the WebSocket communication. When the connection is opened, the `onopen` event is triggered and the client sends a message to the server with the `send()` method. When the server sends a message back, the `onmessage` event is triggered and the message is logged to the console. If the connection is closed or an error occurs, the appropriate event handlers will be called to log the event to the console.

Please Note that the above code is just an example, and you need to handle the connection and message sending/receiving based on your needs.

In next part we add [Authentication](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication.html), [Data Serialization](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization.html), [Security](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-4-security.html) and [scalability](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-5-scaling-apache-kafka.html).
