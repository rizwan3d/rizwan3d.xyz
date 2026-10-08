---
title: "WebSocket for real-time communication in C# and Typescript - Part 2 (Authentication)"
slug: "websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication"
created: "2023-01-14"
updated: "2023-01-14"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-1-connection-51e17c9090ca]"
canonicalUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-1-connection-51e17c9090ca]"
originalTitle: "WebSocket for real-time communication in C# and Typescript - Part 2 (Authentication)"
originalPublished: "2023-01-14"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "WebSocket for real-time communication in C# and Typescript - Part 2 (Authentication)"
featuredImageCredit: "Photo by Markus Spiske on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@markusspiske"
---

### WebSocket for real-time communication in C# and Typescript - Part 2 (Authentication)

This one extraction to previous work, first look a [part 1.](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-1-connection-51e17c9090ca])

There are several ways to add authentication to a WebSocket server, but one common approach is to use JSON Web Tokens (JWT). With this approach, the client would need to obtain a JWT from an authentication server, and then send the JWT in the WebSocket request to the server. The server can then verify the JWT and authenticate the client.

Here's an example of how you could modify the previous C# WebSocket server code to include JWT-based authentication:

In this example, the server is checking for the presence of an "Authorization" header in the WebSocket request. If the header is present and starts with "Bearer ", the server will attempt to parse the JWT from the header value and validate it. If the JWT is valid, the server will proceed with accepting the WebSocket connection and starting a new task to handle the socket. If the JWT is not present or is invalid, the server will respond with a 401 Unauthorized or 403 Forbidden status code and close the connection.

As for the client-side, the client should obtain a JWT from an authentication server and then include the JWT in the "Authorization" header of the WebSocket request.

In this example, the client is using the `jsonwebtoken` library to generate a JWT, which is then included in the headers of the WebSocket request.

Please keep in mind that, JWT validation/generation should be done securely, and JWT Secret should be kept private, also you can use different libraries and approaches that fits your use case.

In next part we add [Data Serialization](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization-c4ada68864e7), [Security](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-4-security-8fe63b0763a8) and [scalability](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-5-scaling-apache-kafka-5f1f4cb786cd).
