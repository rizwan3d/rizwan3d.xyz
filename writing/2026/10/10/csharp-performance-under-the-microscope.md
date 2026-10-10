---
title: "C# Performance Under the Microscope: JIT, Memory, and a Benchmark That Can Fail"
slug: "csharp-performance-under-the-microscope-jit-memory-and-a-benchmark-that-can-fail"
description: "A reproducible .NET 10 investigation of List vs HashSet lookups, setup costs, allocations, JIT assembly, CPU caches, and production profiling."
author: "Muhammad Rizwan"
category: "C#"
created: "2026-10-10"
updated: "2026-10-10"
tags: "csharp, dotnet, performance, benchmarking, jit, garbage-collection"
series: "Performance-Aware Programming in C#"
seriesSlug: "performance-aware-programming-in-csharp"
seriesPart: 2
sourceUrl: "https://github.com/rizwan3d/CSharpPerformanceSuite"
featuredImageCreditUrl: "https://unsplash.com/@julianhochgesang"
featuredImageCredit: "Photo by Julian Hochgesang on Unsplash"
featuredImageAlt: "Time lapse photography of vehicles"
featuredImage: "https://images.unsplash.com/photo-1578991132108-16c5296b63dc?auto=format&fit=crop&w=1600&q=80"
featured: true
---
*The fastest-looking change isn't always the fastest change. Here's how to test that claim instead of repeating it.*

A performance problem rarely announces itself as a slow algorithm. Sometimes it's an innocent `Contains` inside a loop. Other times, an allocation looks too small to matter until the service performs it thousands of times per second.

The usual advice is familiar: use a `HashSet<T>` for membership tests, avoid allocations, consider structs, and let the JIT do its work. None of that is entirely wrong. It just skips the difficult question: **what actually gets faster in the workload we're running?**

We'll examine a transaction-processing method, test three implementations, and then look below the C# source at allocations, generated machine code, CPU memory access, and application-level traces. The results reveal two different kinds of failed optimization: rebuilding a hash set can erase its lookup advantage, and a linear scan can outperform even a reused hash set when the candidate list is small.

> **Evidence note:** The benchmark results and disassembly in this article come from the supplied BenchmarkDotNet reports, captured on a **13th Gen Intel Core i5-13400F** running **Windows 11**, **.NET 10.0.11**, **x64 RyuJIT AVX2**, and **BenchmarkDotNet 0.15.2**. The benchmark CSV, Markdown reports, and disassembly are the source of all measured figures below. The API latency example later in the article is hypothetical and is clearly labeled.

## 1. The deceptively simple method

Imagine an import job with two inputs: transactions and a list of approved customer IDs. We want the total transaction amount for approved customers.

```csharp
public readonly record struct Transaction(int CustomerId, long Amount);

public static long Calculate(
    Transaction[] transactions,
    List<int> approvedCustomers)
{
    long total = 0;

    foreach (var transaction in transactions)
    {
        if (approvedCustomers.Contains(transaction.CustomerId))
            total += transaction.Amount;
    }

    return total;
}
```

The implementation is straightforward. But `List<int>.Contains` searches linearly. If there are `N` transactions and `M` approved IDs, repeated membership checks can take **O(N × M)** comparisons in the worst case.

The obvious change is a hash set. Average lookup complexity becomes approximately **O(1)** for well-behaved hashes, though building the set also costs time and memory. The part people occasionally miss is *when* that set gets built.

## 2. Three contenders, not just two

We'll compare three strategies:

1. **List lookup:** Keep the original list and perform a scan for each transaction.
2. **New hash set:** Convert the approved list to a `HashSet<int>` inside every calculation.
3. **Reused hash set:** Build the set before calculations and reuse it across calls.

All three calculate the same answer for the same input. But they're not identical API designs: the third one assumes a caller maintains the lookup over time. If approval data changes and the cache isn't refreshed, it's fast *and wrong*. Thats not much of an improvement.

Here is a complete benchmark that makes the distinction visible. The benchmark project used for the reported runs also performs a correctness check in `GlobalSetup` and uses checked accumulation; those changes do not alter the three lookup strategies.

## 3. Reproducible BenchmarkDotNet experiment

Start with a .NET 10 console project:

