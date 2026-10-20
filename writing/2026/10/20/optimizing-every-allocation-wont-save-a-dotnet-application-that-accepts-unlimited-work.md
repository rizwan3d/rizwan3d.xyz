---
title: "Optimizing Every Allocation Won't Save a .NET Application That Accepts Unlimited Work"
slug: "optimizing-every-allocation-wont-save-a-dotnet-application-that-accepts-unlimited-work"
created: "2026-10-20"
updated: "2026-10-20"
category: "C#"
description: "Why backpressure, bounded concurrency, and admission control are essential for keeping C# and ASP.NET Core applications reliable under sustained load."
author: "Muhammad Rizwan"
tags: "C#, .NET, ASP.NET Core, Performance, Backpressure, Concurrency, System.Threading.Channels"
series: "Performance-Aware Programming in C#"
seriesSlug: "performance-aware-programming-in-csharp"
seriesPart: 4
featuredImageCreditUrl: "https://unsplash.com/@imgix"
featuredImageCredit: "Photo by imgix on Unsplash"
featuredImageAlt: "Rows of black server racks in a data center, representing server infrastructure and resource management"
featuredImage: "https://images.unsplash.com/photo-1506399558188-acca6f8cbf41?auto=format&fit=crop&w=1600&q=80"
featured: true
---

# Optimizing Every Allocation Won't Save a .NET Application That Accepts Unlimited Work

*Why understanding backpressure, bounded concurrency, and admission control is essential for building reliable C# and ASP.NET Core applications.*

As .NET developers, we spend a significant amount of time thinking about performance. We analyze garbage collection, reduce allocations, optimize LINQ queries, eliminate unnecessary boxing, and replace temporary arrays with more efficient memory abstractions. When profiling reveals excessive allocations, we reach for tools such as `Span<T>`, `Memory<T>`, and `ArrayPool<T>`. When throughput becomes a concern, we investigate asynchronous processing, thread pool behavior, and more efficient data structures.

These are valuable improvements. In a high-throughput ASP.NET Core application, reducing even a few allocations along a hot path can decrease garbage collection pressure and improve response times. But performance optimization has a limit that is easy to overlook: making each operation cheaper does not make the amount of work an application can accept infinite.

Imagine a background processing service that receives requests faster than its workers can complete them. At first, the application appears healthy. Requests are accepted, processing continues, and response times remain reasonable. Meanwhile, the queue of pending work is growing. Eventually, memory consumption increases, processing delays become unacceptable, and the application begins to struggle.

The natural reaction might be to investigate memory allocations. Developers could optimize job objects, pool buffers, or tune garbage collection. These changes might improve the situation temporarily, but they will not fix the fundamental problem.

**The application is accepting more work than it has the capacity to finish.**

This is where resource management becomes an architectural concern rather than a low-level optimization exercise.

## When pending work becomes the real memory problem

Consider an ASP.NET Core application responsible for generating reports. Clients submit requests, and the application places each report-generation job into an in-memory queue. A background service reads jobs from that queue and produces reports.

Suppose the application receives 1,000 jobs per second but can complete only 600. The difference is 400 additional jobs every second. If every incoming job is accepted, the backlog continues growing for as long as that imbalance persists.

We can express this relationship as:

\[
B(t)=(\lambda-\mu)t
\]

Here, \(\lambda\) represents the incoming work rate, \(\mu\) represents processing throughput, and \(t\) represents elapsed time. The equation assumes the arrival and completion rates remain approximately constant and that incoming work is not rejected.

After ten minutes, the application has accumulated:

\[
(1000-600)\times600=240,000
\]

That means 240,000 jobs remain pending. If each queued job retains approximately 16 KiB, those jobs alone occupy about 3.66 GiB of memory, excluding the queue's internal structures and other application overhead.

Now imagine reducing the memory retained by each job from 16 KiB to 4 KiB. That is an impressive 75% improvement, but it does not change the direction of the problem. The backlog still grows by 400 jobs every second.

Eventually, the smaller objects accumulate into another large memory requirement.

