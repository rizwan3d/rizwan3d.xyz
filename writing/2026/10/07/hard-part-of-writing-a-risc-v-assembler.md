---
title: "The Hard Part of Writing a RISC-V Assembler Isn't Parsing Assembly"
slug: "hard-part-of-writing-a-risc-v-assembler"
created: "2026-10-07"
updated: "2026-10-07"
category: "RISC-V"
description: "Why address resolution, labels, PC-relative offsets, relocations, and executable formats are harder than parsing when building a RISC-V assembler."
sourceUrl: "https://github.com/rizwan3d/SharpRISCV"
featuredImageCreditUrl: "https://unsplash.com/@he_junhui"
featuredImageCredit: "Photo by He Junhui on Unsplash"
featuredImageAlt: "close up of a computer processor chip on circuit-board"
featuredImage: "https://images.unsplash.com/photo-1758549885423-819fd86e04f0"
featured: true
---

When I first started working on a RISC-V assembler, I expected parsing to be the difficult part.

Take something like:

```asm
add x5, x6, x7
```

Parse the mnemonic, read three registers, look up the opcode, generate 32 bits and move on.

And for an instruction like `add`, that is basically what happens.

The interesting problems start when the instruction contains an address.

```asm
loop:
    addi t0, t0, -1
    bne  t0, zero, loop
```

Now the assembler cannot encode `bne` just by looking at the instruction.

It needs to know where `loop` is.

It needs to know where the current instruction is.

It needs to calculate the distance between them.

It needs to validate that the distance can actually be represented by a branch instruction.

And then RISC-V makes things slightly more entertaining by splitting the immediate across several unrelated bit positions inside the final instruction.

That is where an assembler stops being a text parser and starts becoming an address-resolution system.

I ran into this while building **SharpRISCV**, my RISC-V assembler in C#.

The project has changed a lot while I’ve worked on it, but one thing became clear fairly quickly:

**Encoding the opcode is easy. Encoding what the opcode refers to is the real problem.**

## The easy case: R-type instructions

RISC-V's base integer instructions are nice to work with because instructions are fixed at 32 bits.

An R-type instruction has this layout:

```text
31          25 24    20 19    15 14  12 11     7 6       0
+-------------+--------+--------+------+---------+---------+
|   funct7    |  rs2   |  rs1   |funct3|   rd    | opcode |
+-------------+--------+--------+------+---------+---------+
```

Consider:

```asm
add x5, x6, x7
```

For `add`:

```text
funct7 = 0000000
rs2    = 00111
rs1    = 00110
funct3 = 000
rd     = 00101
opcode = 0110011
```

The encoder can be written almost directly from the ISA diagram:

```csharp
uint code = 0;

code |= funct7 << 25;
code |= rs2    << 20;
code |= rs1    << 15;
code |= funct3 << 12;
code |= rd     << 7;
code |= opcode;
```

The result is:

```text
0x007302B3
```

There isn't much mystery here.

That is also roughly how the newer machine-code generators in SharpRISCV work. Instead of constructing binary strings and converting them afterward, each field is shifted directly into its final position inside a `uint`.

I much prefer this approach.

The diagram in the RISC-V specification almost becomes executable documentation.

```text
funct7 -> << 25
rs2    -> << 20
rs1    -> << 15
funct3 -> << 12
rd     -> << 7
opcode -> << 0
```

Then you encounter branches.

## Labels change the architecture of the assembler

Consider this:

```asm
    beq x5, x6, finished

    add x7, x8, x9

finished:
    add x10, x11, x12
```

When the assembler sees:

```asm
beq x5, x6, finished
```

it may not have seen `finished` yet.

You cannot encode an address you don't know.

There are several ways of dealing with this, but the traditional solution is simple and effective:

**assemble the program in multiple passes.**

## Pass one: discover addresses

During the first pass, don't worry about producing final machine code.

Walk through the program and keep track of the current address.

When you find a label:

```asm
finished:
```

store something like:

```text
finished -> 0x00000008
```

in a symbol table.

Conceptually:

