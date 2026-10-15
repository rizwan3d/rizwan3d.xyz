---
title: "Zero-GC Programming and Unmanaged Memory: Engineering High-Performance Applications in Modern .NET"
slug: "zero-gc-programming-unmanaged-memory-high-performance-dotnet"
created: "2026-10-13"
updated: "2026-10-15"
category: "C#"
description: "A practical guide to allocation-free hot paths, unmanaged memory, reusable buffers, and Zero-GC architecture in modern .NET, APIs, and Unity games."
author: "Muhammad Rizwan"
tags: "C#, .NET, Performance, Garbage Collection, Unmanaged Memory, Unity"
series: "Performance-Aware Programming in C#"
seriesSlug: "performance-aware-programming-in-csharp"
seriesPart: 3
featuredImageCreditUrl: "https://unsplash.com/@harrisonbroadbent"
featuredImageCredit: "Photo by Harrison Broadbent on Unsplash"
featuredImageAlt: "green-circuit-board-close-up-photography"
featuredImage: "https://images.unsplash.com/photo-1562976540-1502c2145186?auto=format&fit=crop&w=1600&q=80"
featured: true
---

**An Advanced Guide to Allocation-Free Architecture, Native Memory, Game Engine Optimization, and High-Throughput API Development**

## Introduction

Garbage collection is one of the most useful features of modern managed programming languages. It reduces memory-management complexity, automatically reclaims unreachable objects, and eliminates many common manual memory-management errors.

However, garbage collection introduces a performance consideration that becomes especially important in latency-sensitive applications: **memory allocation is fast, but managing the accumulated allocations can create unpredictable execution delays.**

Consider three different systems:

- A game engine updating 100,000 entities at 144 frames per second.
- A backend API processing tens of thousands of network messages per second.
- A desktop application performing continuous binary data processing.

All three benefit from predictable memory usage and fewer allocations.

This is where **Zero-GC programming** and **unmanaged memory** become valuable.

Zero-GC programming is the practice of designing critical execution paths so that they produce no new managed heap allocations during normal operation.

It does not necessarily mean disabling the garbage collector or eliminating managed memory entirely.

Instead, the goal is to move allocation and resource management away from performance-critical execution paths.

A typical architecture follows this principle:

**Allocate during initialization → Reuse memory during execution → Release resources during shutdown.**

This article explores how to implement that architecture using modern .NET.



## Understanding the .NET memory model

Before implementing Zero-GC systems, it is important to understand where memory lives and who owns it.

The CLR manages several forms of memory, including the managed heap, stack storage, and memory allocated outside the managed runtime.

| Memory type | Managed by | GC involvement | Common use |
|---|---|---|---|
| Managed heap | CLR | Yes | Objects, arrays, strings |
| Stack allocation | Execution stack | No | Small temporary buffers |
| Pooled managed memory | CLR and application | Yes, but reusable | Network buffers |
| Unmanaged memory | Application/native allocator | No | Native buffers, engine data |

### Managed heap allocations

Consider this code:

```csharp
public sealed class Enemy
{
    public float X;
    public float Y;
    public int Health;
}

for (int i = 0; i < 100_000; i++)
{
    var enemy = new Enemy();
    enemy.X = i;
}
```

Each `Enemy` instance is a separate managed object.

Allocating them increases managed heap usage and creates objects that the garbage collector must eventually track or reclaim.

A modern .NET managed allocation is often extremely fast because it commonly uses pointer bumping. Therefore, allocating one small object is not inherently a performance problem.

The more important factors are allocation frequency, object lifetime, memory locality, and garbage collection behavior.

### Value types and stack allocation

Consider:

```csharp
public struct Position
{
    public float X;
    public float Y;
}

Position position = new()
{
    X = 10,
    Y = 20
};
```

`Position` is a value type.

Unlike a reference-type object, its storage is determined by where it is used. A local value may be stored in registers or stack storage, while values inside arrays or class fields are stored within their containing objects.

**Important:** Value types do not automatically guarantee stack allocation. Boxing, closure capture, and containing-object allocations can still create managed heap objects.

### Unmanaged memory

Unmanaged memory is allocated outside the garbage-collected managed heap.

For example:

```csharp
using System.Runtime.InteropServices;

unsafe
{
    void* memory = NativeMemory.Alloc(1024);

    try
    {
        Span<byte> buffer = new(memory, 1024);
        buffer.Clear();

        // Work with the unmanaged buffer.
    }
    finally
    {
        NativeMemory.Free(memory);
    }
}
```

Here, `NativeMemory.Alloc` requests a block of native memory.

The garbage collector does not reclaim that block. The application is responsible for releasing it.

This gives the developer more direct control over the buffer's lifetime, but also introduces memory-safety responsibilities.



## What Zero-GC actually means

Three concepts are frequently confused:

**Allocation-free execution** means a particular operation performs no new managed heap allocations.

**Unmanaged allocation** means memory is allocated outside the managed GC heap, but memory allocation still occurs.

**No-GC execution** means a critical region is executed while the runtime is attempting to prevent garbage collection.

These are different properties.

For most real-world applications, allocation-free hot paths are more practical than attempting to disable garbage collection.

For example:

```csharp
void Update(float deltaTime)
{
    for (int i = 0; i < positions.Length; i++)
    {
        positions[i] += velocities[i] * deltaTime;
    }
}
```

Assuming `positions` and `velocities` already exist and contain suitable numeric value types, this loop can execute without allocating managed objects.

The CLR may still perform garbage collection because another thread or subsystem created allocations.

Consequently, **zero managed allocations in one method does not guarantee zero garbage collection pauses across the whole process.**

The distinction is critical when engineering systems with strict latency requirements.



## Everyday application example: Allocation-free formatting

A common source of hidden allocations in ordinary applications is string creation.

Consider:

```csharp
public static string FormatStatus(int userId, int points)
{
    return $"User={userId}; Points={points}";
}
```

