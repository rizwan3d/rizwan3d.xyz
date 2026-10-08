---
title: "AI Coding Agents Should Not Hide Memory - Why Stemcode Stores It in Repo Files"
slug: "ai-coding-agents-should-not-hide-memory-why-Stemcode-stores-it-in-repo-files"
created: "2026-05-23"
updated: "2026-05-23"
category: "software-engineering"
description: ""
sourcePlatform: "medium"
sourceUrl: "https://medium.com/@rizwan3d"
canonicalUrl: "https://medium.com/@rizwan3d"
originalTitle: "AI Coding Agents Should Not Hide Memory - Why Stemcode Stores It in Repo Files"
originalPublished: "2026-05-23"
author: "Muhammad Rizwan"
tags: ""
featuredImage: "/assets/images/posts/ai-coding-agents-should-not-hide-memory-why-Stemcode-stores-it-in-repo-files/featured.jpg"
importMethod: "medium-original-export"
importedAt: "2026-10-08"
featured: true
featuredImageAlt: "AI Coding Agents Should Not Hide Memory - Why Stemcode Stores It in Repo Files"
featuredImageCredit: "Photo by Fredy Jacob on Unsplash"
featuredImageCreditUrl: "https://unsplash.com/@thefredyjacob"
---

## AI Coding Agents Should Not Hide Memory - Why Stemcode Stores It in Repo Files

The next big challenge in AI coding agents is not only model intelligence. It is **trust**.

Modern coding agents can read files, write code, run shell commands, review pull requests, and explain unfamiliar systems. That is powerful. But once an agent starts "remembering" project details, a new question appears:

**Where does that memory live, and who can inspect it?**

For software teams, memory is not a small feature. Memory can include architecture decisions, coding conventions, test strategy, risky areas, known bugs, release rules, security assumptions, and lessons learned from previous failures. If that memory is hidden inside an assistant account, a private chat thread, or an invisible vector store, the team cannot easily review it, correct it, or understand why the agent is making certain decisions.

That is the core idea behind Stemcode's approach:

**AI coding agents should not hide memory. Memory should live with the repository.**

Stemcode is a local AI coding agent designed for desktop, terminal, editor, and CI workflows. Its README describes it as a tool that can work inside a real repository while keeping the human in control: understanding codebases, planning changes, editing files, running validation, reviewing diffs, and automating PR review from the same toolchain developers already use.

## The problem with hidden agent memory

Hidden memory sounds convenient at first.

An agent remembers your preferences. It remembers previous conversations. It remembers patterns. It may even remember project-specific details.

But in software engineering, convenience without visibility becomes a risk.

A coding agent that silently remembers old information can make decisions based on stale assumptions. It may apply conventions that no longer exist. It may believe an architecture decision is still valid after the team has changed direction. It may keep repeating a workaround that was only temporary. Worse, developers may not know whether a bad suggestion came from the current code, the model's general knowledge, the prompt, or some hidden memory layer.

That is dangerous because software teams already have a proven system for durable knowledge: **the repository**.

Repos already support history, diffs, pull requests, code review, ownership, blame, comments, and rollback. When a decision matters, teams do not usually store it in someone's private notebook. They store it in documentation, ADRs, README files, test docs, or configuration files.

So why should AI agent memory be different?

## Stemcode's answer: memory as repo files

Stemcode stores structured team memory as ordinary files under:

```
.Stemcode/memory/
```

The documented memory layout includes files such as:

```
architecture.md
conventions.md
decisions.md
known-issues.md
test-strategy.md
lessons.jsonl
```

Stemcode's documentation describes these files as repo-scoped memory that the team can inspect, diff, and version-control. It also states that this is safer than hidden memory because durable notes can go through normal code review and repository history.

That is an important design choice.

It means Stemcode memory is not just "agent state." It becomes part of the engineering system.

A developer can open the memory files. A reviewer can see what changed. A maintainer can reject a wrong memory update. A team can decide what should be committed and what should remain local. The agent's long-term understanding of the project becomes visible instead of mysterious.

## What each memory file is for

The memory structure is practical. It separates different types of project knowledge instead of dumping everything into one large file.

`architecture.md` is for major components, boundaries, data flow, and integration points. In the Stemcode repo itself, the architecture memory explains the project surfaces: CLI terminal UI, desktop GUI, IDE plugins, and ACP JSON-RPC server. It also documents core components such as the shared application layer, conversation pipeline, command system, dependency injection, and tool execution pipeline.

`conventions.md` is for coding style, naming rules, formatting expectations, and workflow habits.

`decisions.md` is for durable technical decisions. In Stemcode's own repo memory, this includes decisions such as Native AOT for the CLI, ACP for IDE integration, singleton lifetime for application services, planning mode with execution tracking, Spectre.Console for terminal UI, and Avalonia for the desktop app.

`known-issues.md` is for risky areas, limitations, bugs, and workarounds.

`test-strategy.md` is for validation guidance. Stemcode's own test strategy memory documents test layers, important `dotnet` commands, coverage expectations, and validation guidance for future changes.

`lessons.jsonl` is for reusable lessons. Stemcode's documentation says lessons help the agent avoid repeating local mistakes, and that memory is local, redacted by default, and write operations require approval unless policy is changed.

This structure matters because good memory is not just storage. Good memory is **organized context**.

## Why repo-based memory is better for teams

Repo-based memory gives teams five major advantages.

First, it is **reviewable**. If the agent wants to update a decision or add a lesson, that change can be inspected like any other code change.

Second, it is **version-controlled**. The team can see when a memory entry was added, changed, or removed.

