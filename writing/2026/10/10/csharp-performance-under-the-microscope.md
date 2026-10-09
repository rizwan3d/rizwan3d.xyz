---
title: "C# Performance Under the Microscope: JIT, Memory, and a Benchmark That Can Fail"
slug: "csharp-performance-under-the-microscope-jit-memory-and-a-benchmark-that-can-fail"
description: "A reproducible .NET 10 investigation of List vs HashSet lookups, setup costs, allocations, JIT assembly, CPU caches, and production profiling."
author: "Muhammad Rizwan"
category: "C#"
created: "2026-10-10"
updated: "2026-10-10"
tags: "csharp, dotnet, performance, benchmarking, jit, garbage-collection"
featuredImageCreditUrl: "https://unsplash.com/@marcojodoin"
featuredImageCredit: "Photo by Marc-Olivier Jodoin on Unsplash"
featuredImageAlt: "long exposure photography of road and cars"
featuredImage: "https://images.unsplash.com/photo-1498084393753-b411b2d26b34"
featured: true
---

*The fastest-looking change isn't always the fastest change. Here's how to test that claim instead of repeating it.*

A performance problem rarely announces itself as a slow algorithm. Sometimes it's an innocent `Contains` inside a loop. Other times, an allocation looks too small to matter until the service performs it thousands of times per second.

The usual advice is familiar: use a `HashSet<T>` for membership tests, avoid allocations, consider structs, and let the JIT do its work. None of that is entirely wrong. It just skips the difficult question: **what actually gets faster in the workload we're running?**

We'll examine a transaction-processing method, test three implementations, and then look below the C# source at allocations, generated machine code, CPU memory access, and application-level traces. One of the alternatives has a hidden setup cost, so the experiment is designed to reveal a case where an apparent optimization *might* fail.

> **Evidence note:** The code in this article targets **.NET 10** with **BenchmarkDotNet**. The preparation environment reported an **AMD EPYC 9V74** virtual CPU but did not have the .NET SDK installed, so I have **not run these benchmarks or captured disassembly**. Timings, GC counts, and assembly below are either explicitly illustrative or instructions for collecting real results. Don't cite a prediction as if it was measured.

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

Here is a complete benchmark that makes the distinction visible.

## 3. Reproducible BenchmarkDotNet experiment

Start with a .NET 10 console project:

```bash
dotnet new console -n CSharpPerfLab -f net10.0
cd CSharpPerfLab
dotnet add package BenchmarkDotNet
```

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

### What the results should look like

After running, transcribe the *actual* values from `BenchmarkDotNet.Artifacts/results`. Don't populate a benchmark table with estimated nanoseconds.

| Transactions | Approved IDs | Method | Mean | Allocated | Gen0 |
|---:|---:|---|---:|---:|---:|
| 100 | 16 | ListLookup | *run required* | *run required* | *run required* |
| 100 | 16 | NewHashSet | *run required* | *run required* | *run required* |
| 100 | 16 | ReusedHashSet | *run required* | *run required* | *run required* |
| 10,000 | 4,096 | ListLookup | *run required* | *run required* | *run required* |
| 10,000 | 4,096 | NewHashSet | *run required* | *run required* | *run required* |
| 10,000 | 4,096 | ReusedHashSet | *run required* | *run required* | *run required* |

The benchmark generates **four input combinations**, not only the two shown above; report all twelve method/parameter combinations when publishing real results.

The hypotheses are straightforward:

- For small inputs, the cost of constructing a set may outweigh its faster lookup.
- For large approved lists and many transactions, the repeated linear scans should become costly.
- Reusing a set should avoid the per-call set allocation, provided maintaining the set is a legitimate part of the application design.

These are **predictions**, not experimental findings. A measurement that contradicts them is interesting; it isn't a reason to quietly remove that row.

## 4. When an optimization fails, separate the costs

Suppose you replace the list with a newly constructed hash set. The result is disappointing on small batches.

What actually changed? Two things:

- The membership-test algorithm changed.
- The method began allocating and populating a new collection.

That makes `NewHashSet` versus `ReusedHashSet` a useful comparison. If the reused version wins but the newly created version doesn't, set construction is a plausible cause. Confirm that hypothesis with allocation measurements and, if necessary, a profiler.

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

A **conceptual** x64 listing for the direct operation could resemble:

```asm
mov eax, [rcx+8]
add eax, eax
ret
```