This is especially relevant to the .NET garbage collector. The GC can reclaim objects that are no longer reachable, but it cannot reclaim objects that an application intentionally retains in a queue. A pending job referenced by a channel is still a live object. It is not necessarily a memory leak, even though the application's memory consumption may continue increasing.

The correct question is therefore not only how much memory each job consumes, but why the application is allowed to retain an ever-growing number of jobs in the first place.

## Understanding what bounded channels actually do

`System.Threading.Channels` is one of the most useful abstractions for implementing asynchronous producer-consumer workloads in .NET. A channel provides a writer through which producers submit items and a reader through which consumers retrieve them.

An unbounded channel created with `Channel.CreateUnbounded<T>()` has no configured item-count limit. This can be appropriate when workload growth is controlled elsewhere, but it is dangerous to assume the channel itself will protect the application from overload.

A bounded channel introduces a capacity limit through `Channel.CreateBounded<T>()`. However, the precise behavior depends on how the writer interacts with the channel and which full mode has been configured.

This distinction is important because **a bounded channel is not automatically the same thing as backpressure**.

Consider a channel with capacity one and `BoundedChannelFullMode.Wait`. If the channel already contains an item, two different write operations behave differently.

Calling `TryWrite()` returns `false` immediately because the item cannot be written synchronously. Calling `WriteAsync()`, on the other hand, asynchronously waits for space to become available before completing the write.

The following complete console example demonstrates both behaviors.

### Runnable example: Channel backpressure semantics

Create a console application:

```bash
dotnet new console -n ChannelSemantics -f net8.0
cd ChannelSemantics
```

Replace `Program.cs` with:

```csharp
using System.Threading.Channels;

// A bounded channel containing at most one item.
var channel = Channel.CreateBounded<int>(
    new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.Wait
    });

// First write succeeds.
Console.WriteLine(
    channel.Writer.TryWrite(1)
); // True

// The channel is full.
Console.WriteLine(
    channel.Writer.TryWrite(2)
); // False

// WriteAsync cannot finish until space is available.
Task pendingWrite =
    channel.Writer.WriteAsync(2).AsTask();

Console.WriteLine(
    pendingWrite.IsCompleted
); // False

// Remove the first item.
channel.Reader.TryRead(out int first);

Console.WriteLine(first); // 1

// The waiting write can now complete.
await pendingWrite;

// Read the second item.
channel.Reader.TryRead(out int second);

Console.WriteLine(second); // 2


// Demonstrate DropWrite behavior.
var droppingChannel = Channel.CreateBounded<int>(
    new BoundedChannelOptions(1)
    {
        FullMode = BoundedChannelFullMode.DropWrite
    });

Console.WriteLine(
    droppingChannel.Writer.TryWrite(10)
); // True

Console.WriteLine(
    droppingChannel.Writer.TryWrite(20)
); // True, but item 20 is discarded.

droppingChannel.Reader.TryRead(
    out int remaining
);

Console.WriteLine(remaining); // 10
```

Run the application with:

```bash
dotnet run
```

The expected output is:

```text
True
False
False
1
2
True
True
10
```

The example reveals two aspects of channels that are frequently misunderstood.

The first is that `BoundedChannelFullMode.Wait` defines what should happen when the producer uses a waiting write operation. The full channel causes `WriteAsync()` to remain incomplete until capacity becomes available, which allows backpressure to propagate to a producer that awaits it.

`TryWrite()` deliberately avoids waiting. With this full mode, it returns `false` immediately when capacity is unavailable. That makes it useful for implementing fail-fast admission control, but the caller is rejecting work rather than slowing down and waiting for the channel.

The second subtlety concerns the drop modes. With `DropWrite`, `DropOldest`, or `DropNewest`, the channel does not impose waiting-based backpressure when full. Instead, it discards an item according to the selected policy. A successful `TryWrite()` does not necessarily mean that the item will be delivered to a consumer. In the `DropWrite` example, it returns `true` even though the second value is discarded.

This behavior means that drop modes are unsuitable as a general-purpose guarantee of job acceptance. They can be useful for telemetry, live updates, or other workloads where losing an item is acceptable, but they should not be confused with reliable job delivery.