```csharp
Dictionary<string, uint> symbols = new();

uint pc = 0;

foreach (var statement in program)
{
    if (statement is Label label)
    {
        symbols[label.Name] = pc;
        continue;
    }

    pc += 4;
}
```

For basic RV32 instructions, advancing by four works because each instruction is four bytes.

Once compressed instructions or directives enter the picture, even that assumption becomes more interesting.

SharpRISCV's newer architecture has a first-pass symbol table for exactly this reason: symbols are associated with addresses before final machine-code generation happens.

Now the second pass can resolve:

```asm
beq x5, x6, finished
```

because `finished` actually means something.

## A label is not the immediate

This is an important distinction.

Suppose:

```text
branch PC     = 0x100
target address = 0x120
```

The branch does not encode:

```text
0x120
```

It encodes the displacement:

```text
0x120 - 0x100 = 0x20
```

So symbol resolution is effectively:

```csharp
offset = symbolAddress - currentInstructionAddress;
```

This looks trivial, but getting this distinction wrong produces binaries that can look perfectly valid.

The opcode is valid.

The registers are valid.

The instruction can be disassembled.

It just jumps somewhere completely wrong.

Those are fun bugs.

## Then RISC-V splits the immediate

If branch immediates were stored as one continuous integer, branch encoding would still be fairly boring.

They aren't.

A B-type instruction is laid out like this:

```text
31     30      25 24    20 19    15 14  12 11      8 7       6      0
+--------+--------+--------+--------+------+----------+---------+--------+
| imm[12]|imm[10:5]| rs2  |  rs1   |funct3| imm[4:1]| imm[11]| opcode |
+--------+--------+--------+--------+------+----------+---------+--------+
```

Look at the immediate ordering:

```text
12
10:5
4:1
11
```

Not:

```text
12:1
```

That is deliberate ISA design, but it means an assembler has to scatter pieces of one number into different locations.

A clean implementation looks something like:

```csharp
uint encoded = 0;

encoded |= ((offset >> 12) & 0x1)  << 31;
encoded |= ((offset >> 5)  & 0x3F) << 25;

encoded |= rs2 << 20;
encoded |= rs1 << 15;
encoded |= funct3 << 12;

encoded |= ((offset >> 1)  & 0xF) << 8;
encoded |= ((offset >> 11) & 0x1) << 7;

encoded |= opcode;
```

This is where I think bitwise code is actually easier to understand than clever abstractions.

You can put the ISA diagram next to the code and verify every field.

That matters because one wrong shift does not usually crash the assembler.

It creates a valid-looking but incorrect instruction.

## Why bit zero disappeared

There is another detail hidden in the branch immediate.

Notice that we encode:

```text
imm[12:1]
```

but not:

```text
imm[0]
```

Branch targets are aligned, so bit zero is always zero.

There is no reason to spend an instruction bit storing information we already know.

This effectively gives the branch more range using the same number of encoded bits.

But it creates a requirement for the assembler.

Before encoding:

```csharp
if ((offset & 1) != 0)
{
    throw new AssemblyException(
        "Branch target must be 2-byte aligned.");
}
```

An assembler should reject values it cannot represent.

Silently chopping bits off an address is much worse than failing compilation.

## Signed offsets are another trap

Backward branches make things more interesting.

```asm
loop:
    ...
    bne t0, zero, loop
```

Now:

```text
target < pc
```

so:

```text
target - pc
```

is negative.

This means the assembler isn't just moving arbitrary unsigned bits around.

It is encoding a signed immediate using two's complement.

You need to check the range before packing it.

Conceptually:

```csharp
if (offset < minimumBranchOffset ||
    offset > maximumBranchOffset)
{
    throw new AssemblyException(
        "Branch target is out of range.");
}
```

Then you deliberately interpret the low bits of the signed value as the encoded immediate.

One thing I've learned from writing this kind of code is that using `uint` everywhere because the final instruction happens to be unsigned can hide mistakes.

Addresses may be unsigned.

**Displacements are not.**

Those are different concepts and ideally should remain different types for as long as possible.

## JAL does it again, differently

The `jal` instruction also contains a PC-relative immediate.

