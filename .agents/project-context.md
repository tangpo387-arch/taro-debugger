---
title: Project Context & Terminology
scope: context, terminology, tech-stack, constraints
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-03-30
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

## 2. Terminology

These two terms have project-specific meanings that differ from their general DAP usage:

| Term | Definition / Role in DAP |
| :--- | :--- |
| **Variables Reference** | A numeric ID used to lazy-load the member contents of complex objects or Scopes. |
| **Source Reference** | An ID used when the source code is not from a physical path but is virtual content provided by the DA. |

## 4. Behavioral Constraints

* **Path handling**: C/C++ source code paths may use `/` (Unix) or `\` (Windows). Ensure `DapFileTreeService` and `EditorComponent` can parse both correctly.
* **Async flow**: Strictly adhere to the `initialized` → `configurationDone` → `launch/attach` response sequence.
* **Resource cleanup**: Any WebSocket subscriptions or timers must be cleaned up in `disconnect()` or `ngOnDestroy` to prevent buffer misalignment caused by multiple simultaneous sessions.
* **Source Listing (GDB Restriction)**: In C/C++, fetching source trees is state-dependent. See rule **[R11]** in `rules/dap-protocol-specs.md` for strict implementation details.

## 5. Quick Navigation for Agents

Use this decision tree to quickly find the right document based on your current task:

| Task Type | Primary Agent | Start Here |
|---|---|---|
| Define or update requirements | `Product_Architect` | [system-specification.md](../docs/system-specification.md) + [architecture.md](../docs/architecture.md) |
| Add a new UI feature | `Lead_Engineer` | [system-specification.md §3](../docs/system-specification.md#3-view-navigation--layout-specification) for layout spec |
| Fix a DAP protocol bug | `Lead_Engineer` | [dap-integration-faq.md](../docs/dap-integration-faq.md) + [dap-protocol-specs.md](rules/dap-protocol-specs.md) |
| Add a new transport type | `Lead_Engineer` | [architecture.md §2.3](../docs/architecture.md#23-extension-guide) for extension guide |
| Write tests | `Lead_Engineer` | [test-plan.md](../docs/test-plan.md) + [testing-protocol.md](rules/testing-protocol.md) |
| What's next to build? | `Product_Architect` | [work-items.md](../docs/work-items.md) for pending items |
| Check v1.0 scope boundary | All Agents | [future-roadmap.md](../docs/future-roadmap.md) — confirm a feature is **not** a v1.1+ item before implementing |
| Understand the state machine | `Lead_Engineer` | [architecture.md §3.2](../docs/architecture.md#32-execution-state-machine) |
| Review code for quality | `Quality_Control_Reviewer` | [code-style-guide.md](rules/code-style-guide.md) + [state-management.md](rules/state-management.md) |
| Find which file to modify | All Agents | [file-map.md](../docs/file-map.md) for source file responsibility map |

## 6. File Naming Conventions

All filenames use `kebab-case`. For the complete suffix patterns (component, service, spec, types, etc.) see [code-style-guide.md §1](rules/code-style-guide.md#1-naming-conventions).

## 7. Build and Test Commands

To maintain consistency across environments, use these standard commands for build and test operations:

| Operation | Command | Description |
| :--- | :--- | :--- |
| **Build Project** | `npm run build` | Compiles the Angular application for production. |
| **Run All Tests** | `npm run test -- --watch=false` | Executes all Vitest unit tests in single-run mode. |
| **Test Single File** | `npm run test -- --include=<path/to/file.spec.ts> --watch=false` | Executes tests for a specific file. |
| **Watch Mode** | `npm run test` | Starts the Vitest runner in interactive watch mode. |
| **Dev Server** | `npm start` | Launches a local development server with hot reload. |

> [!NOTE]
> All test commands use **Vitest** via the Angular CLI (`ng test`). Ensure any new test files are named with the `.spec.ts` suffix to be automatically picked up by the runner.

## 8. Team Roles & Boundaries

This section summarises each Agent role's mandate and hard constraints so every agent understands where its authority ends and another's begins.

### 8.1 Role Boundary Table

| Role | Mandate | Hard Constraints |
| :--- | :--- | :--- |
| **Product_Architect** | Translate user ideas into technical specifications; validate modularity, component hierarchy, and DAP coupling. | ① Never writes code. ② Must pause for explicit user approval before finalising specs. ③ Rewrites specs based on feedback. |
| **Lead_Engineer** | Implement production-ready Angular code strictly from approved specifications. | ① Must not deviate from approved architecture. ② Must not assume DAP behaviour not documented in context sources. ③ Follows all rules in `.agents/rules/`. |
| **Quality_Control_Reviewer** | Scrutinise implementations for production-readiness, RxJS memory safety, and DAP sequencing correctness. | ① Never implements code. ② Only reviews, identifies issues, and suggests targeted fixes. |

### 8.2 Agent Context Sources

This table consolidates the authoritative reference documents each role relies on. All paths are relative to the project root.

| Document | Product_Architect | Lead_Engineer | Quality_Control_Reviewer |
| :--- | :---: | :---: | :---: |
| `docs/README.md` | ✅ | ✅ | ✅ |
| `docs/system-specification.md` | ✅ | — | — |
| `docs/architecture.md` | ✅ | — | — |
| `docs/file-map.md` | ✅ | ✅ | ✅ |
| `.agents/rules/dap-protocol-specs.md` | — | ✅ | ✅ |
| `.agents/rules/code-style-guide.md` | — | ✅ | ✅ |
| `.agents/rules/state-management.md` | — | ✅ | ✅ |
| `.agents/rules/testing-protocol.md` | — | ✅ | ✅ |
| `docs/future-roadmap.md` | ✅ | ✅ | — |
