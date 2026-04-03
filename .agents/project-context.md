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

## 3. Behavioral Constraints

* **Path handling**: C/C++ source code paths may use `/` (Unix) or `\` (Windows). Ensure `DapFileTreeService` and `EditorComponent` can parse both correctly.
* **Async flow**: After `initialize` completes, send `launch`/`attach` as **fire-and-forget**, then `await initialized` event, then send `setBreakpoints` / `configurationDone`, then finally await the `launch`/`attach` response. See [dap-integration-faq.md §2](../docs/dap-integration-faq.md#2-initialization-sequence--constraints) and rule **[R1]** / **[R3]** in `rules/dap-protocol-specs.md`.
* **Resource cleanup**: Any WebSocket subscriptions or timers must be cleaned up in `disconnect()` or `ngOnDestroy` to prevent buffer misalignment caused by multiple simultaneous sessions.
* **Source Listing (GDB Restriction)**: In C/C++, fetching source trees is state-dependent. See rule **[R11]** in `rules/dap-protocol-specs.md` for strict implementation details.

## 4. Quick Navigation for Agents

Use this decision tree to quickly find the right document based on your current task:

| Task Type | Primary Agent | Start Here |
| --- | --- | --- |
| Define or update requirements | `Product_Architect` | [system-specification.md](../docs/system-specification.md) + [architecture.md](../docs/architecture.md) |
| Add a new UI feature | `Lead_Engineer` | [system-specification.md §3](../docs/system-specification.md#3-view-navigation--layout-specification) for layout spec |
| Fix a DAP protocol bug | `Lead_Engineer` | [dap-integration-faq.md](../docs/dap-integration-faq.md) + [dap-protocol-specs.md](rules/dap-protocol-specs.md) |
| Add a new transport type | `Lead_Engineer` | [architecture.md §2.3](../docs/architecture.md#23-extension-guide) for extension guide |
| Write tests | `Lead_Engineer` | [test-plan.md](../docs/test-plan.md) + [testing-protocol.md](rules/testing-protocol.md) |
| What's next to build? | `Product_Architect` | [work-items.md](../docs/work-items.md) for pending items |
| Manage work item lifecycle | `Product_Architect` | [project-management.md](../docs/project-management.md) for WI/TI naming, lifecycle, and archival process |
| Check v1.0 scope boundary | All Agents | [future-roadmap.md](../docs/future-roadmap.md) — confirm a feature is **not** a v1.1+ item before implementing |
| Understand the state machine | `Lead_Engineer` | [architecture.md §3.2](../docs/architecture.md#32-execution-state-machine) |
| Review code for quality | `Quality_Control_Reviewer` | [code-style-guide.md](rules/code-style-guide.md) + [state-management.md](rules/state-management.md) |
| Find which file to modify | All Agents | [file-map.md](../docs/file-map.md) for source file responsibility map |

## 5. File Naming Conventions

All filenames use `kebab-case`. For the complete suffix patterns (component, service, spec, types, etc.) see [code-style-guide.md §1](rules/code-style-guide.md#1-naming-conventions).

## 6. Build and Dev Commands

To maintain consistency across environments, use these standard commands for build and development operations:

| Operation | Command | Description |
| --- | --- | --- |
| **Build Project** | `npm run build` | Compiles the Angular application for production. |
| **Dev Server** | `npm start` | Launches a local development server with hot reload. |

> [!IMPORTANT]
> All testing operations MUST adhere to the standardized commands and mocking strategies defined in [.agents/rules/testing-protocol.md](rules/testing-protocol.md).

## 7. Agent Context Sources

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
| `docs/project-management.md` | ✅ | ✅ | — |