This method creates a new string for every call.

For a normal user interface this is usually acceptable. However, in repetitive logging, telemetry, or processing code, it can create unnecessary allocation pressure.

A more controlled approach uses `Span<char>` and `TryFormat`.

### Zero-allocation formatting implementation

```csharp
using System;

public static class StatusFormatter
{
    public static bool TryFormatStatus(
        int userId,
        int points,
        Span<char> destination,
        out int written)
    {
        written = 0;

        ReadOnlySpan<char> prefix = "User=";

        if (!prefix.TryCopyTo(destination))
            return false;

        int offset = prefix.Length;

        if (!userId.TryFormat(
                destination[offset..],
                out int count))
        {
            return false;
        }

        offset += count;

        ReadOnlySpan<char> middle = "; Points=";

        if (!middle.TryCopyTo(destination[offset..]))
            return false;

        offset += middle.Length;

        if (!points.TryFormat(
                destination[offset..],
                out count))
        {
            return false;
        }

        written = offset + count;
        return true;
    }
}
```

Usage:

```csharp
Span<char> buffer = stackalloc char[64];

if (StatusFormatter.TryFormatStatus(
        42,
        1500,
        buffer,
        out int length))
{
    Console.Out.WriteLine(buffer[..length]);
}
```

### Why this is more efficient

The formatting routine uses caller-provided storage instead of allocating a new result string.

`stackalloc` creates temporary storage that is automatically discarded when the current method returns.

`Span<T>` provides bounds-checked access to the buffer without copying its contents.

`TryFormat` writes numeric characters directly into the destination.

The core formatter can therefore run without managed heap allocations.

The console output operation itself is not guaranteed to be allocation-free, because the console implementation may perform additional work internally.

### Stack allocation limits

Stack storage is limited.

Do not use `stackalloc` for arbitrarily large user-controlled buffers, and avoid repeated stack allocations inside long-running loops. Large or variable-sized buffers should generally use pooling.



## Gaming example: A Zero-GC particle simulation

Game engines are one of the most important environments for allocation-free programming.

A game running at 60 FPS has approximately 16.67 milliseconds to complete each frame.

At 144 FPS, the budget is approximately 6.94 milliseconds.

Rendering, physics, animation, input handling, audio processing, AI, and other work must share this budget.

Frequent allocations can increase garbage collection activity, potentially causing visible frame-time spikes.

### Conventional object-oriented approach

Consider a particle system:

```csharp
public sealed class Particle
{
    public float X;
    public float Y;
    public float VelocityX;
    public float VelocityY;
}

List<Particle> particles = new();

for (int i = 0; i < 100_000; i++)
{
    particles.Add(new Particle());
}
```

This creates many individual managed objects.

Although the objects could be reused after initialization, each one has its own identity and object storage. This can introduce additional memory overhead and pointer indirection.

A data-oriented design can reduce these costs.

### Store particles in contiguous unmanaged memory

Instead of allocating individual particle objects, we can allocate a single native memory block.

First, define a value-type particle.

```csharp
public struct Particle
{
    public float X;
    public float Y;

    public float VelocityX;
    public float VelocityY;
}
```

Next, create an unmanaged particle container.

```csharp
using System;
using System.Runtime.InteropServices;

public unsafe sealed class ParticleBuffer : IDisposable
{
    private Particle* _particles;

    public int Count { get; }

    public ParticleBuffer(int count)
    {
        if (count <= 0)
            throw new ArgumentOutOfRangeException(
                nameof(count));

        Count = count;

        _particles = (Particle*)
            NativeMemory.AllocZeroed(
                (nuint)count,
                (nuint)sizeof(Particle));
    }

    public Span<Particle> AsSpan()
    {
        if (_particles == null)
            throw new ObjectDisposedException(
                nameof(ParticleBuffer));

        return new Span<Particle>(
            _particles,
            Count);
    }

    public void Update(float deltaTime)
    {
        Span<Particle> particles = AsSpan();

        for (int i = 0; i < particles.Length; i++)
        {
            ref Particle p = ref particles[i];

            p.X += p.VelocityX * deltaTime;
            p.Y += p.VelocityY * deltaTime;
        }
    }

    public void Dispose()
    {
        NativeMemory.Free(_particles);
        _particles = null;

        GC.SuppressFinalize(this);
    }

    ~ParticleBuffer()
    {
        NativeMemory.Free(_particles);
    }
}
```

This example provides deterministic release through `Dispose`, plus a finalizer as a fallback if the owner is abandoned.

Usage:

```csharp
using var particles = new ParticleBuffer(100_000);

Span<Particle> initial = particles.AsSpan();

for (int i = 0; i < initial.Length; i++)
{
    initial[i].VelocityX = 1.5f;
    initial[i].VelocityY = 0.5f;
}

// Simplified game simulation
for (int frame = 0; frame < 10_000; frame++)
{
    particles.Update(1.0f / 60.0f);
}
```

The particle memory is allocated once.

The simulation reuses the same native memory block for every frame.

There are no per-particle managed objects and no new managed arrays created during `Update`.

The update loop can run without managed allocations after initialization and JIT warm-up.

### Why the memory layout matters

The conventional class-based representation has a conceptual structure like:

```text
Managed list
    |
    +-- Reference --> Particle object
    |
    +-- Reference --> Particle object
    |
    +-- Reference --> Particle object
```

The native structure resembles:

```text
Contiguous memory block
+----------+----------+----------+----------+
| Particle | Particle | Particle | Particle |
+----------+----------+----------+----------+
```

Contiguous data may improve cache locality and reduce pointer chasing.

However, it is not automatically the fastest possible layout.

### Advanced optimization: Structure of arrays

The previous implementation uses an Array of Structures (AoS).

For large-scale simulations, a Structure of Arrays (SoA) layout can sometimes perform better.

