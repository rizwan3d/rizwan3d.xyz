---
title: "Learning RISC-V Assembly Language by Building an Assembler in C#"
slug: "learning-risc-v-assembly-language-by-building-an-assembler-in-c"
created: "2023-09-20"
updated: "2023-09-20"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "Learning RISC-V Assembly Language by Building an Assembler in C#"
originalPublished: "2023-09-20"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/learning-risc-v-assembly-language-by-building-an-assembler-in-c/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "Learning RISC-V Assembly Language by Building an Assembler in C#"
featuredImageCredit: "Photo by Johannes Plenio on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@jplenio"
---
### Learning RISC-V Assembly Language by Building an Assembler in C#

### Introduction

RISC-V is an open-source instruction set architecture (ISA) that has gained popularity due to its simplicity and flexibility. In this article, we'll explore the fundamentals of RISC-V assembly language by building an assembler in C#. Our goal is to read RISC-V assembly code, identify the instruction type, and convert it into machine code. We'll use Visual Studio as our development environment for this project.

### Setting Up the Project

Let's begin by creating a new project in Visual Studio. We'll build our RISC-V assembler step by step. We mention that we will be building the assembler incrementally, and the first task is to set up a loop to read a file containing RISC-V assembly code and iterate over each line. This loop will serve as the foundation for processing the assembly code.

```
string[] lines = File.ReadAllLines(filePath);

foreach (string line in lines)
{
  // Process the 'line' here, e.g., identify instruction type, parse, and convert to machine code
}
```

### Identifying Instruction Types

RISC-V instructions are categorized into different types: R, U, I, B, S, and J. To determine the type of instruction, we'll use a lookup table for opcodes, func2, and func7. You can find the lookup table in this [file](https://github.com/rizwan3d/SharpRISCV/tree/master/SharpRISCV/Enums).

Here's an example of how to identify the instruction type:

```
switch (opCode)
{
    case (OpCode)0b0110011:
        return InstructionType.R;
    case (OpCode)0b0010111:
        return InstructionType.U;
    case (OpCode)0b0110111:
        return InstructionType.U;
    case (OpCode)0b0010011:
        return InstructionType.I;
    case (OpCode)0b1100011:
        return InstructionType.B;
    case (OpCode)0b0000011:
        return InstructionType.I;
    case (OpCode)0b0100011:
        return InstructionType.S;
    case (OpCode)0b1101111:
        return InstructionType.J;
    default:
        return InstructionType.Unknown;
}c
```

You can find the implementation of this function in the [RiscVAssembler.cs](https://github.com/rizwan3d/SharpRISCV/blob/master/SharpRISCV/RiscVAssembler.cs) file.

### Parsing Instructions

Now that we can identify the instruction type, let's parse each instruction based on its type. We'll start with the R-type instructions, which have the syntax: `op rd, rs1, rs2`.

For example, the instruction `add x10, x1, x2` can be parsed as follows:

```
Regex rTypeRegex = new Regex(@"^(\w+)\s+(\w+),\s+(\w+),\s+(\w+)$");
Match rTypeMatch = rTypeRegex.Match(instruction);
if (rTypeMatch.Success)
{
    return new RiscVInstruction
    {
        Instruction = instruction,
        Opcode = rTypeMatch.Groups[1].Value,
        Rd = rTypeMatch.Groups[2].Value,
        Rs1 = rTypeMatch.Groups[3].Value,
        Rs2 = rTypeMatch.Groups[4].Value,
        Immediate = null,
        InstructionType = InstructionType.R
    };
}
```

You can find the complete implementation of the R-type instruction parser in the [R\_Parser.cs](https://github.com/rizwan3d/SharpRISCV/blob/master/SharpRISCV/Parser/Instruction/R_Parser.cs) file.

### Converting to Machine Code

Once we've parsed an instruction, we can convert it into machine code. Each instruction type has its own format. For R-type instructions, the format is as follows:

```
R type: .insn r opcode6, func3, func7, rd, rs1, rs2
+-------+-----+-----+-------+----+---------+
| func7 | rs2 | rs1 | func3 | rd | opcode6 |
+-------+-----+-----+-------+----+---------+
31      25    20    15      12   7        0
```

For example, the instruction `add x10, x1, x2` is translated into `00000000001000001000010100110011`, where:

- Opcode 6: 0110011
- Rd = 01010
- Func 3 = 000
- Rs1 = 00001
- Rs2 = 00010
- Func7 = 0000000

Here's an example of how to convert the parsed instruction into machine code:

```
string opcode = ((int)instruction.OpcodeBin).ToBinary(7);
string rdBinary = Convert.ToString(int.Parse(instruction.Rd.Substring(1)), 2).PadLeft(5, '0');
string func3 = ((int)instruction.Funct3).ToBinary(3);
string rs1Binary = Convert.ToString(int.Parse(instruction.Rs1.Substring(1)), 2).PadLeft(5, '0');
string rs2Binary = Convert.ToString(int.Parse(instruction.Rs2.Substring(1)), 2).PadLeft(5, '0');
string func7 = ((int)instruction.Funct7).ToBinary(7);

return new MachineCode($"{func7}{rs2Binary}{rs1Binary}{func3}{rdBinary}{opcode}", instruction.Instruction);
```

You can find the complete implementation of machine code generation in the [R\_MachineCode.cs](https://github.com/rizwan3d/SharpRISCV/blob/master/SharpRISCV/MachineCode/R_MachineCode.cs) file.

### Conclusion

In this article, we've embarked on a journey to learn RISC-V assembly language by building an assembler in C#. We've covered the basics of reading RISC-V assembly code, identifying instruction types, parsing instructions, and converting them into machine code. This project serves as a valuable learning experience for understanding the inner workings of RISC-V assembly language and its translation into machine code. To delve deeper into the RISC-V architecture, refer to the [RISC-V Specification](https://riscv.org/wp-content/uploads/2017/05/riscv-spec-v2.2.pdf).

Certainly! Here's the GitHub repository link for the project where you can find the code for building a RISC-V assembler in C#: [SharpRISCV GitHub Repository](https://github.com/rizwan3d/SharpRISCV).

If you find the project helpful and informative, don't forget to give it a star on GitHub to show your support.

In the **next part** of our RISC-V assembly language learning series, we will explore **addressing modes, labels, and offsets**, which are essential concepts for understanding and writing more complex assembly programs. Stay tuned for the next installment!

[rizwan3d/SharpRISCV: SharpRISCV is an implementation of RISC-V assembly in C# (github.com)](https://github.com/rizwan3d/SharpRISCV)
