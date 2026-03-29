---
title: Project Context & Terminology
scope: context, terminology, tech-stack, constraints
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-03-28
related:
  - ../docs/system-specification.md
  - ../docs/architecture.md
---

# Project Context & Terminology

This document provides core background information for the `taro-debugger` project, helping AI Agents understand the current development environment, integrated technologies, and specialized terminology, to avoid generating logic inconsistent with the language characteristics (e.g., using Java concepts in a C++ context).

## 1. Project Overview

* **Goal**: Provide a modern, cross-platform web frontend debugging interface for GDB/LLDB.
* **Tech Stack**:
  * **Frontend**: Angular 21+, Standalone Components.
  * **Styling**: SCSS & Angular Material (TailwindCSS excluded).
  * **Editor**: Monaco Editor (data transmitted via WebSocket).
  * **Protocol**: Debug Adapter Protocol (DAP).
* **Language Support Scope**: Currently focused on **C/C++** language debugging. Therefore, when handling paths, symbols, and pointers, consider Unix/Windows differences and C-style memory layout.

## 2. Core Architecture Components

* **DapSessionService**: The Single Source of Truth (SSOT) for the entire session. Responsible for coordinating `initialize`, `launch`, `configurationDone` and other requests, as well as `stopped`, `output` and other events.
* **Transport Layer**: Currently uses an abstracted design, with the primary implementation being `WebSocketTransportService`. The design already reserves extensibility for other transport protocols (such as **Serial**, **TCP Direct**) through the `DapTransportService` abstract class and the `createTransport` factory pattern for decoupling.
* **Monaco Editor**: Responsible for displaying source code, the breakpoint column (Glyph Margin), and current execution line highlighting.
  * *Note: Monaco's `deltaDecorations` is the core mechanism for dynamic highlighting.*

## 3. Terminology

| Term | Definition / Role in DAP |
| :--- | :--- |
| **DAP (Debug Adapter Protocol)** | A standard debugging protocol defined by VS Code, serving as the bridge between the frontend and the debugger (Adapter). |
| **Debug Adapter (DA)** | The intermediary layer responsible for translating DAP commands to a specific debugger (e.g., gdb-dap). |
| **Stack Frame** | A single execution level when the program stops. Contains `line`, `column`, `source` and other information. |
| **Thread** | One execution path within the program. Each `stopped` event typically carries a `threadId`. |
| **Variables Reference** | A numeric ID used to lazy-load the member contents of complex objects or Scopes. |
| **Source Reference** | An ID used when the source code is not from a physical path but is virtual content provided by the DA. |

## 4. Behavioral Constraints

* **Path handling**: C/C++ source code paths may use `/` (Unix) or `\` (Windows). Ensure `DapFileTreeService` and `EditorComponent` can parse both correctly.
* **Async flow**: Strictly adhere to the `initialized` → `configurationDone` → `launch/attach` response sequence.
* **Resource cleanup**: Any WebSocket subscriptions or timers must be cleaned up in `disconnect()` or `ngOnDestroy` to prevent buffer misalignment caused by multiple simultaneous sessions.
* **Source Listing (GDB Restriction)**: In C/C++, fetching source trees is state-dependent. See rule **[R11]** in `rules/dap-protocol-specs.md` for strict implementation details.

## 5. Quick Navigation for Agents

Use this decision tree to quickly find the right document based on your current task:

| Task Type | Start Here |
|---|---|
| Add a new UI feature | [system-specification.md §3](../docs/system-specification.md#3-view-navigation--layout-specification) for layout spec |
| Fix a DAP protocol bug | [dap-integration-faq.md](../docs/dap-integration-faq.md) + [dap-protocol-specs.md](rules/dap-protocol-specs.md) |
| Add a new transport type | [architecture.md §2.3](../docs/architecture.md#23-extension-guide) for extension guide |
| Write tests | [test-plan.md](../docs/test-plan.md) + [testing-protocol.md](rules/testing-protocol.md) |
| What's next to build? | [work-items.md](../docs/work-items.md) for pending items |
| Understand the state machine | [architecture.md §3.2](../docs/architecture.md#32-execution-state-machine) |
| Review code for quality | [code-style-guide.md](rules/code-style-guide.md) + [state-management.md](rules/state-management.md) |
| Find which file to modify | [file-map.md](../docs/file-map.md) for source file responsibility map |

## 6. File Naming Conventions

All filenames use `kebab-case`. When creating new files, follow these patterns:

| Type | Pattern | Example |
|---|---|---|
| Component | `<feature>.component.ts` | `variables-panel.component.ts` |
| Component Template | `<feature>.component.html` | `variables-panel.component.html` |
| Component Style | `<feature>.component.scss` | `variables-panel.component.scss` |
| Service | `<domain>-<function>.service.ts` | `dap-session.service.ts` |
| Types / Interfaces | `<domain>.types.ts` | `dap.types.ts` |
| Unit Tests | `<original-name>.spec.ts` | `dap-session.service.spec.ts` |
| Documentation | `kebab-case.md` | `system-specification.md` |
| Agent Rules | `kebab-case.md` (in `.agents/rules/`) | `dap-protocol-specs.md` |