```csharp
public sealed class ParticleSoA
{
    public readonly float[] X;
    public readonly float[] Y;

    public readonly float[] VelocityX;
    public readonly float[] VelocityY;

    public ParticleSoA(int count)
    {
        X = new float[count];
        Y = new float[count];

        VelocityX = new float[count];
        VelocityY = new float[count];
    }

    public void Update(float dt)
    {
        for (int i = 0; i < X.Length; i++)
        {
            X[i] += VelocityX[i] * dt;
            Y[i] += VelocityY[i] * dt;
        }
    }
}
```

This implementation uses managed arrays rather than unmanaged memory.

But because the arrays are allocated only during initialization and reused, the update method can still be allocation-free.

SoA can help vectorized processing when an algorithm repeatedly accesses the same fields across many entities.

The exact performance depends on access patterns, memory bandwidth, cache behavior, and whether the JIT can effectively vectorize the computation.

**An important engineering lesson:** Unmanaged memory and allocation-free programming are not synonymous. A well-designed managed array system can outperform a poorly designed native memory system.

### Production safety considerations

The unmanaged `ParticleBuffer` implementation deliberately exposes a low-level `Span<Particle>` view.

That view must not be used after its owning buffer is disposed.

The class is not safe for concurrent `Update` and `Dispose` calls.

For production systems, ownership and threading rules should be enforced, and a more structured ownership abstraction or safe-handle-based lifetime management may be appropriate.



## API example: Allocation-conscious binary protocol processing

High-throughput backend services face a different type of memory pressure.

A game simulation repeatedly updates state, whereas a backend API repeatedly receives, validates, transforms, and forwards data.

Consider an API receiving positional telemetry from connected clients.

A typical JSON message might look like:

```json
{
  "entityId": 100,
  "x": 15.5,
  "y": 22.8
}
```

JSON is convenient, interoperable, and often the right choice for ordinary APIs.

For an internal binary telemetry protocol where compact messages and predictable parsing are priorities, a fixed-width binary representation may be appropriate.

We can represent the same logical data in 12 bytes.

| Field | Data type | Size |
|---|---|---|
| Entity ID | int32 | 4 bytes |
| X | float32 | 4 bytes |
| Y | float32 | 4 bytes |
| **Total** | | **12 bytes** |

This size excludes HTTP, transport, and other protocol overhead.

### Create a binary telemetry codec

```csharp
using System;
using System.Buffers;
using System.Buffers.Binary;

public readonly record struct Telemetry(
    int EntityId,
    float X,
    float Y
);

public static class TelemetryCodec
{
    public const int Size = 12;

    public static bool TryDecode(
        ReadOnlySpan<byte> source,
        out Telemetry result)
    {
        result = default;

        if (source.Length != Size)
            return false;

        int id =
            BinaryPrimitives.ReadInt32LittleEndian(
                source);

        float x =
            BinaryPrimitives.ReadSingleLittleEndian(
                source[4..]);

        float y =
            BinaryPrimitives.ReadSingleLittleEndian(
                source[8..]);

        if (id < 0 ||
            !float.IsFinite(x) ||
            !float.IsFinite(y))
        {
            return false;
        }

        result = new Telemetry(id, x, y);
        return true;
    }

    public static void Encode(
        in Telemetry value,
        IBufferWriter<byte> writer)
    {
        Span<byte> output = writer.GetSpan(Size);

        BinaryPrimitives.WriteInt32LittleEndian(
            output,
            value.EntityId);

        BinaryPrimitives.WriteSingleLittleEndian(
            output[4..],
            value.X);

        BinaryPrimitives.WriteSingleLittleEndian(
            output[8..],
            value.Y);

        writer.Advance(Size);
    }
}
```

The decoder reads directly from a supplied byte span.

It does not need to allocate a new byte array or create a managed reference-type object for every message.

The result is returned as a value type.

The encoder writes into memory provided by `IBufferWriter<byte>`, allowing the caller to manage buffer reuse.

The protocol explicitly uses little-endian byte order, avoiding dependency on the machine's native endianness.

In a complete production protocol, additional concerns would include versioning, authentication, integrity, numerical ranges, and application-specific validation.

### Reusing an output buffer

```csharp
using System.Buffers;

var writer = new ArrayBufferWriter<byte>(256);

var telemetry = new Telemetry(
    100,
    15.5f,
    22.8f);

for (int i = 0; i < 10_000; i++)
{
    writer.Clear();

    TelemetryCodec.Encode(
        in telemetry,
        writer);

    ReadOnlySpan<byte> payload =
        writer.WrittenSpan;

    // Process payload synchronously here.
}
```

`ArrayBufferWriter<byte>` is a managed, growable buffer.

Its initial construction allocates managed storage. But with enough initial capacity and continued reuse, encoding can proceed without allocating a new output array for each message.

A consumer must not retain `WrittenSpan` after the underlying writer is reused or resized.

### Integrating the codec into an ASP.NET Core API

The following example shows a minimal HTTP endpoint accepting a fixed-size binary telemetry message.

```csharp
using System.Buffers;

var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapPost("/telemetry",
    async (HttpRequest request, HttpResponse response) =>
{
    if (request.ContentLength != TelemetryCodec.Size)
    {
        response.StatusCode = 400;
        return;
    }

    byte[] rented = ArrayPool<byte>.Shared.Rent(
        TelemetryCodec.Size);

    try
    {
        await request.Body.ReadExactlyAsync(
            rented.AsMemory(
                0,
                TelemetryCodec.Size));

        ReadOnlySpan<byte> payload =
            rented.AsSpan(0, TelemetryCodec.Size);

        if (!TelemetryCodec.TryDecode(
                payload,
                out Telemetry telemetry))
        {
            response.StatusCode = 400;
            return;
        }

        // Process validated telemetry here.
        // For example, update a preallocated state store.

        response.StatusCode = 204;
    }
    catch (EndOfStreamException)
    {
        response.StatusCode = 400;
    }
    finally
    {
        ArrayPool<byte>.Shared.Return(
            rented,
            clearArray: true);
    }
});

app.Run();
```