There is another nuance worth understanding. `WaitToWriteAsync()` can notify a producer that writing may be possible, but it does not reserve a slot. When several producers are competing, another writer can fill the available space before the current producer calls `TryWrite()`. A correct implementation must account for that race, typically by retrying the wait-and-write sequence.

The broader lesson is that choosing a bounded channel is only the beginning. Developers must also decide whether producers should wait, whether work may be discarded, and whether an overloaded caller should receive an immediate rejection.

## Why waiting can be dangerous inside an HTTP endpoint

Suppose an ASP.NET Core endpoint accepts a job and uses `WriteAsync()` to place it into a bounded channel.

When the channel reaches capacity, the endpoint awaits available space. This is asynchronous waiting, so it does not necessarily block a thread pool thread. That is useful, but it does not mean waiting is free.

Each outstanding HTTP request can still retain objects associated with its execution. The runtime may need to preserve the request state, cancellation information, references to parsed input, and connection-related resources.

If thousands of clients submit requests while the channel remains full, thousands of request handlers may end up waiting for capacity. The channel's item count remains bounded, but the number of callers awaiting admission may not be bounded by the channel itself.

This creates an important distinction between controlling the queue and controlling the whole system.

For a trusted background producer, awaiting `WriteAsync()` can be an effective way to slow down production. The producer stops advancing when downstream consumers cannot keep up.

For an HTTP endpoint exposed to unpredictable traffic, waiting indefinitely may simply move the overload from the queue into the web server's pending requests.

In that situation, a more appropriate policy may be to attempt the write immediately and return a controlled error when capacity is exhausted.

That is not traditional waiting-based backpressure. It is **admission control**, and it is often exactly what an overloaded HTTP service needs.

## Building a bounded ASP.NET Core job-processing API

Let's turn this principle into a realistic ASP.NET Core example.

The application will accept HTTP requests containing small job payloads. A bounded channel will hold at most 100 waiting jobs, while four background workers process those jobs asynchronously. The endpoint will use `TryWrite()` so it never waits indefinitely for queue capacity.

We'll also add ASP.NET Core rate limiting and a request-body size limit, because bounding the job channel alone cannot control all resources consumed by incoming HTTP requests.

Create the project:

```bash
dotnet new web -n BoundedApi -f net8.0
cd BoundedApi
```

Replace the generated `Program.cs` with the following complete implementation.

### Program.cs