But naturally, it uses a different arrangement.

J-type:

```text
31     30        21 20 19            12 11       7 6        0
+--------+----------+---+---------------+----------+----------+
| imm[20]| imm[10:1]|11 |   imm[19:12]  |    rd    |  opcode |
+--------+----------+---+---------------+----------+----------+
```

So the encoder becomes:

```csharp
encoded |= ((offset >> 20) & 0x1)   << 31;
encoded |= ((offset >> 1)  & 0x3FF) << 21;
encoded |= ((offset >> 11) & 0x1)   << 20;
encoded |= ((offset >> 12) & 0xFF)  << 12;

encoded |= rd << 7;
encoded |= opcode;
```

Again, the operation is simple once the semantics are correct.

The dangerous part is not `|` or `<<`.

The dangerous part is answering these questions correctly:

```text
Is this value an address or an offset?

Relative to which PC?

Is it signed?

How many bits can represent it?

What alignment does the ISA guarantee?

Which immediate bit maps to which instruction bit?
```

If any one of those answers is wrong, the machine-code generator is wrong.

## Don't test an encoder by rewriting the encoder in the test

This is another trap.

Imagine the implementation contains:

```csharp
code |= ((offset >> 12) & 1) << 31;
```

and the test calculates its expected value using:

```csharp
expected |= ((offset >> 12) & 1) << 31;
```

That test feels precise.

But there is a problem.

If your understanding of the instruction format was wrong when writing the implementation, there is a good chance you repeated exactly the same misunderstanding in the test.

Now the implementation is wrong.

The test is wrong.

And everything is green.

For machine-code generation, I prefer test vectors with independently known answers.

For example:

```text
assembly
        ↓
known hexadecimal machine code
```

Ideally those expected values come from another trusted toolchain such as GNU assembler or LLVM.

Then SharpRISCV's output can be compared byte-for-byte.

That tests the result rather than our ability to copy bit shifts twice.

## Pseudo-instructions complicate the meaning of "one instruction"

Assemblers also have to deal with instructions that are not really instructions.

Take:

```asm
li a0, 10
```

Depending on the value and target ISA, the assembler may be able to represent this using a single instruction.

A larger constant may require multiple instructions.

That means this:

```text
one source statement
```

does not necessarily mean:

```text
one 32-bit machine instruction
```

And that matters during the first pass.

Suppose a pseudo-instruction before a label expands into two instructions instead of one.

Every label after it moves by four bytes.

Now symbol resolution depends on instruction expansion.

This is where assembler design starts becoming much more architectural.

The clean pipeline becomes something closer to:

```text
source
  ↓
lexer
  ↓
parser
  ↓
instruction representation
  ↓
pseudo-instruction expansion
  ↓
layout / first pass
  ↓
symbol table
  ↓
encoding / second pass
  ↓
machine code
```

Doing expansion at the wrong stage can make all later addresses incorrect.

## Relocations are the next level

Labels inside one fully known program can often be resolved during assembly.

Real object files introduce another problem.

What if the address is not known yet?

```asm
call some_external_function
```

The assembler may know that the symbol exists conceptually, but not where the linker will place it.

At that point you cannot simply write the final immediate.

Instead, you need to produce information saying roughly:

```text
There is a reference here.

It refers to this symbol.

When the final address is known,
patch these bits using this relocation rule.
```

That is what relocations are for.

And this is where the boundary between:

```text
assembler
```

and:

```text
linker
```

becomes much clearer.

An assembler doesn't always produce finished machine code.

Sometimes it produces machine code containing unfinished address relationships.

## Machine code alone is still not a program

Eventually SharpRISCV reaches another boundary.

Suppose we successfully turn:

```asm
add x5, x6, x7
```

into:

```text
B3 02 73 00
```

on a little-endian system.

Great.

If I save those bytes into:

```text
program.bin
```

I have machine code.

I do not necessarily have something the operating system knows how to execute.

For Linux-style execution, we need an executable format such as ELF.

Now the problem changes again.

The CPU cares about instructions.

The operating system loader cares about the structure surrounding those instructions.

An ELF executable needs information such as:

