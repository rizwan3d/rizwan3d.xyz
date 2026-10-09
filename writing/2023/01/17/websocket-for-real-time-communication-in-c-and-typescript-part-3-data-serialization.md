---
title: "WebSocket for real-time communication in C# and Typescript - Part 3 (Data Serialization)"
slug: "websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization"
created: "2023-01-17"
updated: "2023-01-17"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication-b719981ba14f"
canonicalUrl: "https://medium.com/@rizwan3d/websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication-b719981ba14f"
originalTitle: "WebSocket for real-time communication in C# and Typescript - Part 3 (Data Serialization)"
originalPublished: "2023-01-17"
author: "Muhammad Rizwan"
tags: ""
series: "WebSocket for real-time communication in C# and Typescript"
seriesSlug: "websocket-for-real-time-communication-in-c-and-typescript"
seriesPart: 3
featuredImage: "/assets/images/posts/websocket-for-real-time-communication-in-c-and-typescript-part-3-data-serialization/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "WebSocket for real-time communication in C# and Typescript - Part 3 (Data Serialization)"
featuredImageCredit: "Photo by Markus Spiske on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@markusspiske"
---

## WebSocket for real-time communication in C# and Typescript - Part 3 (Data Serialization)

In our previous blog we added [Authentication](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-2-authentication.html) now we will add Data Serialization.
To add data serialization to the WebSocket server and client, you can use a library that supports a particular data serialization format, such as JSON or Protocol Buffers.

Here's an example of how you could modify the previous C# WebSocket server code to use JSON for data serialization:

In this example, the server is using the Newtonsoft.Json library to serialize and deserialize the data. On the client side, you can use `JSON.stringify()` and `JSON.parse()` to serialize and deserialize the data.

You can also use `Protocol Buffers` to Serialize the data, it is a language and platform-neutral data serialization format that can be more compact and efficient than JSON. But it requires additional setup and tooling to use. You need to define the message structure, then use a protobuf compiler to generate the appropriate serialization code for your server and client. You also need to install the protobuf library for C# or TypeScript.

In summary, serializing data before sending it over the WebSocket connection can make it easier to work with complex data structures and also it allows for more efficient data transmission. JSON and Protocol Buffers are two popular choices for data serialization, but you can also use other formats such as BSON, CBOR, or Avro. It depends on your needs and the characteristics of your application.

In next part we add [Security](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-4-security.html) and [scalability](/posts/websocket-for-real-time-communication-in-c-and-typescript-part-5-scaling-apache-kafka.html).