```csharp
using System.Threading.Channels;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Limit incoming HTTP request body sizes.
builder.WebHost.ConfigureKestrel(options =>
    options.Limits.MaxRequestBodySize = 16 * 1024);

// Register a shared queue and its background processor.
builder.Services.AddSingleton<JobQueue>();
builder.Services.AddHostedService<JobProcessor>();

// Apply a per-process submission rate limit.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode =
        StatusCodes.Status429TooManyRequests;

    options.AddFixedWindowLimiter(
        "submissions",
        limit =>
        {
            limit.PermitLimit = 200;
            limit.Window = TimeSpan.FromSeconds(1);
            limit.QueueLimit = 0;
            limit.AutoReplenishment = true;
        });
});

var app = builder.Build();

app.UseRouting();
app.UseRateLimiter();

app.MapPost(
    "/jobs",
    (JobRequest request, JobQueue queue) =>
        SubmitJob(request, queue))
    .RequireRateLimiting("submissions");

app.Run();


// HTTP request handler.
static IResult SubmitJob(
    JobRequest request,
    JobQueue queue)
{
    if (string.IsNullOrWhiteSpace(request.Payload) ||
        request.Payload.Length > 4096)
    {
        return Results.BadRequest(new
        {
            error = "Payload is empty or too long."
        });
    }

    var job = new Job(
        Guid.NewGuid(),
        request.Payload
    );

    if (!queue.TryEnqueue(job))
    {
        return Results.Problem(
            title: "Service at capacity",
            detail: "The queue is full. Retry later.",
            statusCode: StatusCodes
                .Status503ServiceUnavailable
        );
    }

    return Results.Accepted(value: new
    {
        jobId = job.Id,
        status = "queued"
    });
}


// Application models.
public sealed record JobRequest(string Payload);

public sealed record Job(
    Guid Id,
    string Payload
);


// Bounded job queue.
public sealed class JobQueue
{
    private readonly Channel<Job> _channel =
        Channel.CreateBounded<Job>(
            new BoundedChannelOptions(100)
            {
                FullMode = BoundedChannelFullMode.Wait,
                SingleReader = false,
                SingleWriter = false
            });

    public bool TryEnqueue(Job job)
    {
        return _channel.Writer.TryWrite(job);
    }

    public IAsyncEnumerable<Job> ReadAllAsync(
        CancellationToken cancellationToken)
    {
        return _channel.Reader.ReadAllAsync(
            cancellationToken
        );
    }
}


// Hosted background processing service.
public sealed class JobProcessor : BackgroundService
{
    private const int WorkerCount = 4;

    private readonly JobQueue _queue;
    private readonly ILogger<JobProcessor> _logger;

    public JobProcessor(
        JobQueue queue,
        ILogger<JobProcessor> logger)
    {
        _queue = queue;
        _logger = logger;
    }

    protected override Task ExecuteAsync(
        CancellationToken stoppingToken)
    {
        return Task.WhenAll(
            Enumerable.Range(0, WorkerCount)
                .Select(workerId =>
                    RunWorkerAsync(
                        workerId,
                        stoppingToken
                    ))
        );
    }

    private async Task RunWorkerAsync(
        int workerId,
        CancellationToken stoppingToken)
    {
        try
        {
            await foreach (
                var job in _queue.ReadAllAsync(stoppingToken))
            {
                try
                {
                    // Simulate asynchronous job processing.
                    await Task.Delay(
                        250,
                        stoppingToken
                    );

                    _logger.LogInformation(
                        "Worker {WorkerId} completed {JobId}",
                        workerId,
                        job.Id
                    );
                }
                catch (OperationCanceledException)
                    when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(
                        ex,
                        "Processing failed for {JobId}",
                        job.Id
                    );
                }
            }
        }
        catch (OperationCanceledException)
            when (stoppingToken.IsCancellationRequested)
        {
            // Normal shutdown cancellation.
        }
    }
}
```

### Running the application

Start the ASP.NET Core server:

```bash
dotnet run --urls http://localhost:5055
```

Then open another terminal and submit a job:

```bash
curl -i -X POST http://localhost:5055/jobs \
  -H "Content-Type: application/json" \
  -d '{"payload":"Generate monthly report"}'
```

Under normal conditions, the API returns HTTP `202 Accepted` with a response similar to:

```json
{
  "jobId": "d6c5820c-0b14-4cf2-980a-4e70c9c173c1",
  "status": "queued"
}
```

The background service subsequently processes the job and writes a log message.

Each simulated job takes approximately 250 milliseconds, and the application has four concurrent workers. Under ideal conditions, this produces a processing capacity of roughly 16 jobs per second.

The channel can hold 100 additional jobs waiting for processing. If incoming requests arrive substantially faster than the workers can complete them, that queue eventually fills.

At that point, `TryEnqueue()` returns `false`, and the endpoint responds with HTTP `503 Service Unavailable`.

Separately, if requests exceed the rate limiter's configured 200 permits per second, that limiter can return HTTP `429 Too Many Requests`. The fixed-window limit in this example is shared by requests handled by one application process; it is not a per-user limit.

These responses have different meanings. HTTP 429 indicates that the configured request rate has been exceeded, while HTTP 503 indicates that the service does not currently have capacity to accept additional work.

The important result is that an overloaded application can reject requests predictably instead of accepting an indefinitely growing backlog.

### Why the implementation is bounded

The queue is registered as a singleton, so the HTTP endpoint and background processing service use the same channel instance.

The channel is configured with `BoundedChannelFullMode.Wait`, but the endpoint uses `TryWrite()` rather than `WriteAsync()`. Consequently, requests are not suspended waiting for a queue slot. When the queue is full, the handler returns immediately with an error.

Meanwhile, `BackgroundService` runs four independent consumer loops through `Task.WhenAll()`. Each loop reads jobs from the shared channel and processes one job at a time. The channel supports multiple consumers because `SingleReader` is set to `false`.

