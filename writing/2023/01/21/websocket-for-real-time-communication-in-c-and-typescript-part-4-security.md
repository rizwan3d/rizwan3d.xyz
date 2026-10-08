---
title: "WebSocket for real-time communication in C# and Typescript - Part 4 (Security)"
slug: "websocket-for-real-time-communication-in-c-and-typescript-part-4-security"
created: "2023-01-21"
updated: "2023-01-21"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization-c4ada68864e7"
canonicalUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization-c4ada68864e7"
originalTitle: "WebSocket for real-time communication in C# and Typescript - Part 4 (Security)"
originalPublished: "2023-01-21"
author: "Muhammad Rizwan"
tags: ""
featuredImage: ""
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
---

### WebSocket for real-time communication in C# and Typescript - Part 4 (Security)

In our previous blog we added [Data Serialization](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization-c4ada68864e7) now we will add [Security](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-5-scaling-apache-kafka-5f1f4cb786cd).

Adding security to a WebSocket connection can help to protect against potential attacks and keep your data safe. Here are a few ways you could secure your WebSocket server and client:

- SSL/TLS: One of the most important steps to securing a WebSocket connection is to use SSL/TLS encryption. This will encrypt the data being sent over the connection and prevent eavesdropping or tampering. You should use a valid certificate from a trusted certificate authority (CA) to ensure that the connection is secure.
- Origin validation: To prevent cross-site scripting (XSS) attacks, you should validate the origin of WebSocket connections on the server. You can do this by checking the `Origin` header in the WebSocket request and only accepting connections from trusted origins.
- Content-Security-Policy: The Content-Security-Policy (CSP) header is used to help prevent cross-site scripting (XSS) and other code injection attacks by specifying the sources from which a browser should load resources for a page. By setting the appropriate CSP headers on the server, you can restrict the types of resources that can be loaded by the client and reduce the risk of XSS attacks.
- HttpOnly and Secure flags on Cookies: To prevent cross-site request forgery (CSRF) attacks, you should use the HttpOnly and Secure flags on any cookies associated with your WebSocket connection. This will ensure that the cookies cannot be accessed by client-side scripts and will only be sent over an encrypted connection.
- WebSocket Secure: To further secure the WebSocket connection you could use WebSocket Secure (WSS) protocol instead of WS, this is a secure version of the WebSocket protocol that uses SSL/TLS to encrypt the data being sent over the connection.

### Origin validation

One way to add origin validation to a WebSocket server is to check the `Origin` header in the WebSocket request and only accept connections from trusted origins. Here's an example of how you could modify the previous C# WebSocket server code to include origin validation:

In this example, the server is checking for the presence of an "Origin" header in the WebSocket request and comparing it to a list of trusted origins. If the origin is in the list of trusted origins, the server will proceed with accepting the WebSocket connection and starting a new task to handle the socket. If the origin is not in the list of trusted origins, the server will respond with a 403 Forbidden status code and close the connection.

You can also use a whitelist of allowed origins, this approach is more secure but requires more maintenance.

It's worth noting that the browser may include an `Origin` header even if the WebSocket connection was initiated from a file (e.g. `file://`), in that case the origin validation could fail, and you would need to handle that case accordingly.

### Content-Security-Policy

Content-Security-Policy (CSP) is a security feature that helps to protect against cross-site scripting (XSS) and other code injection attacks by specifying the sources from which a browser should load resources for a page. By setting the appropriate CSP headers on the server, you can restrict the types of resources that can be loaded by the client and reduce the risk of XSS attacks.

Here's an example of how you could add a CSP header to the previous C# WebSocket server code:

In this example, the server is adding a `Content-Security-Policy` header to the response with a value of `"default-src 'self'"`. This CSP header is telling the browser to only load resources from the same origin as the page, which can help to prevent XSS attacks by limiting the sources of scripts and other resources that can be loaded by the client.

It's worth noting that the right value for the CSP header will depend on your application requirements and the resources that it needs to load. You can use different values that restrict the resources that can be loaded by the client and you can also use different sources like 'none', 'self', 'unsafe-inline', 'data:' and more.

It's also worth noting that CSP is just one aspect of web application security and it should not be relied on as the sole security measure. It's important to also take other steps to secure your application, such as validating user

In next part we add [scalability](https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-5-scaling-apache-kafka-5f1f4cb786cd).
