---
title: "Performance-Aware Programming in C#"
slug: "performance-aware-programming-in-csharp"
created: "2026-10-09"
updated: "2026-10-09"
category: "C#"
description: "A practical guide to writing faster C# by measuring real bottlenecks, choosing the right collections, reducing allocations, and keeping readable code."
author: "Muhammad Rizwan"
tags: "C#, .NET, Performance, Benchmarking"
featuredImageCreditUrl: "https://unsplash.com/@marcojodoin"
featuredImageCredit: "Photo by Marc-Olivier Jodoin on Unsplash"
featuredImageAlt: "long exposure photography of road and cars"
featuredImage: "https://images.unsplash.com/photo-1498084393753-b411b2d26b34"
featured: true
---

# Performance-Aware Programming in C#

Fast code starts with knowing what is slow. A `foreach` loop is not a problem just because it runs a thousand times. A database call inside that loop probably is. The point of performance-aware programming is to spot costs that matter, measure them, and fix them without making the code hard to read.

## Measure the right thing

Pick a metric before editing code. For an API, track p95 request latency and requests per second. For an importer, track total run time, rows processed, and peak memory. Run the workload with data that looks like production data.

Use `dotnet-counters` to inspect runtime counters, a profiler to locate CPU and allocation hot spots, and BenchmarkDotNet for small comparisons. A microbenchmark tells you which method wins in isolation. It does not prove that the whole service gets faster.

## Use the collection that matches the work

Here's a membership check in a hot loop:

```csharp
List<int> allowedIds = LoadAllowedIds();

foreach (int id in incomingIds)
{
    if (allowedIds.Contains(id))
        Process(id);
}
```

`List<T>.Contains` scans until it finds a match. With a large list and many lookups, that work adds up. Build a set once if the same IDs are checked repeatedly:

```csharp
HashSet<int> allowedIds = LoadAllowedIds().ToHashSet();

foreach (int id in incomingIds)
{
    if (allowedIds.Contains(id))
        Process(id);
}
```

A hash set uses extra memory and takes time to build. Don't convert a tiny list just for one lookup. Measure the whole operation, including set creation.

## Stop building the same string over and over

This loop repeatedly creates a bigger string:

```csharp
string output = "";
foreach (var row in rows)
    output += row.Name + "\n";
```

For a long report, use `StringBuilder`:

```csharp
var builder = new StringBuilder();
foreach (var row in rows)
    builder.AppendLine(row.Name);

string output = builder.ToString();
```

Add `using System.Text;` for this example. For two short strings, ordinary concatenation is fine. The repeated growth is what makes the first loop expensive.

## Parse without allocating a substring

When you only need to read part of a string, a span can avoid a second string:

```csharp
string line = "ORDER:12345";
ReadOnlySpan<char> idText = line.AsSpan("ORDER:".Length);

if (int.TryParse(idText, out int orderId))
    ProcessOrder(orderId);
```

`AsSpan` views the characters already in `line`. It doesn't copy them. This matters in parsers that run on lots of records. A span is a short-lived view, not a field you can store on a normal class.

## Don't confuse async with faster computation

An HTTP request spends much of its time waiting for a response. Use the asynchronous API so the waiting request doesn't block a thread:

```csharp
public static Task<string> FetchAsync(
    HttpClient client,
    Uri address,
    CancellationToken cancellationToken)
{
    return client.GetStringAsync(address, cancellationToken);
}
```

This improves how a server handles concurrent waits. It doesn't speed up the remote endpoint. Avoid `.Result` and `.Wait()` in request code; they block threads and can cause throughput problems.

For CPU-bound work, `async` alone changes nothing. First identify the expensive calculation. Then decide whether parallel work makes sense for the amount of data and available cores.

## Query fewer rows and columns

A fast C# loop can't rescue a query that downloads the entire customer table just to show twenty names:

```csharp
var names = await db.Customers
    .AsNoTracking()
    .Where(c => c.IsActive)
    .OrderBy(c => c.Id)
    .Select(c => c.Name)
    .Take(20)
    .ToListAsync(cancellationToken);
```

This projects one column, limits the result, and skips entity tracking for a read-only request. Check the generated SQL and database query plan before adding indexes. If you page through records, use stable ordering and measure deeper pages too.

## Watch allocations, not just elapsed time

An allocation is not automatically bad. Replacing a simple object with a complicated pool can make the code worse. Check allocation rates and garbage-collection activity first.

For reusable temporary byte buffers, `ArrayPool<byte>` is available:

```csharp
byte[] rented = ArrayPool<byte>.Shared.Rent(4096);
try
{
    Span<byte> buffer = rented.AsSpan(0, 4096);
    FillBuffer(buffer);
    ConsumeBuffer(buffer);
}
finally
{
    ArrayPool<byte>.Shared.Return(rented);
}
```

Add `using System.Buffers;`. `Rent` can return a larger array than requested, so use the slice you actually need. Don't touch the array after returning it. Pools also reuse old contents; clear sensitive data when the application requires it.

## Be careful with structs and stack memory

A small `readonly struct` works well for a value such as a pair of coordinates. A large struct copied through several methods can be slower than passing a reference. The stack-versus-heap rule people quote for `struct` and `class` is too simple; storage depends on the context.

`stackalloc` is useful for a small, fixed-size scratch buffer:

```csharp
Span<byte> header = stackalloc byte[16];
header.Clear();
```

Don't size stack allocations from untrusted input. Stack space is limited, and oversized allocations can crash a process.

## Don't rewrite LINQ without proof

This reads clearly:

```csharp
int total = numbers.Where(x => x > 0).Sum();
```

A plain loop can reduce iterator or delegate overhead in a hot path:

```csharp
int total = 0;
foreach (int number in numbers)
{
    if (number > 0)
        total = checked(total + number);
}
```

Both examples use checked arithmetic for integer summation and throw an `OverflowException` if the total exceeds the `int` range. Their performance can differ depending on the collection type, .NET version, and input size. Benchmark with real workloads before replacing the LINQ code.

## Let the JIT do its job

The .NET JIT already inlines eligible methods and removes some redundant checks. Tiered compilation and profile-guided optimization can change the code produced for frequently used paths. A hand-written trick that beat an old runtime can lose on a newer one.

Benchmark in Release mode against the runtime you deploy. Keep the readable implementation when the difference falls inside measurement noise.

## A short checklist for a real optimization

1. Write down the slow operation and the metric you want to change.
2. Record a baseline with representative inputs.
3. Profile to find the code or query spending the time.
4. Change one thing, then run correctness tests.
5. Measure again. Include memory, throughput, and tail latency when relevant.
6. Keep the change only if its benefit is worth the maintenance cost.

That's performance-aware C#: not clever code everywhere, just fewer expensive surprises where the application actually spends its time.

## References

- [Microsoft: .NET diagnostics](https://learn.microsoft.com/dotnet/core/diagnostics/)
- [Microsoft: ASP.NET Core performance best practices](https://learn.microsoft.com/aspnet/core/performance/performance-best-practices)
- [BenchmarkDotNet](https://benchmarkdotnet.org/)