There are therefore two explicit workload limits: 100 waiting items in the channel and four jobs actively processed by the workers. These limits do not bound every resource involved in HTTP request handling, but they prevent the background workload itself from growing without an explicit limit.

The rate limiter and request-body size restriction add further protection at the incoming request boundary.

This is a small example, but it demonstrates a much stronger design than placing every incoming job into an unlimited collection and hoping that memory optimization will compensate for sustained overload.

## Why a bounded queue still doesn't make the whole application safe

It would be tempting to stop after introducing a bounded channel. The queue now has a limit, the workers have a limit, and requests are rejected when capacity is unavailable.

But the queue is only one part of the application.

The HTTP server still accepts connections and must perform some work before the endpoint can decide whether a job should be admitted. Request parsing, JSON deserialization, routing, authentication, and other middleware components may consume resources.

This is why the example includes a request-body limit. Without one, a client could potentially send an oversized payload that consumes substantial resources before the application reaches its job queue.

Similarly, a bounded channel limits item count, not total memory consumption. If 100 queued jobs each retain a few kilobytes, memory consumption may be modest. If each job retains hundreds of megabytes, the same queue capacity becomes far more expensive.

Production systems dealing with variable-size jobs may need to enforce both an item-count limit and an aggregate memory or byte budget.

The problem also extends to downstream services. Imagine replacing the simulated delay with a database operation. Four concurrent workers might be completely acceptable for one database, while several application replicas collectively executing hundreds of expensive database operations could overwhelm another.

A semaphore or an ASP.NET Core concurrency limiter can restrict active operations, but these controls must be applied with an understanding of the complete workload. `SemaphoreSlim.WaitAsync()` limits execution concurrency, yet callers can still accumulate while waiting for permits. The waiting operations themselves may become another source of resource pressure.

Likewise, autoscaling is not a substitute for admission control. Adding application instances increases processing capacity, but it does not automatically expand database connection budgets, external API quotas, or network capacity. Under certain conditions, scaling the application can actually increase pressure on an already overloaded dependency.

Reliable capacity management therefore requires boundaries at more than one level. The ingress layer controls incoming demand, the queue controls pending work, worker concurrency controls active execution, and downstream limits protect shared dependencies.

## What the example doesn't guarantee

The application above is runnable as an educational example, but it deliberately uses an in-memory queue.

When the endpoint returns HTTP 202, it means the process has accepted the job into memory. It does not mean the work has finished, and it does not guarantee that the job will survive a process crash.

If the application terminates while jobs are still queued, those jobs may be lost. The background worker also logs job-processing failures without implementing a retry or recovery policy, so a failed job is not automatically executed again.

For applications processing financial transactions, customer orders, or other critical operations, those limitations would be unacceptable.

Such systems typically require durable job storage or a reliable message broker, carefully designed acknowledgements, bounded retries, and idempotent processing. The goal is to preserve the meaning of accepted work even when workers restart or fail.

Graceful shutdown also deserves attention. The example passes the host's cancellation token into its consumers, allowing processing to stop when the application shuts down. It does not attempt to drain every queued job before exiting. In a production job system, shutdown behavior should be consistent with the durability and delivery guarantees promised to clients.

A further complication appears when the application runs across multiple instances. Each instance in this example has its own queue capacity of 100 and its own four workers. Five replicas could therefore hold up to 500 queued jobs and process up to 20 jobs concurrently across their workers, subject to runtime and infrastructure limits. Those limits are not automatically coordinated globally.

This is another reason why capacity planning belongs at the architecture level rather than only inside individual classes.

## Measuring overload instead of waiting for memory exhaustion

One of the most useful changes developers can make is to stop treating memory usage as the only indicator of application health.

A growing queue can signal overload long before the process approaches its memory limit. Queue waiting time is especially revealing because it shows how long work is delayed before processing even begins.

Imagine two versions of the same service. Both consume approximately 500 MB of memory, and both have moderate CPU utilization. In the first service, the queue contains only a few jobs and usually clears immediately. In the second service, the queue remains nearly full, and new jobs wait several seconds before a worker becomes available.