```text
magic number
architecture
word size
endianness
entry point
program-header location
loadable segments
virtual addresses
permissions
alignment
```

So our assembler pipeline grows again:

```text
assembly
   ↓
parser
   ↓
symbol resolution
   ↓
machine-code generation
   ↓
ELF construction
   ↓
executable file
```

SharpRISCV contains an ELF writer that builds these bytes directly.

That was one of the most useful parts of this project for me because it removes another layer of magic.

Normally we type:

```bash
gcc program.c -o program
```

and get an executable.

There is an enormous amount of machinery hidden inside that command.

Building even a minimal executable manually forces you to confront what an executable actually is.

## ELF starts with bytes, not objects

The beginning is recognizable:

```text
7F 45 4C 46
```

which is:

```text
0x7F 'E' 'L' 'F'
```

After that come fields describing the file.

For example:

```text
ELF class     -> 32-bit or 64-bit
endianness    -> little or big endian
type          -> executable, relocatable, shared...
machine       -> target architecture
entry point   -> first instruction to execute
```

Then program headers tell the operating-system loader which parts of the file need to become memory segments.

That distinction is important:

**ELF file offsets and virtual addresses are not the same thing.**

The loader might take bytes at:

```text
file offset 0x1000
```

and map them to:

```text
virtual address 0x0000000000010000
```

Your branch encoder cares about runtime addresses.

Your file writer cares about file offsets.

Confusing those two coordinate systems is another excellent way to produce an executable that looks reasonable and immediately dies.

## This is why executable generation changes assembler design

Once you generate an executable, addresses exist in several domains:

```text
source positions
instruction offsets
section offsets
file offsets
virtual addresses
symbol addresses
PC-relative displacements
```

Calling all of these:

```csharp
uint address
```

is convenient.

It is also dangerous.

If I were redesigning parts of an assembler today, I would strongly consider representing some of these concepts explicitly:

```csharp
FileOffset
VirtualAddress
InstructionAddress
PcRelativeOffset
SectionOffset
```

They may all eventually contain integers.

But they do not mean the same thing.

A surprising number of systems bugs are really unit-conversion bugs where every value happens to have the type `int`.

## The assembler is really a pipeline of transformations

After working on SharpRISCV, I no longer think about an assembler as:

```text
assembly -> machine code
```

That hides too much.

I think about it more like:

```text
characters
    ↓
tokens
    ↓
syntax
    ↓
instructions
    ↓
expanded instructions
    ↓
layout
    ↓
symbols
    ↓
resolved operands
    ↓
encoded instructions
    ↓
sections / segments
    ↓
executable bytes
```

Each step has a different responsibility.

That separation matters because errors belong to different stages.

```text
Unknown register?
Parser / semantic validation.

Unknown label?
Symbol resolution.

Branch too far?
Instruction encoding.

Missing external symbol?
Relocation / linking.

Wrong entry point?
Executable layout.

Wrong segment permissions?
ELF generation.
```

Once these stages are mixed together, debugging becomes miserable.

## What I learned from building one

The biggest lesson from SharpRISCV wasn't how to shift an opcode into the bottom seven bits of an integer.

You can learn that from the specification in five minutes.

The useful lesson was seeing how many different systems concepts meet inside something as apparently simple as an assembler.

1. Parsing.
1. Instruction-set architecture.
1. Binary representation.
1. Signed arithmetic.
1. Address spaces.
1. Symbol tables.
1. Relocations.
1. Object formats.
1. Operating-system loaders.

And all of them eventually have to agree on the meaning of a few bytes.

That is why I like projects like this.

You start with:

```asm
add x5, x6, x7
```

and think you're learning assembly.

A little later you're reading ELF headers and asking why bit 11 of a branch immediate lives next to the opcode.

At that point the abstractions start disappearing.

And that is usually where programming becomes interesting.

## Contribute to the Project

StemCode is an open-source project available on GitHub. If you find this tool valuable and helpful, consider giving it a star on GitHub. Your support encourages the continuous improvement of StemCode.

:::url-preview
https://github.com/rizwan3d/StemCode
:::