This endpoint uses a reusable array pool instead of allocating a dedicated 12-byte array on every request.

However, this is an **allocation-conscious API**, not a fully Zero-GC HTTP server.

ASP.NET Core routing, middleware, asynchronous execution, transport operations, and other runtime infrastructure may still allocate memory.

Additionally, an array pool may allocate new arrays when it needs to expand its available buffers.

The key achievement is making the application-owned parsing path allocation-free and reducing repeated buffer allocation.

### Why not use unmanaged memory for every request?

Allocating native memory per request would not necessarily be an improvement.

For example:

```csharp
unsafe
{
    byte* buffer = (byte*)NativeMemory.Alloc(4096);

    try
    {
        // Process one request.
    }
    finally
    {
        NativeMemory.Free(buffer);
    }
}
```

This avoids a managed array allocation, but it introduces a native allocation and free operation for every request.

Native allocation has its own cost, including allocator synchronization, fragmentation risks, and ownership complexity.

A properly sized and reused managed buffer pool is often preferable for network I/O.

This is why high-performance API design usually starts with spans, pooled buffers, streaming, and bounded allocations before introducing raw pointers.



## Advanced technique: Manual memory arenas

For more demanding systems, another useful technique is an **arena allocator**.

An arena allocates one large memory region and serves smaller temporary allocations from it.

Instead of calling a general-purpose allocator repeatedly, the application advances an offset into an existing memory block.

Conceptually:

```text
Allocated arena: 1 MB

+----------------+----------------+-------------------+
| Allocation A   | Allocation B   | Available space   |
+----------------+----------------+-------------------+
0               Offset           Current capacity
```

A simplified unmanaged arena might look like this:

```csharp
using System;
using System.Runtime.InteropServices;

public unsafe sealed class NativeArena : IDisposable
{
    private byte* _base;
    private readonly nuint _capacity;
    private nuint _offset;

    public NativeArena(nuint capacity)
    {
        if (capacity == 0 || capacity > int.MaxValue)
            throw new ArgumentOutOfRangeException(
                nameof(capacity));

        _base = (byte*)NativeMemory.Alloc(capacity);
        _capacity = capacity;
    }

    public Span<byte> Allocate(int size)
    {
        if (_base == null)
            throw new ObjectDisposedException(
                nameof(NativeArena));

        if (size < 0)
            throw new ArgumentOutOfRangeException(
                nameof(size));

        nuint length = (nuint)size;

        if (length > _capacity - _offset)
            throw new OutOfMemoryException(
                "Arena capacity exceeded.");

        byte* result = _base + (nint)_offset;
        _offset += length;

        return new Span<byte>(result, size);
    }

    public void Reset()
    {
        if (_base == null)
            throw new ObjectDisposedException(
                nameof(NativeArena));

        _offset = 0;
    }

    public void Dispose()
    {
        NativeMemory.Free(_base);
        _base = null;
    }
}
```

Usage:

```csharp
using var arena = new NativeArena(1024 * 1024);

for (int frame = 0; frame < 1000; frame++)
{
    Span<byte> temporaryA = arena.Allocate(256);
    Span<byte> temporaryB = arena.Allocate(512);

    temporaryA.Clear();
    temporaryB.Clear();

    // Complete all operations using these spans.

    arena.Reset();
}
```

The arena performs one native allocation during initialization.

Each subsequent allocation is essentially a capacity check and an offset update.

Resetting the arena makes the memory reusable without individually freeing temporary blocks.

### Where arenas are useful

Arenas are particularly valuable for frame-local game data, temporary geometry generation, parser scratch space, native interop workloads, and fixed-lifetime processing batches.

The example is intentionally limited to byte buffers and one execution thread.

A production arena would need clearly defined alignment requirements, safe lifetime handling, possible concurrency controls, and policies for growth or failure.

**Critical rule:** Calling `Reset()` invalidates every prior logical allocation from that arena, even though the physical memory is still present.

A span obtained before reset can still technically reference the memory, but using it after that space is reused can corrupt application state.

Additionally, since the arena has no finalizer, failing to dispose it leaks its native allocation. For production use, deterministic disposal with a well-defined owner is mandatory; a suitable `SafeHandle` design can provide a finalization safety net.



## The hidden allocations that break Zero-GC code

Even when an application uses value types and preallocated buffers, hidden managed allocations can remain.

### Boxing

```csharp
int value = 42;

object boxed = value;
```

Converting a value type to `object` creates a boxed managed object.

Generic APIs can often avoid this.

### LINQ materialization

```csharp
var active = enemies
    .Where(enemy => enemy.Health > 0)
    .ToArray();
```

The result array is a new managed allocation.

The filtering pipeline can also introduce other overhead depending on how it is used.

When profiling identifies this code as a hot path, a manual loop over reusable storage may be more appropriate.

### Closures and delegates

```csharp
int threshold = 10;

Func<int, bool> predicate =
    value => value > threshold;
```

Capturing `threshold` may require a compiler-generated closure object.

Avoid creating capturing delegates repeatedly in performance-critical loops.

### String operations

```csharp
string result = name.ToUpperInvariant();
```

Many string transformations create a new string.

When possible, work directly with spans, compare without transforming, or write into caller-provided buffers.

### Asynchronous execution

`async` and `await` are not automatically allocation-free.

Depending on whether an operation completes synchronously, how its state is represented, and what supporting infrastructure is involved, asynchronous execution may require managed state and other allocations.

`ValueTask<T>` can reduce some allocations in suitable APIs, but it is not a universal replacement for `Task<T>`.

Always benchmark the complete operation rather than assuming a language feature guarantees zero allocations.



## Measuring Zero-GC performance correctly

An optimization should be verified with measurements.

The .NET runtime provides:

```csharp
GC.GetAllocatedBytesForCurrentThread()
```