Third, it is **portable**. The memory travels with the repository instead of being locked inside one user's assistant account.

Fourth, it is **team-owned**. The memory is not private to one developer. It becomes shared project knowledge.

Fifth, it is **debuggable**. When the agent behaves strangely, the team can inspect the memory files and see whether incorrect context influenced the answer.

That is a great improvement over hidden memory. In coding, invisible context is a source of bugs. Visible context is a source of control.

## Memory should influence the agent, not replace verification

Stemcode's documentation makes an important point: it loads non-empty team memory files into the model context as a durable project context, but memory should be treated as the starting context and verified against current files and fresh tool output when correctness matters.

This is the right philosophy.

Memory should help the agent start smarter. It should not make the agent blindly confident.

A good coding agent should use memory like a senior developer uses project notes: useful, but not absolute. The current codebase, tests, build output, and repository state still matter more than old notes.

That balance is important because memory can become stale. Architecture changes. Naming conventions evolve. Test commands get replaced. Deployment flows move from one platform to another. If the agent treats memory as truth forever, it becomes risky. If the agent treats memory as reviewable context, it becomes useful.

Stemcode's approach is stronger because it combines memory with repository inspection, file tools, permission controls, and review workflows.

## Memory writes need permission

The most important part of memory design is not only where memory is stored. It is also **who can change it**.

Stemcode documents that memory writes require approval by default. It also blocks memory writes in read-only profiles, the planning phase, and read-only sandbox mode. Direct writes to `.Stemcode/memory/*` through file editing tools receive a `memory_write` permission tag, so memory approval cannot be silently bypassed.

That is a strong safety boundary.

Without that boundary, an agent could silently rewrite its own long-term instructions. It could add incorrect lessons. It could modify project conventions. It could poison future sessions with bad assumptions.

By making memory writes permissioned, Stemcode treats memory as a sensitive project asset.

That is the right default.

## Stemcode is built around visible control

The repo-memory idea fits the rest of Stemcode's positioning.

Stemcode is not only a chat interface. The README positions it as a local AI coding agent for practical engineering work: local projects, real shells, version-controlled memory, reviewable changes, and explicit approval for sensitive actions.

The project supports multiple product surfaces: desktop app, terminal CLI, VS Code extension, ACP-compatible editor integration, and CI review automation. The documentation also describes provider options including OpenAI, Anthropic, Google AI Studio, OpenRouter, Groq, Cerebras, Ollama, Ollama Cloud, OpenAI-compatible providers, and subscription-style sign-ins.

That matters because memory should not be trapped inside one UI.

A team may use the agent in the terminal. Another developer may use it from VS Code. CI may use it for PR review. The same repo memory can guide all of those workflows because the memory is attached to the workspace, not to one chat screen.

## The deeper idea: AI agents need a software engineering discipline

A lot of AI tooling focuses on model power.

Bigger context windows. Better reasoning. Faster code generation. More tool calls. More integrations.

Those things matter. But coding agents also need software engineering discipline.

They need configuration files. Permission rules. Audit logs. Testable tools. Clear boundaries. Provider abstraction. Sandboxing. Reviewable state. Rollback. CI integration. Project-local instructions. Team-owned memory.

Stemcode's repo-memory design is important because it treats agent context as part of the engineering workflow, not as magical hidden assistant behavior.

That is how serious developer tools should be built.

## A simple example

Imagine a team decides:

```
All API clients must use typed interfaces.
Do not call HTTP clients directly from UI components.
All provider-specific logic must stay behind the provider abstraction.
```

In a hidden-memory system, that rule may live inside a chat history or private model memory. Some developers may benefit from it, others may not. Nobody knows when it changes.

In Stemcode, that rule can live in:

```
.Stemcode/memory/conventions.md
```

Now it can be reviewed, committed, shared, and improved.

When Stemcode later works on the repo, it can load that convention as context. If the agent tries to violate it, the developer can point to the file. If the convention is wrong, the team can update it in a pull request.

That is not just memory.

That is governance.

## Why this matters for open-source projects

For open-source projects, visible memory is even more valuable.

Contributors often arrive without full project history. Maintainers repeat the same explanations again and again. AI agents can help, but only if their project knowledge is transparent.

Repo-based memory can help new contributors understand architecture, conventions, known issues, and testing expectations faster. It can also help maintainers keep the agent aligned with the project's real direction.

Because Stemcode's own repository includes `.Stemcode/memory` files, the project demonstrates the pattern directly instead of only describing it in documentation. The GitHub repo currently contains a `.Stemcode/memory` folder with architecture, conventions, decisions, known issues, lessons, and test strategy files.

That makes the idea concrete.

## The real message

AI coding agents should not become invisible coworkers with invisible memories.

They should become transparent engineering tools.

A good agent should explain what it is doing. It should ask before sensitive actions. It should store durable project knowledge somewhere the team can review. It should respect local policy. It should treat memory as a shared artifact, not a private black box.

That is why Stemcode's repo-based memory is a strong design direction.

It turns memory from hidden assistant state into normal engineering material:

```
Readable.
Diffable.
Reviewable.
Version-controlled.
Team-owned.
```

For developers and teams, that is the difference between using an AI assistant and trusting an AI teammate.

---

## Contribute to the Project:

Stemcode is an open-source project available on GitHub at [https://github.com/rizwan3d/Stemcode](https://github.com/rizwan3d/Stemcode). If you find this tool valuable and helpful, consider giving it a star on GitHub. Your support encourages the continuous improvement of Stemcode.

:::url-preview
https://github.com/rizwan3d/Stemcode
:::