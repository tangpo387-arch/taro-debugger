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

</behavioral_constraints>

<agent_navigation>

## 4. Quick Navigation for Agents

Use this decision tree to quickly find the right document based on your current task:

| Task Type | Layer | Primary Agent | Start Here |
| :--- | :--- | :--- | :--- |
| Define or update requirements | — | `Product_Architect` | [system-specification.md](../docs/system-specification.md) + [architecture.md](../docs/architecture.md) (Index) |
| **Write any spec (WI, feature, or data schema)** | — | `Product_Architect` | **MUST read [data-management-spec.md](../docs/data/data-management-spec.md) first** — defines WI schema, status lifecycle, and script behavior |
| Add a new UI feature | **UI** | `Lead_Engineer` | [system-specification.md §3](../docs/system-specification.md#3-view-navigation--layout-specification) for layout spec |
| Use Angular Framework APIs (mat-tree) | **UI** | `Lead_Engineer` | **Skill: `advanced-angular`** |
| Modify visual style or layout | **UI** | `Lead_Engineer` | **Skill: `visual-design`** |
| Modify component local state | **UI** | `Lead_Engineer` | **Skill: `state-management`** — load before touching `@Input`, `BehaviorSubject`, or `async` pipe patterns |
| Modify service reactive state | **Session** | `Lead_Engineer` | **Skill: `state-management`** — load before touching `BehaviorSubject`, `Subject`, or `Observable` streams in services |
| Implement or fix DAP protocol logic | **Session / Transport** | `Lead_Engineer` | **Skill: `dap-implementation`** |
| Add a new transport type | **Transport** | `Lead_Engineer` | **Skill: `dap-implementation`** §6 Transport Extension Guide |
| Write tests | — | `Lead_Engineer` | [test-plan.md](../docs/test-plan.md) + **Skill: `test-case-writing`** |
| What's next to build? | — | `Product_Architect` | [work-items.md](../docs/work-items.md) for pending items |
| Manage work item lifecycle | — | `Product_Architect` | **Skill: `work-item-management`** |
| Check v1.0 scope boundary | — | All Agents | [future-roadmap.md](../docs/future-roadmap.md) — confirm a feature is **not** a v1.1+ item before implementing |
| Understand the state machine | **Session** | `Lead_Engineer` | **Skill: `state-management`** |
| Review code for quality | — | `Quality_Control_Reviewer` | [code-style-guide.md](rules/code-style-guide.md) + **Skills: `dap-implementation`, `state-management`** (as applicable) |
| Find which file to modify | — | All Agents | [file-map.md](../docs/file-map.md) for source file responsibility map |
| Review DAP services / transport / session | **Session / Transport** | `Quality_Control_Reviewer` | **Skill: `dap-implementation`** |
| Review component / service state flow | **UI / Session** | `Quality_Control_Reviewer` | **Skill: `state-management`** |
| Review any `*.spec.ts` file | — | `Quality_Control_Reviewer` | **Skill: `test-case-writing`** |
| Review CSS, layout, typography | **UI** | `Quality_Control_Reviewer` | **Skill: `visual-design`** |

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
> For the complete test-writing workflow, mock patterns, and structural rules, you MUST load the **Skill: `test-case-writing`** before implementing any test.

</cli_commands>

<context_sources>

## 7. Agent Context Sources

This table consolidates the authoritative reference documents each role relies on. All paths are relative to the project root.

**Role-Required References** (defines the baseline knowledge boundary each role must possess before any task — this is not an automatic injection mechanism):

| Document | Product_Architect | Lead_Engineer | Quality_Control_Reviewer |
| :--- | :---: | :---: | :---: |
| `docs/README.md` | ✅ | ✅ | ✅ |
| `docs/system-specification.md` | ✅ | ✅ | ✅ |
| `docs/architecture.md` (Index) | ✅ | — | — |
| `docs/file-map.md` | ✅ | ✅ | ✅ |
| `.agents/rules/code-style-guide.md` | — | ✅ | ✅ |
| `docs/data/data-management-spec.md` | ✅ | — | — |

</context_sources>