This reports managed allocation activity on the current thread.

A simple measurement example:

```csharp
using var particles = new ParticleBuffer(100_000);

// Warm up the JIT and the code path.
particles.Update(1.0f / 60.0f);

long before =
    GC.GetAllocatedBytesForCurrentThread();

for (int i = 0; i < 10_000; i++)
{
    particles.Update(1.0f / 60.0f);
}

long after =
    GC.GetAllocatedBytesForCurrentThread();

Console.WriteLine(
    $"Managed bytes allocated: {after - before}");
```

For this particular update path, a properly warmed, optimized execution may report zero managed bytes allocated.

That does not mean the entire application allocated zero bytes.

The measurement excludes native allocations and allocations occurring on other threads.

### Production measurement strategy

For production-level performance investigations, measure more than allocation counts.

| Metric | What it reveals |
|---|---|
| Managed allocation rate | GC pressure |
| Gen 0 / Gen 1 / Gen 2 collections | Collection activity |
| GC pause duration | Latency impact |
| P95 / P99 execution time | Tail latency |
| Native memory usage | Unmanaged memory consumption |
| Working set and committed memory | Overall process memory footprint |
| CPU utilization | Computational cost |
| Cache miss rate | Memory access efficiency |

Use benchmarking and profiling tools such as BenchmarkDotNet, `dotnet-counters`, and `dotnet-trace` where appropriate.

A useful benchmark compares an allocation-heavy baseline, a pooled managed implementation, and an unmanaged implementation under the same workload.

Run optimized Release builds, warm the code paths, use representative input sizes, and account for tiered compilation and background runtime activity.

Do not assume unmanaged memory is faster without measurements.



## Can we completely disable the garbage collector?

.NET provides a specialized API:

```csharp
GC.TryStartNoGCRegion(...)
```

It attempts to reserve sufficient managed allocation budget for a critical period.

For example:

```csharp
bool entered = GC.TryStartNoGCRegion(
    totalSize: 4 * 1024 * 1024,
    disallowFullBlockingGC: true);

if (entered)
{
    try
    {
        ExecuteCriticalOperation();
    }
    finally
    {
        GC.EndNoGCRegion();
    }
}
else
{
    // Fall back to ordinary execution
    // or defer the critical operation.
}
```

The caller must establish that the runtime has successfully entered the no-GC region before attempting to end it.

In production, error handling must also account for the possibility that the region has been broken by allocation pressure, in which case `EndNoGCRegion` may throw `InvalidOperationException`.

The requested budget covers managed allocations, including relevant runtime allocations, rather than representing an unmanaged memory reservation.

**This is not a general-purpose way to make .NET real-time.**

The no-GC region is process-wide, cannot be nested, may fail to start, and can lose its guarantees if allocation assumptions are violated.

It also does not eliminate operating-system scheduling delays, page faults, locks, or other sources of latency.

For most applications, reducing allocations and improving data layout is more beneficial than attempting to suppress the garbage collector.



## Memory safety and the cost of unmanaged control

Unmanaged memory introduces failure modes that garbage-collected managed memory normally protects against.

A **use-after-free** occurs when code continues accessing a buffer after its native allocation has been released.

A **double-free** occurs when the same native memory allocation is released more than once.

A **buffer overrun** occurs when pointer-based code accesses memory outside the allocated region.

Additional risks include uninitialized reads, memory leaks, incorrect alignment, and data races.

`Span<T>` provides useful bounds checking when accessing a known region, but it does not own the underlying memory and cannot ensure the region remains alive.

This means a span over unmanaged memory is safe to use only while the owner guarantees that the memory remains valid.

Native allocations also do not automatically cause the .NET GC to recognize how much external memory a small managed wrapper owns.

Large unmanaged allocations may therefore require additional accounting and careful process-memory monitoring.

### Choosing the right strategy

| Requirement | Recommended starting point |
|||
| Small temporary buffers | `stackalloc` with `Span<T>` |
| Reusable request buffers | `ArrayPool<T>` |
| Long-lived numeric state | Preallocated managed arrays |
| Native API integration | Native buffers with controlled ownership |
| Large fixed-capacity simulation | Managed or unmanaged contiguous storage |
| Repeated temporary native allocations | Arena or slab allocator |
| Strict managed allocation limits | Preallocation and measured hot paths |

The preferred design is usually the simplest one that meets the measured performance target.



## Advanced architectural pattern: The allocation-free hot path

The most maintainable Zero-GC systems separate execution into three phases.

### Phase A: Initialization

Allocate arrays, native buffers, pools, lookup tables, and simulation state.

Initialize data structures to their expected operating capacity.

Warm up important code paths where appropriate.

### Phase B: Steady-state execution

Reuse existing memory.

Operate on spans or contiguous arrays.

Minimize temporary object construction.

Avoid unbounded growth in critical paths.

Perform bounded work wherever predictable latency is important.

### Phase C: Shutdown or reconfiguration

Return pooled buffers.

Dispose native memory owners.

Release handles.

Rebuild or resize data structures outside latency-critical execution when possible.

This architecture is applicable to game engines, audio systems, network services, industrial control software, scientific simulations, and high-throughput data processors.

The critical distinction is that object creation is moved to controlled phases instead of being spread throughout continuously executing operations.



## Zero-GC is not the same as maximum performance

Removing allocations is only one aspect of performance engineering.

A system can allocate zero managed bytes and still perform poorly because of:

- Poor cache locality or excessive memory bandwidth usage.
- Unnecessary synchronization and lock contention.
- Inefficient algorithms or excessive CPU instructions.
- Branch misprediction and ineffective vectorization.
- Native allocator overhead or operating-system paging.
- Excessive pointer indirection and fragmented memory.

For example, manually allocating 100,000 native blocks can be substantially less efficient than creating one managed array containing 100,000 value types.

Likewise, a single allocation made outside a critical frame or request path may have no meaningful impact on latency.

