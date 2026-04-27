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

| Project / Term | Type | Path | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Host Application** | Application | `projects/taro-debugger-frontend` | `taro-debugger-frontend`. The Angular shell responsible for UI layout, routing, and Electron IPC coordination. |
| **DAP-Core** | Library | `projects/dap-core` | `@taro/dap-core`. Framework-agnostic library containing protocol serialization, types, and core client logic. |

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

| Term | Definition / Role in Project |
| :--- | :--- |
| **Execution State** | The session lifecycle (Inactive, Launching, Running, Paused) managed by `DapSessionService`. |
| **Standalone Unit** | The mandatory Angular component pattern (Angular 21+); strictly forbidden from using `NgModule`. |

</context>

## 3. Agent Navigation

<workflow>

Locate documents based on task:

| Task Type | Layer | Primary Agent | Mandatory Trigger |
| :--- | :--- | :--- | :--- |
| Define or update requirements | — | `Product_Architect` | Load **Skill: `[DEV:ARCH] System Architecture`** |
| Write any spec (WI, feature, or data schema) | — | `Product_Architect` | Load **Skill: `[PROJ:FLOW] Work Item Management`** |
| Write or format human-facing documentation (`docs/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `[DEV:DOCS] Documentation Standards`** |
| Write or design AI skill prompts (`.agents/skills/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `[META:RULE] AI Skill Engineering`** |
| Add a new UI feature | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:ARCH] System Architecture`** |
| Use Angular Framework APIs (mat-tree) | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:ANG] Angular Feature Specs`** |
| Modify visual style or layout | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:VIS] Visual & UI Density`** |
| Modify component local state | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Modify service reactive state | **Session** | `Lead_Engineer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Implement or fix DAP protocol logic | **Session / Transport** | `Lead_Engineer` | Load **Skill: `[DEV:DAP] Protocol Implementation`** |
| Add a new transport type | **Transport** | `Lead_Engineer` | Load **Skill: `[DEV:DAP] Protocol Implementation`** |
| Write tests | — | `Lead_Engineer` | Read `../docs/test-plan.md` + Load **Skill: `[DEV:TEST] Test Case Writing`** |
| What's next to build? | — | `Product_Architect` | Read `../docs/work-items.md` |
| Manage work item lifecycle | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `[PROJ:FLOW] Work Item Management`** |
| Check v1.0 scope boundary | — | All Agents | Read `../docs/project/future-roadmap.md` |
| Understand the state machine | **Session** | `Lead_Engineer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Review code for quality | — | `Quality_Control_Reviewer` | Read `rules/code-style-guide.md` + Load applicable skills |
| Find which file to modify | — | All Agents | Read `../docs/file-map.md` |
| Review DAP services / transport / session | **Session / Transport** | `Quality_Control_Reviewer` | Load **Skill: `[DEV:DAP] Protocol Implementation`** |
| Review component / service state flow | **UI / Session** | `Quality_Control_Reviewer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Review any `*.spec.ts` file | — | `Quality_Control_Reviewer` | Load **Skill: `[DEV:TEST] Test Case Writing`** |
| Review CSS, layout, typography | **UI** | `Quality_Control_Reviewer` | Load **Skill: `[DEV:VIS] Visual & UI Density`** |

</workflow>

## 4. Build, Dev & Test Commands

<workflow>

| Operation | Command | Description |
| :--- | :--- | :--- |
| **Build Full App** | `npm run build` | Compiles the main application for production. |
| **Build Library** | `ng build <library>` | Compiles the `<library>` library. |
| **Dev Server** | `npm start` | Launches a local development server with hot reload. |
| **Run All Tests** | `npm run test -- --watch=false` | Executes all Vitest unit tests in single-run mode. |
| **Test Watch Mode** | `npm run test` | Starts the Vitest runner in interactive watch mode. |
| **Test Single File** | `npm run test:file -- <project> --include=**/<file.spec.ts> --watch=false` | Executes tests for a specific file. |
| **Doc Linting** | `npm run lint:docs` | Verifies documentation against quality standards. |

### Utility & Management Scripts

| Operation | Command | Constraints |
| :--- | :--- | :--- |
| **Update WI Status** | `node scripts/update-wi.js <WI-ID> <status>` | `<status>` MUST be: `pending`, `done`, `accepted`, `rework`, `abort`, or `proposed`. |
| **Inspect WI** | `node scripts/manage-wi.js show <WI-ID> [field]` | `[field]` is optional (e.g., `details`, `status`, `deps`). |
| **Add WI** | `node scripts/manage-wi.js add AUTO <Group> <Title> ...` | Arguments are positional. Use `AUTO` for automatic ID allocation. |
| **Edit WI** | `node scripts/manage-wi.js edit <WI-ID> --<field> <value>` | Supported flags: `--title`, `--desc`, `--details`, `--deps`, `--size`, `--milestone`. |
| **Group Management** | `node scripts/manage-wi.js <add-group\|show-group\|list-group>` | Use `show-group` to verify existing Feature Group names before adding WIs. |

</workflow>

## 5. Agent Context Sources & Knowledge Acquisition

<critical-instruction>

* **Architectural Guidance**: You are STRICTLY FORBIDDEN from pre-reading `docs/architecture.md` or `docs/system-specification.md`. For architectural, layout, or component boundary questions, you MUST load **Skill: `[DEV:ARCH] System Architecture`**.
* **Locating Files**: You MUST use `docs/file-map.md` as an index ONLY to locate specific features or source files.
* **Testing Protocol Enforcement**: Executing test binaries directly (e.g. `npx vitest`) is an ARCHITECTURAL VIOLATION. You MUST use the project's standard `npm run test` commands defined in the table above.
Before implementing any test, you MUST load the **Skill: `[DEV:TEST] Test Case Writing`**.

</critical-instruction>
