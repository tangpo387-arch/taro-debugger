---
title: Project Context & Terminology
scope: context, terminology, tech-stack, constraints
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-12
related:
  - ../docs/system-specification.md
  - ../docs/architecture.md
---

# Project Context & Terminology

<project_overview>

## 1. Project Overview

* **Goal**: Provide a modern, cross-platform web frontend debugging interface for GDB/LLDB.
* **Tech Stack**:
  * **Frontend**: Angular 21+, Standalone Components.
  * **Styling**: SCSS & Angular Material (TailwindCSS excluded).
  * **Editor**: Monaco Editor (data transmitted via WebSocket).
  * **Protocol**: Debug Adapter Protocol (DAP).
* **Language Support Scope**: Currently focused on **C/C++** language debugging. Therefore, when handling paths, symbols, and pointers, consider Unix/Windows differences and C-style memory layout.

</project_overview>

<terminology>

## 2. Terminology

These two terms have project-specific meanings that differ from their general DAP usage:

| Term | Definition / Role in DAP |
| :--- | :--- |
| **Variables Reference** | A numeric ID used to lazy-load the member contents of complex objects or Scopes. |
| **Source Reference** | An ID used when the source code is not from a physical path but is virtual content provided by the DA. |

</terminology>

<behavioral_constraints>

## 3. Behavioral Constraints

* **Path handling**: C/C++ source code paths may use `/` (Unix) or `\` (Windows). Ensure `DapFileTreeService` and `EditorComponent` can parse both correctly.
* **Async flow**: After `initialize` completes, send `launch`/`attach` as **fire-and-forget**, then `await initialized` event, then send `setBreakpoints` / `configurationDone`, then finally await the `launch`/`attach` response. See rule **[R1]** / **[R3]** in **Skill: `dap-implementation`**.
* **Resource cleanup**: Any WebSocket subscriptions or timers must be cleaned up in `disconnect()` or `ngOnDestroy` to prevent buffer misalignment caused by multiple simultaneous sessions.
* **Source Listing (GDB Restriction)**: In C/C++, fetching source trees is state-dependent. See rule **[R11]** in **Skill: `dap-implementation`** for strict implementation details.

</behavioral_constraints>

<agent_navigation>

## 4. Quick Navigation for Agents

Use this decision tree to quickly find the right document based on your current task:

| Task Type | Layer | Primary Agent | Start Here |
| :--- | :--- | :--- | :--- |
| Define or update requirements | — | `Product_Architect` | [system-specification.md](../docs/system-specification.md) + [architecture.md](../docs/architecture.md) (Index) |
| Add a new UI feature | **UI** | `Lead_Engineer` | [system-specification.md §3](../docs/system-specification.md#3-view-navigation--layout-specification) for layout spec |
| Use Angular Framework APIs (mat-tree) | **UI** | `Lead_Engineer` | **Skill: `advanced-angular`** |
| Modify visual style or layout | **UI** | `Lead_Engineer` | **Skill: `visual-design`** |
| Modify component local state | **UI** | `Lead_Engineer` | **Skill: `state-management`** — load before touching `@Input`, `BehaviorSubject`, or `async` pipe patterns |
| Modify service reactive state | **Session** | `Lead_Engineer` | **Skill: `state-management`** — load before touching `BehaviorSubject`, `Subject`, or `Observable` streams in services |
| Implement or fix DAP protocol logic | **Session / Transport** | `Lead_Engineer` | **Skill: `dap-implementation`** |
| Add a new transport type | **Transport** | `Lead_Engineer` | **Skill: `dap-implementation`** §6 Transport Extension Guide |
| Write tests | — | `Lead_Engineer` | [test-plan.md](../docs/test-plan.md) + [testing-protocol.md](rules/testing-protocol.md) |
| What's next to build? | — | `Product_Architect` | [work-items.md](../docs/work-items.md) for pending items |
| Manage work item lifecycle | — | `Product_Architect` | **Skill: `work-item-management`** |
| Check v1.0 scope boundary | — | All Agents | [future-roadmap.md](../docs/future-roadmap.md) — confirm a feature is **not** a v1.1+ item before implementing |
| Understand the state machine | **Session** | `Lead_Engineer` | **Skill: `state-management`** |
| Review code for quality | — | `Quality_Control_Reviewer` | [code-style-guide.md](rules/code-style-guide.md) + **Skills: `dap-implementation`, `state-management`** (as applicable) |
| Find which file to modify | — | All Agents | [file-map.md](../docs/file-map.md) for source file responsibility map |

</agent_navigation>

<conventions>

## 5. File Naming Conventions

All filenames use `kebab-case`. For the complete suffix patterns (component, service, spec, types, etc.) see [code-style-guide.md §1](rules/code-style-guide.md#1-naming-conventions).

</conventions>

<cli_commands>

## 6. Build, Dev & Test Commands

To maintain consistency across environments, use these standard CLI commands:

| Operation | Command | Description |
| :--- | :--- | :--- |
| **Build Project** | `npm run build` | Compiles the Angular application for production. |
| **Dev Server** | `npm start` | Launches a local development server with hot reload. |
| **Run All Tests** | `npm run test -- --watch=false` | Executes all Vitest unit tests in single-run mode. |
| **Test Single File** | `npm run test -- --include=<path/to/file.spec.ts> --watch=false` | Executes tests for a specific file. |
| **Watch Mode** | `npm run test` | Starts the Vitest runner in interactive watch mode. |

> [!IMPORTANT]
> All testing commands use **Vitest** via the Angular CLI. The `--` separator is required to pass arguments through npm to the underlying test runner.
> For advanced mocking strategies and architectural test rules, you MUST consult [.agents/rules/testing-protocol.md](rules/testing-protocol.md).

</cli_commands>

<context_sources>

## 7. Agent Context Sources

This table consolidates the authoritative reference documents each role relies on. All paths are relative to the project root.

**Always-on references** (loaded as User Rules or read at session start):

| Document | Product_Architect | Lead_Engineer | Quality_Control_Reviewer |
| :--- | :---: | :---: | :---: |
| `docs/README.md` | ✅ | ✅ | ✅ |
| `docs/system-specification.md` | ✅ | ✅ | — |
| `docs/architecture.md` (Index) | ✅ | — | — |
| `docs/file-map.md` | ✅ | ✅ | ✅ |
| `.agents/rules/code-style-guide.md` | — | ✅ | ✅ |
| `.agents/rules/testing-protocol.md` | — | ✅ | ✅ |
| `docs/future-roadmap.md` | ✅ | ✅ | — |
| `docs/project-management.md` | ✅ | ✅ | — |

**On-demand Skills** (loaded only when the task matches the skill's trigger conditions):

| Skill | Trigger | Lead_Engineer | Quality_Control_Reviewer |
| :--- | :--- | :---: | :---: |
| `visual-design` | Modifying CSS, UI layout, typography, or density | ✅ | ✅ |
| **Skill:** `advanced-angular` | Implementing complex Angular components, Material Tree, RxJS cleanup | ✅ | ✅ |
| **Skill:** `dap-implementation` | Modifying DAP services, transport, session lifecycle | ✅ | ✅ |
| **Skill:** `state-management` | Modifying component/service state flow | ✅ | ✅ |
| **Skill:** `work-item-management` | Creating, progressing, or retiring WIs | — | — |

</context_sources>