The objective is not to eliminate every allocation at any cost.

The objective is to create **predictable performance with acceptable complexity and strong correctness guarantees.**



## Zero-GC programming in Unity 3D

### Why garbage collection matters in Unity

Unity 3D is a real-time game engine where consistent frame execution is often more important than peak execution speed.

Unlike ordinary applications, a game must continuously update rendering, physics, animations, AI, and gameplay systems within a limited frame-time budget.

| Target frame rate | Frame budget |
|---|---|
| 30 FPS | 33.33 ms |
| 60 FPS | 16.67 ms |
| 120 FPS | 8.33 ms |
| 144 FPS | 6.94 ms |
| 240 FPS | 4.17 ms |

Garbage collection work can contribute to frame-time spikes, producing visible stuttering even when the average frame rate appears acceptable.

Unity uses both managed and native memory. GameObjects, components, engine resources, and native containers have different allocation and lifetime characteristics.

A `MonoBehaviour` is a managed C# object associated with Unity engine state, while a `NativeArray<T>` owns or references native memory that must be managed explicitly.

**The primary objective of Zero-GC Unity programming is to prevent unnecessary managed heap allocations during gameplay loops, especially `Update()`, `FixedUpdate()`, and frequently executed callbacks.**

#### Common causes of garbage allocations in Unity

- Creating temporary lists and arrays inside `Update()`.
- Instantiating and destroying projectiles repeatedly.
- Repeatedly generating strings for UI and logging.
- Performing physics queries that allocate result arrays.
- Creating capturing lambdas, delegates, or boxed values.
- Using LINQ materialization in frequently executed systems.

Unity's official optimization guidance recommends reducing temporary managed allocations to zero bytes per frame, or as close to zero as practical.



### Example one: Zero-GC physics queries

Imagine an enemy AI system that detects nearby targets every physics update.

A typical implementation is:

```csharp
using UnityEngine;

public class EnemyDetection : MonoBehaviour
{
    public float detectionRadius = 10f;

    void FixedUpdate()
    {
        Collider[] targets =
            Physics.OverlapSphere(
                transform.position,
                detectionRadius);

        foreach (Collider target in targets)
        {
            // Process detected targets
        }
    }
}
```

The problem is that `Physics.OverlapSphere()` returns a managed array.

Calling it continuously creates repeated allocations.

#### Optimized implementation

```csharp
using UnityEngine;

public sealed class ZeroGCEnemyDetection : MonoBehaviour
{
    [SerializeField]
    private float detectionRadius = 10f;

    [SerializeField]
    private LayerMask targetLayers = ~0;

    private readonly Collider[] _results =
        new Collider[64];

    private Transform _cachedTransform;

    private void Awake()
    {
        _cachedTransform = transform;
    }

    private void FixedUpdate()
    {
        int count = Physics.OverlapSphereNonAlloc(
            _cachedTransform.position,
            detectionRadius,
            _results,
            targetLayers,
            QueryTriggerInteraction.Ignore);

        for (int i = 0; i < count; i++)
        {
            Collider target = _results[i];

            // Process target without allocating
            // temporary managed collections.
        }

        // A full buffer may indicate omitted hits.
        if (count == _results.Length)
        {
            // Handle possible overflow according
            // to the gameplay requirements.
        }
    }
}
```

#### Performance advantages

The results array is allocated only once, during initialization.

Each physics query writes into the existing array instead of constructing a new result array.

This can eliminate managed allocations attributable to the query results during steady-state execution.

However, there is an important limitation: the buffer has a fixed capacity.

If more than 64 colliders overlap the detection sphere, not every hit can be represented. When the returned count equals the buffer's length, the application cannot assume that every nearby collider was found.

Production systems should size the buffer from measured worst-case scenarios or use a documented overflow strategy.



### Example two: Preallocated GameObject pooling

Repeated `Instantiate()` and `Destroy()` operations are common sources of allocation pressure and Unity engine overhead.

This becomes especially relevant for projectiles, enemies, visual effects, and frequently spawned gameplay objects.

Instead of creating a new GameObject every time, a fixed-capacity pool can instantiate objects during initialization and reuse them throughout gameplay.

```csharp
using UnityEngine;

public sealed class ProjectilePool : MonoBehaviour
{
    [SerializeField]
    private GameObject projectilePrefab;

    [SerializeField, Min(1)]
    private int capacity = 128;

    private GameObject[] _projectiles;

    private void Awake()
    {
        _projectiles = new GameObject[capacity];

        for (int i = 0; i < capacity; i++)
        {
            GameObject instance = Instantiate(
                projectilePrefab,
                transform);

            instance.SetActive(false);
            _projectiles[i] = instance;
        }
    }

    public bool TrySpawn(
        Vector3 position,
        Quaternion rotation,
        out GameObject projectile)
    {
        for (int i = 0; i < _projectiles.Length; i++)
        {
            GameObject instance = _projectiles[i];

            if (instance.activeSelf)
                continue;

            instance.transform.SetPositionAndRotation(
                position,
                rotation);

            instance.SetActive(true);

            projectile = instance;
            return true;
        }

        projectile = null;
        return false;
    }

    public void Despawn(GameObject projectile)
    {
        if (projectile != null)
            projectile.SetActive(false);
    }
}
```

Example usage:

```csharp
if (projectilePool.TrySpawn(
    spawnPoint.position,
    spawnPoint.rotation,
    out GameObject projectile))
{
    // Projectile successfully activated.
}
```

This design avoids new projectile instantiation when firing.

It also establishes an explicit maximum number of simultaneously active projectiles.

The search for an available projectile is O(n), which may be acceptable for small pools. Larger systems can replace the linear search with a preallocated free-index stack for approximately O(1) acquisition and release.

Pooling does not guarantee that every activation is allocation-free. Scripts invoked by `OnEnable()`, physics initialization, and other components may perform additional allocations. Those paths should be profiled separately.



