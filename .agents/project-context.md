---
name: Project Context & Terminology
description: Global index, terminology outline, and AI workflow boundaries for the Taro Debugger project.
---

# Project Context & Terminology

<critical-instruction>

This document is purely an index and terminology outline. You are STRICTLY FORBIDDEN from including feature specifications, architecture diagrams, or implementation rules here. You MUST route specific logic to dedicated docs or skills.

</critical-instruction>

## 1. Project Overview

<context>

* **Goal**: Provide a cross-platform web frontend debugging interface for GDB/LLDB.
* **Architecture**: The project is organized as an **Angular Workspace (Monorepo)**, separating core logic from UI hosts.
* **Language Support**: Focused on **C/C++** (Unix/Windows path handling, pointer-aware state inspection).

</context>

### Workspace Structure

<context>

| Project | Type | Path | Responsibility |
| :--- | :--- | :--- | :--- |
| `taro-debugger-frontend` | Application | `projects/taro-debugger-frontend` | Angular host application (UI, Routing). |
| `@taro/dap-core` | Library | `projects/dap-core` | Framework-agnostic DAP client logic and types. |

</context>

### Tech Stack Requirements

<constraints>

* **Angular**: ">=21" (MUST use Standalone Components only).
* **Styling**: "Angular Material" (TailwindCSS is STRICTLY FORBIDDEN).
* **Editor**: "ngx-monaco-editor-v2".
* **Desktop**: "Electron" (contextBridge / IPC).
* **Protocol**: "DAP" (WebSocket/IPC).

</constraints>

## 2. Terminology

<context>

| Term | Definition / Role in DAP |
| :--- | :--- |
| **Variables Reference** | A numeric ID used to lazy-load the member contents of complex objects or Scopes. |
| **Source Reference** | An ID used when the source code is not from a physical path but is virtual content provided by the DA. |

</context>

## 3. Behavioral Constraints

<constraints>

* **Path Handling**: C/C++ source code paths may use `/` (Unix) or `\` (Windows). You MUST ensure `DapFileTreeService` and `EditorComponent` parse both formats correctly.

</constraints>

## 4. Agent Navigation

<workflow>

Locate documents based on task:

| Task Type | Layer | Primary Agent | Mandatory Trigger |
| :--- | :--- | :--- | :--- |
| Define or update requirements | — | `Product_Architect` | Load **Skill: `system-architecture`** |
| Write any spec (WI, feature, or data schema) | — | `Product_Architect` | Load **Skill: `work-item-management`** |
| Write or format human-facing documentation (`docs/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `doc-authoring`** |
| Write or design AI skill prompts (`.agents/skills/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `agent-skill-authoring`** |
| Add a new UI feature | **UI** | `Lead_Engineer` | Load **Skill: `system-architecture`** |
| Use Angular Framework APIs (mat-tree) | **UI** | `Lead_Engineer` | Load **Skill: `advanced-angular`** |
| Modify visual style or layout | **UI** | `Lead_Engineer` | Load **Skill: `visual-design`** |
| Modify component local state | **UI** | `Lead_Engineer` | Load **Skill: `state-management`** |
| Modify service reactive state | **Session** | `Lead_Engineer` | Load **Skill: `state-management`** |
| Implement or fix DAP protocol logic | **Session / Transport** | `Lead_Engineer` | Load **Skill: `dap-implementation`** |
| Add a new transport type | **Transport** | `Lead_Engineer` | Load **Skill: `dap-implementation`** |
| Write tests | — | `Lead_Engineer` | Read `../docs/test-plan.md` + Load **Skill: `test-case-writing`** |
| What's next to build? | — | `Product_Architect` | Read `../docs/work-items.md` |
| Manage work item lifecycle | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `work-item-management`** |
| Check v1.0 scope boundary | — | All Agents | Read `../docs/future-roadmap.md` |
| Understand the state machine | **Session** | `Lead_Engineer` | Load **Skill: `state-management`** |
| Review code for quality | — | `Quality_Control_Reviewer` | Read `rules/code-style-guide.md` + Load applicable skills |
| Find which file to modify | — | All Agents | Read `../docs/file-map.md` |
| Review DAP services / transport / session | **Session / Transport** | `Quality_Control_Reviewer` | Load **Skill: `dap-implementation`** |
| Review component / service state flow | **UI / Session** | `Quality_Control_Reviewer` | Load **Skill: `state-management`** |
| Review any `*.spec.ts` file | — | `Quality_Control_Reviewer` | Load **Skill: `test-case-writing`** |
| Review CSS, layout, typography | **UI** | `Quality_Control_Reviewer` | Load **Skill: `visual-design`** |

</workflow>

## 5. Build, Dev & Test Commands

<workflow>

| Operation | Command | Description |
| :--- | :--- | :--- |
| **Build Full App** | `npm run build` | Compiles the main application for production. |
| **Build Library** | `ng build dap-core` | Compiles the @taro/dap-core library. |
| **Dev Server** | `npm start` | Launches a local development server with hot reload. |
| **Run All Tests** | `npm run test -- --watch=false` | Executes all Vitest unit tests in single-run mode. |
| **Test Single File** | `npm run test -- --include=<path/to/file.spec.ts> --watch=false` | Executes tests for a specific file. |
| **Watch Mode** | `npm run test` | Starts the Vitest runner in interactive watch mode. |

</workflow>

<critical-instruction>

All testing commands use Vitest. If executing testing commands, you MUST use the `--` separator to pass arguments through npm to the underlying test runner.
Before implementing any test, you MUST load the **Skill: `test-case-writing`**.

</critical-instruction>

## 6. Agent Context Sources & Knowledge Acquisition

<critical-instruction>

* **Architectural Guidance**: You are STRICTLY FORBIDDEN from pre-reading `docs/architecture.md` or `docs/system-specification.md`. For architectural, layout, or component boundary questions, you MUST load **Skill: `system-architecture`**.
* **Locating Files**: You MUST use `docs/file-map.md` as an index ONLY to locate specific features or source files.

</critical-instruction>