```bash
dotnet new console -n CSharpPerfLab -f net10.0
cd CSharpPerfLab
dotnet add package BenchmarkDotNet
```

The complete benchmark and API latency code used for this article is available at [github.com/rizwan3d/CSharpPerformanceSuite](https://github.com/rizwan3d/CSharpPerformanceSuite).

Replace `Program.cs` with:

```csharp
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;

public readonly record struct Transaction(int CustomerId, long Amount);

[MemoryDiagnoser]
public class LookupBenchmarks
{
    [Params(100, 10_000)]
    public int TransactionCount { get; set; }

    [Params(16, 4096)]
    public int ApprovedCount { get; set; }

    private Transaction[] _transactions = null!;
    private List<int> _approvedList = null!;
    private HashSet<int> _approvedSet = null!;

    [GlobalSetup]
    public void Setup()
    {
        var random = new Random(42);
        _approvedList = Enumerable.Range(0, ApprovedCount).ToList();
        _approvedSet = _approvedList.ToHashSet();

        _transactions = new Transaction[TransactionCount];
        for (int i = 0; i < _transactions.Length; i++)
        {
            _transactions[i] = new Transaction(
                random.Next(0, ApprovedCount * 2),
                random.Next(1, 1000));
        }
    }

    [Benchmark(Baseline = true)]
    public long ListLookup()
    {
        long total = 0;
        foreach (var tx in _transactions)
            if (_approvedList.Contains(tx.CustomerId))
                total += tx.Amount;
        return total;
    }

    [Benchmark]
    public long NewHashSet()
    {
        var lookup = _approvedList.ToHashSet();
        long total = 0;
        foreach (var tx in _transactions)
            if (lookup.Contains(tx.CustomerId))
                total += tx.Amount;
        return total;
    }

    [Benchmark]
    public long ReusedHashSet()
    {
        long total = 0;
        foreach (var tx in _transactions)
            if (_approvedSet.Contains(tx.CustomerId))
                total += tx.Amount;
        return total;
    }
}

public static class Program
{
    public static void Main(string[] args)
    {
        BenchmarkRunner.Run<LookupBenchmarks>();
    }
}
```

Run it in Release mode:

```bash
dotnet run -c Release
```

The fixed seed makes the generated data repeatable. Returning the sum keeps the actual calculation observable. `GlobalSetup` deliberately excludes test-data creation and prebuilt-set construction from the per-operation timing, but **`NewHashSet` includes its own construction cost**. Thats exactly the comparison we want.

Also capture your environment:

```bash
dotnet --info
# Linux:
lscpu
```

Record the exact .NET patch version, BenchmarkDotNet version, CPU, operating system, and GC/runtime configuration. A virtual machine may experience host contention, so treat small differences carefully.

### The actual benchmark environment

| Setting | Recorded value |
|---|---|
| BenchmarkDotNet | 0.15.2 |
| OS | Windows 11 (10.0.26200.7922) |
| CPU | 13th Gen Intel Core i5-13400F, 10 physical / 16 logical cores |
| .NET SDK | 10.0.303 |
| Runtime | .NET 10.0.11 (10.0.1126.37416) |
| JIT | x64 RyuJIT AVX2 |

### Measured transaction lookup results

All means below are from the supplied BenchmarkDotNet transaction report. The workload inputs were generated with the same deterministic random seed for each implementation. **Lower is better.**

| Transactions | Approved IDs | ListLookup | NewHashSet | ReusedHashSet | Fastest |
|---:|---:|---:|---:|---:|---|
| 100 | 16 | 218.4 ns | 301.7 ns | **197.0 ns** | Reused set |
| 100 | 4,096 | 14,938.4 ns | 15,449.9 ns | **194.4 ns** | Reused set |
| 10,000 | 16 | **36.48 µs** | 67.15 µs | 69.62 µs | List |
| 10,000 | 4,096 | 2,455.96 µs | 89.55 µs | **72.92 µs** | Reused set |

The first surprise is the **10,000-transaction / 16-ID** workload. The original list scan took **36.48 µs**, compared with **69.62 µs** for a reused hash set. That's about **1.91× less time** for the list. At the other extreme, with **4,096 approved IDs**, the reused hash set completed the same 10,000-transaction workload in **72.92 µs** versus **2,455.96 µs** for the list—about **33.7× faster**.

At **100 transactions / 4,096 IDs**, constructing a fresh hash set erased the benefit: **15,449.9 ns**, slightly slower than the list's **14,938.4 ns**. Reusing the prebuilt set brought that workload down to **194.4 ns**. Thats a setup-cost difference worth measuring, not hand-waving away.

**Allocation and GC readings for transaction lookup:**

| Transactions | Approved IDs | List allocation | NewHashSet allocation | Reused allocation | NewHashSet Gen0 | NewHashSet Gen1 |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 16 | 0 B reported | 432 B | 0 B reported | 0.0410 | — |
| 100 | 4,096 | 0 B reported | 77,936 B | 0 B reported | 7.4005 | 1.4648 |
| 10,000 | 16 | 0 B reported | 432 B | 0 B reported | — | — |
| 10,000 | 4,096 | 0 B reported | 77,936 B | 0 B reported | 7.3242 | 1.3428 |

BenchmarkDotNet's Gen0/Gen1 figures are normalized collection counts **per 1,000 operations**, not collections per individual call. A dash means the report recorded no value at its displayed precision. The 432 B and 77,936 B figures are managed allocations attributable to building the temporary set, not its eventual live size in an application.

The `NewHashSet` rows also showed more timing variation than some of their alternatives. Treat narrow differences, such as the **100-transaction / 4,096-ID** list-versus-new-set result, as measurements to repeat rather than definitive architectural laws.

## 4. When an optimization fails, separate the costs

We did replace the list with a newly constructed hash set, and the result was disappointing on small batches. With 100 transactions and 4,096 approved IDs, the new set took 15,449.9 ns versus 14,938.4 ns for the list. With 100 transactions and 16 IDs, it took 301.7 ns versus 218.4 ns.

What actually changed? Two things:

- The membership-test algorithm changed.
- The method began allocating and populating a new collection.

That makes `NewHashSet` versus `ReusedHashSet` a useful comparison. The reused version did win on both 100-transaction workloads, while the new set did not. That points toward set construction as an important cost. The allocation report strengthens the explanation: 432 B at 16 IDs and 77,936 B at 4,096 IDs. A profiler would provide stronger evidence about where CPU time is spent inside the construction process.

There is another caveat. The reused-set benchmark measures a steady-state operation, **not** the cost of acquiring fresh approved IDs, maintaining a cache, synchronizing updates, or handling multiple threads. Include those costs in an end-to-end test if they're part of your real system.

A fair benchmark matches the decision you're making. If production builds a lookup once per 500 batches, measuring construction once per individual batch will give you the wrong answer. If production rebuilds it on every request, a benchmark that hides construction entirely can be just as misleading.

## 5. Look at the JIT, not the shape of the source

The C# compiler produces IL; RyuJIT turns it into machine instructions when appropriate for the execution model. Runtime settings, tiered compilation, architecture, and profile-guided optimization can all affect the generated code.

Even a tiny method illustrates why source-level assumptions can be unreliable:

```csharp
using System.Runtime.CompilerServices;
using BenchmarkDotNet.Attributes;

[DisassemblyDiagnoser(maxDepth: 1, printSource: true, exportHtml: true)]
public class AssemblyBenchmarks
{
    private int _value = 42;

    [Benchmark]
    public int Direct() => _value * 2;

    [Benchmark]
    public int ThroughMethod() => Multiply(_value);

    [MethodImpl(MethodImplOptions.NoInlining)]
    private static int Multiply(int value) => value * 2;
}
```

To run this comparison, change the entry point to `BenchmarkRunner.Run<AssemblyBenchmarks>();` and rerun the Release benchmark.

`NoInlining` intentionally forces a method boundary. That makes this an experiment about calls, **not** a demonstration of what the JIT would choose under normal conditions.

Here is the **actual captured x64 assembly** for `Direct()` from the uploaded disassembly report:

```asm
mov eax, [rcx+8]
add eax, eax
ret
```

And this is the **actual captured code** for `ThroughMethod()` and its helper:

```asm
mov ecx, [rcx+8]
jmp qword ptr [7FFBC4B159E0] ; Multiply(Int32)

; Multiply(Int32)
lea eax, [rcx+rcx]
ret
```

These snippets are taken from the report, with only the destination comment reformatted for readability. Notice that `ThroughMethod()` uses a **tail `jmp`**, rather than the `call`/`ret` sequence we might have guessed. This is exactly why capturing assembly is useful. The report lists **6 bytes** of code for `Direct()` and **13 bytes combined** for the two methods in the non-inlined path. The recorded means were **0.2187 ns** and **0.4408 ns**, respectively, with meaningful run-to-run variation at this extremely small timescale. That is a microbenchmark observation, not a general rule about every function call.

Why care about the call? Inlining can eliminate call overhead and may unlock constant propagation and related optimizations. But unrestricted inlining isn't automatically better: bigger machine-code bodies can harm instruction-cache locality.

After the forced comparison, remove `NoInlining` and run another test. If the JIT inlines the helper, the distinction at the C# method boundary may disappear in native code.

## 6. Allocations, structs, and the actual memory layout

Our transaction type is a readonly record struct:

```csharp
public readonly record struct Transaction(int CustomerId, long Amount);
```

An array of these values stores the elements inline in the array allocation. Contrast that with an array of references to class instances, where each instance normally needs its own object allocation.

```csharp
public sealed class TransactionObject
{
    public int CustomerId { get; init; }
    public long Amount { get; init; }
}

[MemoryDiagnoser]
public class AllocationBenchmarks
{
    [Params(1000)]
    public int Count { get; set; }

    [Benchmark]
    public Transaction[] StructArray()
    {
        var values = new Transaction[Count];
        for (int i = 0; i < values.Length; i++)
            values[i] = new Transaction(i, i);
        return values;
    }

    [Benchmark]
    public TransactionObject[] ClassArray()
    {
        var values = new TransactionObject[Count];
        for (int i = 0; i < values.Length; i++)
            values[i] = new TransactionObject
            {
                CustomerId = i,
                Amount = i
            };
        return values;
    }
}
```

Run this by changing the entry point to `BenchmarkRunner.Run<AllocationBenchmarks>();`.

The uploaded allocation benchmark gives us the actual totals for **1,000 elements**:

| Method | Mean | Allocated | Gen0 | Gen1 |
|---|---:|---:|---:|---:|
| StructArray | **1.020 µs** | **15.65 KB** | 1.5278 | — |
| ClassArray | 5.959 µs | 39.09 KB | 3.8261 | 0.4768 |

The class-array construction took **5.84×** as long and allocated **2.50×** as many managed bytes in this experiment. These benchmarks measure **creation and initialization**, not traversal or lifetime costs. The result supports the expected difference in object allocation patterns, without proving that structs win for every downstream workload. Again, the Gen columns show collections normalized per 1,000 operations.

The struct layout also affects traversal. Compact, contiguous data tends to work well with CPU caches, while following references can create extra memory accesses. That doesn't mean structs always win: large structs may be expensive to copy, and class identity or polymorphism might be essential to the design.

## 7. CPU caches explain some results that Big-O doesn't

Modern CPUs don't retrieve every value from main memory at the same cost. Registers and caches are much closer to execution units than DRAM.

A linear scan of a tiny `int` list can be quick because its elements are contiguous, and nearby elements may arrive in the same cache line. A hash lookup performs fewer logical comparisons on average, but involves hash computation and bucket/entry access with a less predictable memory pattern.

The numbers demonstrate this tension. With **10,000 transactions** and only **16 approved IDs**, the list took **36.48 µs**, beating the reused set at **69.62 µs**. With **4,096 IDs**, the list ballooned to **2,455.96 µs** and the reused set took **72.92 µs**. The small-list result is not merely a theoretical exception; it happened on the tested CPU and runtime.

To find the crossover rather than guess at it, change the parameter:

```csharp
[Params(4, 8, 16, 32, 64, 256, 1024, 4096)]
public int ApprovedCount { get; set; }
```

Keep `TransactionCount` fixed for a comparison and plot mean runtime against the approved-ID count. Then repeat with a different transaction count. The crossover can move with data distribution, successful versus failed searches, CPU architecture, and runtime implementation.

This is where simplistic advice about O(1) versus O(n) stops being enough. Complexity describes how work grows; it doesn't describe all of the constant costs or memory stalls.

## 8. GC counters: fewer allocations aren't the whole story

BenchmarkDotNet's `MemoryDiagnoser` records allocation data and normalized GC counts for benchmarked operations. That tells us something important about the method. It doesn't fully explain the behavior of a real server under load.

For the running application, use runtime diagnostics:

```bash
dotnet tool install --global dotnet-counters
dotnet-counters ps
dotnet-counters monitor --process-id <PID>
```

Depending on the runtime and tool version, inspect allocation rate, heap sizes, collections by generation, CPU usage, and Thread Pool behavior. Exact available metric names vary.

For perspective, an endpoint allocating 24 KB per request at 8,000 requests per second allocates about **192 MB per second** in decimal units. Thats a **calculated scenario**, not an observed measurement.

But even that number is not a verdict. Short-lived Gen 0 allocations can be relatively inexpensive. A lower allocation rate doesn't guarantee lower tail latency, and a service retaining a huge live object graph can suffer expensive collections despite modest allocation throughput.

What matters is whether garbage-collection behavior is significantly contributing to the observed problem.

## 9. Real API load tests: the fastest microbenchmark did not win the HTTP test

The hypothetical API example is no longer necessary for **end-to-end latency**. We now have three k6 JSON reports from the companion `ApiLatencyLab` project, which reads 10,000 rows from a seeded SQLite database, calculates an approved transaction total against 4,096 customer IDs, and returns JSON over HTTP. The approved set is prepared at application startup for the reused-set endpoint. For the new-set endpoint, set construction happens within the timed calculation. Each endpoint performs its own SQLite query before calculating the total.

The reports were collected with **10 virtual users**. Counts and request rates indicate runs lasting approximately **60 seconds**, with each strategy measured separately. The k6 reports don't record the load generator's CPU or confirm identical host load across runs. Treat the comparison as three observed runs, not a controlled proof of causation.

### Measured HTTP results

All durations below are **milliseconds**, and throughput is **HTTP requests per second**. These are the actual values from the uploaded k6 summaries, rounded only for readability.

| Strategy | Mean | Median | p95 | p99 | Requests/s | Checked iterations |
|---|---:|---:|---:|---:|---:|---:|
| List lookup | 14.19 | 7.89 | 35.27 | 50.72 | 699.3 | 41,980 |
| New hash set | 5.66 | 4.65 | 13.10 | 24.91 | 1,737.7 | 104,304 |
| Reused hash set | 10.96 | 6.39 | 27.43 | 38.69 | 903.2 | 54,213 |

Each of the three strategies passed every reported **HTTP 200**, **correct total**, and **correct count** check. The expected total was **2,503,317**. There were **zero failed HTTP requests** according to k6. The overall `http_reqs` totals are three higher than checked iterations in each run because additional setup requests are also counted.

### The unexpected winner

The **newly constructed hash set** produced the lowest observed average HTTP latency at **5.66 ms**, compared with **10.96 ms** for the reused set and **14.19 ms** for the list. Its observed request rate was approximately **1,737.7 requests/s**, compared with **903.2** and **699.3 requests/s** respectively.

That is surprising because the earlier standalone BenchmarkDotNet experiment at **10,000 transactions and 4,096 IDs** measured the reused hash set at **72.92 µs**, the new set at **89.55 µs**, and the list at **2,455.96 µs**. In isolation, reusing the set was faster than rebuilding it. In the HTTP runs, the new-set endpoint came first.

Don't force those two results into a neat story. A k6 summary reports client-observed HTTP latency, not just calculation time. The API queries SQLite on every request, and its response times can be influenced by operating-system scheduling, SQLite contention, cache state, garbage collection, and background load. Because these were separate runs rather than randomized interleaved trials, different run conditions could explain part or all of the ranking. **We cannot establish that constructing a hash set makes the API inherently faster than reusing one.**

The performance difference is worth investigating, not declaring a universal optimization rule.

### What these reports do and don't measure

We can now report genuine **mean, median, p95, p99, throughput, request counts, and correctness** for this test setup. But the k6 summaries do **not** include the API's instrumented `api.db.duration`, `api.calculate.duration`, or `api.serialize.duration` histograms. Those were recorded by `System.Diagnostics.Metrics` inside the service, yet a metrics collector/exporter is needed to retain their values during the run.

In other words, the request-level numbers are no longer hypothetical, while any numerical breakdown by database, calculation, or serialization would **still be hypothetical** without a corresponding metrics export or trace. Nor do these files provide the API's managed allocation rate, GC pause duration, or CPU utilization under load.

For a stronger follow-up, collect the three stage-level histograms and GC metrics, randomize the sequence of strategies, repeat each scenario several times, and test with the load generator on a separate machine. Then compare **per-stage distributions** as well as the client-observed response times. No stage-duration values have been invented here.

This is a useful practical result by itself: a method-level benchmark and an end-to-end test can rank alternatives differently, and good performance engineering preserves that discrepancy until the evidence explains it.

## 10. The experimental checklist I'd use before a production change

Here is the sequence I'd follow on a real system:

1. **Write down the actual problem.** Is it throughput, CPU cost, allocation rate, p95 latency, or p99 latency?
2. **Preserve a baseline.** Use the same machine class, workload, runtime version, and configuration where possible.
3. **Isolate the hypothesis.** Compare list lookup, new hash-set construction, and reused lookup separately.
4. **Inspect memory.** Use BenchmarkDotNet's allocation report; then inspect GC activity under real load if it matters.
5. **Inspect generated code only to answer a question.** Capture actual JIT disassembly instead of interpreting C# syntax as assembly.
6. **Profile the complete request or job.** A microbenchmark win is not necessarily a system-level win.
7. **Check correctness and ownership.** A reused lookup needs an invalidation/update strategy, particularly when multiple threads can read or refresh it.
8. **Rerun the tests.** Performance changes should not silently alter business behavior.

The most annoying bugs here aren't necessarily in the benchmark. They show up later, when a cache returns stale information or an optimization adds concurrency complexity nobody accounted for.

## 11. What the measurements actually establish

We can prove from the implementation that `List<T>.Contains` performs linear searching, that building a new hash set introduces extra work, and that reusing a prepared set removes that construction from each calculation. We can also explain why struct arrays and reference-type arrays have different allocation patterns.

We can now report measured speedups, allocation differences, normalized GC counts, and a real JIT disassembly for **this** CPU and .NET build. We **cannot** claim a precise crossover point from only two approved-ID sizes. We now have three real, end-to-end API load-test runs, but they do not explain the internal stage-by-stage costs or establish why the new-set endpoint unexpectedly led the HTTP comparison. Production tracing and repeated, controlled tests remain necessary.

### Conclusion: the interesting result isn't “HashSet wins”

The original code had a simple problem: a membership check inside a loop. Replacing the data structure might fix it, but whether the change helps depends on input size, lookup reuse, and the surrounding application.

The experiment is useful because it separates those costs. The list benchmark exposes repeated scans. The freshly built set includes setup and allocation. The reused set isolates steady-state lookup while leaving lifecycle management to the caller. Disassembly can explain specific generated-code differences; counters and traces can tell us whether those differences matter at scale.

Our benchmarks showed the hash set losing in two distinct situations: fresh-set construction on small batches, and even reused hashing when the scan covered only 16 IDs across 10,000 transactions. Neither result is embarrassing. They tell us where the costs are. Additional input sizes would locate the crossover more precisely. The API results gave us an even more interesting reversal: the new set had the lowest observed HTTP latency despite losing to reuse in the isolated lookup benchmark. Rather than invent an explanation, collect per-stage metrics, repeat the tests, and examine the full request.

Good performance writing should make those tradeoffs visible. **Measure the operation, account for its setup, inspect the runtime when needed, and validate the complete system.** Thats much more useful than a rule that says one collection is always faster.

---

## References

- [BenchmarkDotNet documentation](https://benchmarkdotnet.org/)
- [BenchmarkDotNet disassembly diagnoser](https://benchmarkdotnet.org/articles/features/disassembler.html)
- [Microsoft .NET diagnostic tools](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/)
- [dotnet-counters](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-counters)
- [Garbage collection fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)
- [k6 documentation](https://grafana.com/docs/k6/latest/)

*Experimental status: Transaction, allocation, and JIT assembly benchmarks, plus three real k6 API load-test summaries, were supplied and incorporated. Stage-level API metrics, repeated controlled runs, production tracing, and a full crossover sweep remain future experiments.*