### Example three: NativeArray, Jobs, and the Burst compiler

For computationally intensive simulations, Unity provides a more advanced architecture:

**Native Collections + C# Job System + Burst Compiler**

These technologies allow developers to process data in native memory, execute eligible workloads across worker threads, and benefit from optimized native machine code.

Consider a simulation involving thousands of moving entities.

A traditional MonoBehaviour-based implementation might update each GameObject independently.

That approach can introduce scheduling overhead, fragmented data access, and poor CPU-cache utilization at high entity counts.

A data-oriented implementation separates the simulation state from the Unity object hierarchy.

#### Step 1: Define a Burst-compiled parallel job

```csharp
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;

[BurstCompile]
public struct MovementJob : IJobParallelFor
{
    public NativeArray<float3> Positions;

    [ReadOnly]
    public NativeArray<float3> Velocities;

    [ReadOnly]
    public float DeltaTime;

    public void Execute(int index)
    {
        Positions[index] +=
            Velocities[index] * DeltaTime;
    }
}
```

Each job execution operates on a different array index.

This allows many elements to be processed in parallel while avoiding conflicting writes to the same position.

The job contains unmanaged-compatible types and native containers rather than managed class references.

#### Step 2: Allocate simulation memory once

```csharp
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

public sealed class NativeMovementSystem : MonoBehaviour
{
    [SerializeField]
    private Transform[] targets;

    [SerializeField]
    private Vector3 initialVelocity =
        new Vector3(1f, 0f, 0f);

    private NativeArray<float3> _positions;
    private NativeArray<float3> _velocities;

    private JobHandle _handle;
    private bool _jobScheduled;

    private void OnEnable()
    {
        if (targets == null || targets.Length == 0)
        {
            enabled = false;
            return;
        }

        int count = targets.Length;

        _positions = new NativeArray<float3>(
            count,
            Allocator.Persistent);

        _velocities = new NativeArray<float3>(
            count,
            Allocator.Persistent);

        float3 velocity = new float3(
            initialVelocity.x,
            initialVelocity.y,
            initialVelocity.z);

        for (int i = 0; i < count; i++)
        {
            Vector3 p = targets[i].position;

            _positions[i] = new float3(
                p.x, p.y, p.z);

            _velocities[i] = velocity;
        }
    }

    private void Update()
    {
        if (!_positions.IsCreated)
            return;

        MovementJob job = new MovementJob
        {
            Positions = _positions,
            Velocities = _velocities,
            DeltaTime = Time.deltaTime
        };

        _handle = job.Schedule(
            _positions.Length,
            64);

        _jobScheduled = true;
    }

    private void LateUpdate()
    {
        if (!_jobScheduled)
            return;

        _handle.Complete();
        _jobScheduled = false;

        for (int i = 0; i < targets.Length; i++)
        {
            float3 p = _positions[i];

            targets[i].position = new Vector3(
                p.x, p.y, p.z);
        }
    }

    private void OnDisable()
    {
        if (_jobScheduled)
        {
            _handle.Complete();
            _jobScheduled = false;
        }

        if (_positions.IsCreated)
            _positions.Dispose();

        if (_velocities.IsCreated)
            _velocities.Dispose();
    }
}
```

#### How this architecture works

**Initialization:** Two `NativeArray<float3>` buffers are allocated using `Allocator.Persistent`.

**Update phase:** A parallel movement job is scheduled. The application does not create new NativeArrays each frame.

**LateUpdate phase:** The main thread completes the job, regains safe access to the native data, and applies calculated positions to Unity Transforms.

**Shutdown:** All scheduled work is completed before native memory is released.

This is particularly important because disposing memory while a job is still accessing it can cause invalid memory access and safety-system errors.

The example is appropriate for demonstrating the architecture, but it has a remaining bottleneck: the final loop still updates individual Unity Transforms on the main thread.

For substantially larger entity counts, Unity's Entities architecture, transform jobs, or GPU-driven rendering can reduce that overhead.

The sample also uses ordinary Transform updates rather than Rigidbody physics. Physics-driven movement should follow Unity's fixed-timestep and physics APIs.

#### The role of Burst

Burst can optimize eligible job code using vectorization and other compiler transformations.

However, Burst does not automatically mean zero memory allocations or perfect parallel scaling.

The cost of scheduling jobs, completing them, transferring data, and synchronizing threads still matters.

Small workloads may execute faster as a normal loop because job scheduling overhead can exceed the cost of the computation.

This makes profiling essential.



### Native memory allocation strategies in Unity

Unity provides allocation strategies for native containers.

| Allocator | Intended lifetime | Typical use |
||||
| `Allocator.Temp` | Very short, within one frame | Immediate temporary calculations |
| `Allocator.TempJob` | Short-lived, normally disposed within four frames | Job scratch buffers |
| `Allocator.Persistent` | Explicitly managed longer lifetime | Simulation state and persistent buffers |

For a continuous simulation, `Allocator.Persistent` is often appropriate when the data capacity remains stable across frames.

Example:

```csharp
NativeArray<float> data =
    new NativeArray<float>(
        100_000,
        Allocator.Persistent);

try
{
    // Reuse data across operations.
}
finally
{
    if (data.IsCreated)
        data.Dispose();
}
```

The critical engineering requirement is that every owning native container must eventually be disposed of.

`NativeArray<T>` is a value-type wrapper around native memory. Copying the wrapper does not create an independent owned allocation.

Multiple copies can refer to the same underlying allocation, so ownership and disposal rules must be clear.

When jobs are involved, complete dependent work before disposing or use supported job-dependent disposal mechanisms.



### Advanced Unity optimization: Data-oriented design and ECS

Traditional Unity architecture often organizes behavior around individual GameObjects and MonoBehaviours.

Data-oriented design organizes computation around data layout and access patterns instead.

For example, an enemy simulation could store positions, velocities, health values, and states in separate contiguous buffers.