The services may look similar on a basic infrastructure dashboard, but their operational health is very different.

For a .NET background processing system, useful measurements include incoming job rate, completed job rate, queued item count, queue waiting time, active worker count, and rejected submissions. ASP.NET Core response latency and the rate of HTTP 429 and 503 responses provide additional context.

`System.Diagnostics.Metrics` can expose application-level counters and histograms, while OpenTelemetry can collect and export those measurements.

The key observation is the relationship between demand and completion rate. If incoming work consistently exceeds completed work, a system without admission control will accumulate a backlog. With bounded admission, that imbalance becomes visible as increasing queue pressure and eventually as controlled rejections.

This is much easier to operate than a system that continues silently accepting work until the runtime reaches a resource limit.

Load testing should follow the same principle. Rather than measuring only the maximum throughput achieved under favorable conditions, developers should deliberately test what happens when demand exceeds that throughput.

A resilient system should maintain bounded queues, predictable concurrency, and controlled overload responses. When traffic returns to normal, the system should recover without having to process an impossibly large backlog first.

## Performance optimization and admission control solve different problems

None of this makes allocation optimization unimportant.

Reducing temporary allocations can improve garbage collection behavior. Buffer pooling can reduce repeated memory allocation costs. Efficient serialization can lower CPU usage. Better algorithms can increase the rate at which workers complete jobs.

All of these improvements can increase sustainable throughput.

However, capacity is always finite.

If optimization increases processing capacity from 600 jobs per second to 1,200 jobs per second, the application can handle much more traffic. That is a meaningful result. But if incoming demand later reaches 2,000 jobs per second, the same architectural problem returns.

Without a mechanism to limit incoming work, the backlog begins growing again.

This is the essential difference between performance engineering and resource safety. Performance engineering attempts to reduce the resources required for each operation. Resource safety ensures that the total amount of accepted work remains manageable within the available resources.

The strongest systems combine both approaches.

They make individual operations efficient while also establishing deliberate boundaries around request rates, queue sizes, execution concurrency, waiting time, and downstream capacity.

## Conclusion

There is a point in software engineering where improving individual operations is no longer enough.

An ASP.NET Core application can use efficient algorithms, carefully optimized data structures, pooled buffers, and low-allocation APIs while still being fundamentally unsafe under sustained overload.

The reason is simple: every machine has finite resources, and every service has a finite rate at which it can complete work.

When producers consistently generate work faster than consumers can process it, the system must respond deliberately. It can apply backpressure to cooperative producers, reject requests when capacity is exhausted, or use other well-defined workload policies.

What it cannot safely do forever is accept everything without establishing a limit.

`System.Threading.Channels` gives .NET developers useful tools for implementing those boundaries, but understanding its semantics matters. `WriteAsync()` with `BoundedChannelFullMode.Wait` can propagate asynchronous backpressure. `TryWrite()` with that same mode supports immediate admission decisions. Drop modes introduce entirely different behavior and must be chosen only when their loss semantics are acceptable.

These details are not minor implementation choices. They influence whether an application slows down predictably, rejects overload safely, silently loses data, or accumulates work until a resource is exhausted.

The larger lesson extends beyond channels and even beyond .NET.

**A system is not reliable merely because it processes each request efficiently. It is reliable when it can also control how much work it accepts.**

Optimizing allocations makes an application more efficient. Bounded workloads, backpressure, and admission control make that efficiency sustainable.

Because ultimately, **optimizing every allocation won't save a .NET application that accepts unlimited work.**

---

### Technical references

- [Microsoft Learn - System.Threading.Channels](https://learn.microsoft.com/en-us/dotnet/core/extensions/channels)
- [Microsoft Learn - Background tasks with hosted services](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/host/hosted-services)
- [Microsoft Learn - ASP.NET Core rate limiting](https://learn.microsoft.com/en-us/aspnet/core/performance/rate-limit)
- [Microsoft .NET Blog - An Introduction to System.Threading.Channels](https://devblogs.microsoft.com/dotnet/an-introduction-to-system-threading-channels/)