A conceptual non-inlined path could resemble:

```asm
mov edx, [rcx+8]
call Multiply
ret
```

These snippets are **not captured disassembly**. Actual output can differ in register choice, field offsets, prologues, instructions, and calling convention. To make a real assembly claim, inspect BenchmarkDotNet's generated disassembly report under `BenchmarkDotNet.Artifacts/results`.

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

Expect the class version to create more individual managed objects. But wait for the reported allocation counts before giving exact byte totals. Object headers, field layout, padding, and alignment depend on runtime details.

The struct layout also affects traversal. Compact, contiguous data tends to work well with CPU caches, while following references can create extra memory accesses. That doesn't mean structs always win: large structs may be expensive to copy, and class identity or polymorphism might be essential to the design.

## 7. CPU caches explain some results that Big-O doesn't

Modern CPUs don't retrieve every value from main memory at the same cost. Registers and caches are much closer to execution units than DRAM.

A linear scan of a tiny `int` list can be quick because its elements are contiguous, and nearby elements may arrive in the same cache line. A hash lookup performs fewer logical comparisons on average, but involves hash computation and bucket/entry access with a less predictable memory pattern.

For a large list, avoiding thousands of comparisons will usually matter more. For a very small list, contiguous scanning can be competitive.

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

## 9. The production bottleneck may be elsewhere

Imagine an API request with this **hypothetical**, illustrative breakdown:

| Work | Time |
|---|---:|
| Database fetch | 80 ms |
| Transaction calculation | 4 ms |
| Serialization | 2 ms |
| Other request work | 4 ms |
| **Total** | **90 ms** |

Even if the calculation improves from 4 ms to 1 ms, total latency only falls from 90 ms to 87 ms. Improving the database portion from 80 ms to 30 ms has a much larger effect.

That is Amdahl's Law in practical form. Improving a small slice of the work can't rescue the entire request.

And there is a subtle profiling trap: a CPU sampling profiler is great at showing where CPU time goes, but a request waiting on I/O may consume little CPU. Combine sampling with request traces and database timings when diagnosing end-to-end latency.

For runtime tracing:

```bash
dotnet tool install --global dotnet-trace
dotnet-trace ps
dotnet-trace collect --process-id <PID>
```

Capture under a representative load and analyze the trace with a compatible profiler. Don't infer that a CPU hotspot is the largest source of elapsed request time without checking the rest of the pipeline.

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

## 11. What we can honestly conclude before running anything

We can prove from the implementation that `List<T>.Contains` performs linear searching, that building a new hash set introduces extra work, and that reusing a prepared set removes that construction from each calculation. We can also explain why struct arrays and reference-type arrays have different allocation patterns.

What we **cannot** truthfully claim from source code alone is a precise speedup, an exact crossover point, the number of GC collections observed, or the specific instructions generated by a particular JIT build.

Those are experimental results. They belong in the article only after a real run, with the runtime, hardware, and configuration recorded next to the data.

### Conclusion: the interesting result isn't “HashSet wins”

The original code had a simple problem: a membership check inside a loop. Replacing the data structure might fix it, but whether the change helps depends on input size, lookup reuse, and the surrounding application.

The experiment is useful because it separates those costs. The list benchmark exposes repeated scans. The freshly built set includes setup and allocation. The reused set isolates steady-state lookup while leaving lifecycle management to the caller. Disassembly can explain specific generated-code differences; counters and traces can tell us whether those differences matter at scale.

If your benchmark shows the hash set losing on small inputs, that isn't embarrassing. It's the finding. Keep it, explain the setup cost, and show the crossover if there is one. If your API latency doesn't change after a convincing microbenchmark improvement, profile the whole request rather than optimizing the loop a second time.

Good performance writing should make those tradeoffs visible. **Measure the operation, account for its setup, inspect the runtime when needed, and validate the complete system.** Thats much more useful than a rule that says one collection is always faster.

---

## References

- [BenchmarkDotNet documentation](https://benchmarkdotnet.org/)
- [BenchmarkDotNet disassembly diagnoser](https://benchmarkdotnet.org/articles/features/disassembler.html)
- [Microsoft .NET diagnostic tools](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/)
- [dotnet-counters](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/dotnet-counters)
- [Garbage collection fundamentals](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/fundamentals)

*Experimental status: source and commands provided; benchmark measurements and assembly capture have not been executed for this draft.*