```text
Traditional component-oriented simulation:

Enemy GameObject
  ├── Transform
  ├── Movement Component
  ├── Health Component
  └── AI Component

Enemy GameObject
  ├── Transform
  ├── Movement Component
  ├── Health Component
  └── AI Component


Data-oriented simulation:

Positions:  [P0, P1, P2, P3, ...]
Velocities: [V0, V1, V2, V3, ...]
Health:     [H0, H1, H2, H3, ...]
States:     [S0, S1, S2, S3, ...]
```

With contiguous data, systems can process large batches of similar components efficiently.

Unity's Entity Component System (ECS), part of its data-oriented technology stack, builds on this idea by organizing entity data and system processing around component access.

ECS can be valuable for large simulations, crowds, procedural environments, and other workloads with many entities sharing similar behavior.

However, ECS is not a universal replacement for GameObjects.

Conventional MonoBehaviour architecture is often simpler and perfectly adequate for UI, unique gameplay objects, menus, and less computationally demanding features.

The strongest architecture may combine GameObjects for presentation and interaction with native, data-oriented systems for intensive simulation.



### Verifying Zero-GC performance in Unity

The Unity Profiler should be the primary tool for validating improvements.

Open:

**Window → Analysis → Profiler**

Inspect the CPU Usage and Memory modules, particularly managed allocation activity and `GC.Alloc` samples.

A practical testing process is:

1. Warm up the relevant game systems, shaders, scripts, and pools.
2. Run a representative gameplay scenario.
3. Inspect managed allocations during the steady-state frame loop.
4. Enable allocation call stacks when investigating specific sources.
5. Compare frame-time distributions and native memory usage before and after changes.
6. Repeat measurements in a Development Build on the target device.

The goal should be to achieve zero managed allocations in identified hot paths while maintaining stable frame times.

It is important to distinguish `GC.Alloc` from native memory allocations.

A native container can allocate unmanaged memory without producing an equivalent managed-heap allocation measurement.

Similarly, observing zero `GC.Alloc` samples does not prove that the game has no memory growth or native memory leaks.

Do not force `GC.Collect()` inside gameplay loops as a general optimization. Manual collection can itself introduce disruptive latency.



### Unity production engineering guidelines

For production-level Unity projects, apply the following principles:

- Allocate predictable simulation state during scene initialization, not repeatedly during frame updates.
- Prefer reusable buffers and non-allocating physics query variants when profiling identifies repeated allocations.
- Pool GameObjects that frequently appear and disappear.
- Use `NativeArray<T>` and Burst when a workload is sufficiently large and computationally suitable.
- Keep UnityEngine object access on the appropriate thread; Burst jobs should operate on supported unmanaged data.
- Explicitly complete jobs before accessing shared results or releasing their memory.
- Size pools and buffers around realistic worst-case scenarios and handle capacity exhaustion.
- Measure managed GC allocations, native memory usage, main-thread stalls, and tail frame times independently.

### Unity architecture takeaways

Zero-GC programming in Unity is fundamentally about separating allocation and initialization from continuous gameplay execution.

At the simplest level, this means caching references and reusing arrays.

At an intermediate level, it means preallocating GameObjects, avoiding allocating physics queries, and establishing predictable capacity limits.

At an advanced level, it means building data-oriented simulation pipelines with native collections, explicit memory ownership, Unity Jobs, and Burst compilation.

The result is not merely fewer garbage collections. It is a game architecture designed for predictable execution, efficient data movement, and measurable scalability.

**The best Unity optimization is not the one that uses the most unsafe memory or the most complex job system. It is the one that consistently meets the game's frame-time and memory targets with the lowest necessary complexity.**

## Conclusion

Zero-GC programming is not simply the process of replacing `new` with `stackalloc`, using pointers everywhere, or disabling garbage collection.

It is an architectural discipline focused on memory ownership, allocation frequency, resource lifetimes, predictable execution, and data-oriented design.

In ordinary applications, `Span<T>`, reusable buffers, and allocation-free formatting can eliminate unnecessary temporary objects.

In game engines, contiguous particle storage, preallocated entity state, and data-oriented layouts can reduce garbage collection pressure and improve frame-time stability.

In backend APIs, binary protocols, pooled buffers, and caller-owned memory can support high-throughput processing with fewer allocations.

At the most advanced level, unmanaged arenas and custom allocation strategies provide precise memory-lifetime control, but require explicit safeguards against corruption, leaks, and concurrency errors.

The most important principle is:

**Do not optimize for zero allocations in isolation. Optimize for predictable latency, efficient memory access, measurable throughput, and maintainable correctness.**

A successful high-performance .NET system is not necessarily one that never uses the garbage collector.

It is one that understands precisely where allocations occur, why they occur, and whether they matter to the application's performance objectives.



## References

The examples are designed for modern .NET (version 8 or later) and C# with unsafe code enabled where required.

Microsoft documentation:

- [NativeMemory API](https://learn.microsoft.com/en-us/dotnet/api/system.runtime.interopservices.nativememory)
- [Memory and Span Types](https://learn.microsoft.com/en-us/dotnet/standard/memory-and-spans/)
- [C# stackalloc](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/stackalloc)
- [GC.TryStartNoGCRegion](https://learn.microsoft.com/en-us/dotnet/api/system.gc.trystartnogcregion)
- [GC.GetAllocatedBytesForCurrentThread](https://learn.microsoft.com/en-us/dotnet/api/system.gc.getallocatedbytesforcurrentthread)
- [.NET Runtime Metrics](https://learn.microsoft.com/en-us/dotnet/core/diagnostics/built-in-metrics-runtime)
- [Garbage collection best practices](https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html)
- [Optimize raycasts and other physics queries](https://docs.unity3d.com/6000.0/Documentation/Manual/physics-optimization-raycasts-queries.html)
- [NativeArray<T0>.Dispose](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Unity.Collections.NativeArray_1.Dispose.html)