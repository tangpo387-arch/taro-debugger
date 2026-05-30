---
name: Project Context & Terminology
description: Global index, terminology outline, and AI workflow boundaries for the Taro Debugger project.
---

# Project Context & Terminology

<critical-instruction>

This document is purely an index and terminology outline. You are STRICTLY FORBIDDEN from including feature specifications, architecture diagrams, or implementation rules here. You MUST route specific logic to dedicated docs or skills.

</critical-instruction>

## 1. Project Overview

* **Goal**: Provide a cross-platform web frontend debugging interface for GDB/LLDB.
* **Architecture**: The project is organized as an **Angular Workspace (Monorepo)**, separating core logic from UI hosts.
* **Language Support**: Focused on **C/C++** (Unix/Windows path handling, pointer-aware state inspection).

### Workspace Structure

| Project / Term | Type | Path | Architectural Responsibility |
| :--- | :--- | :--- | :--- |
| **Host Application** | Application | `projects/taro-debugger-frontend` | `taro-debugger-frontend`. The Angular shell responsible for UI layout, routing, and Electron IPC coordination. |
| **DAP-Core** | Library | `projects/dap-core` | `@taro/dap-core`. Framework-agnostic library containing protocol serialization, types, and core client logic. |

### Tech Stack Requirements

<constraints>

* **Angular**: ">=21" (MUST use Standalone Components only).
* **Styling**: "Angular Material" (TailwindCSS is STRICTLY FORBIDDEN).
* **Editor**: "ngx-monaco-editor-v2".
* **Desktop**: "Electron" (contextBridge / IPC).
* **Protocol**: "DAP" (WebSocket/IPC).

</constraints>

## 2. Terminology

| Term | Definition / Role in Project |
| :--- | :--- |
| **Execution State** | The session lifecycle (Inactive, Launching, Running, Paused) managed by `DapSessionService`. |
| **Standalone Unit** | The mandatory Angular component pattern (Angular 21+); strictly forbidden from using `NgModule`. |
| **Review Package** | A structured handoff doc (`docs/reviews/WI-<ID>.review-package.md`) required before QC review. |
| **Complexity Gate** | A criteria-based check (Load Skill: `[PROJ:FLOW]`) for non-obvious or large architectural changes. |

## 3. Agent Navigation

<workflow>

| Task Type | Layer | Primary Agent | Mandatory Trigger |
| :--- | :--- | :--- | :--- |
| Define or update requirements | — | `Product_Architect` | Load **Skill: `[DEV:ARCH] System Architecture`** |
| Write any feature spec or design document | - | `Product_Architect` | Load **Skill: `[PROJ:FLOW] Work Item Management`** |
| Write or format human-facing documentation (`docs/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `[DEV:DOCS] Documentation Standards`** |
| Modify `docs/architecture.md` or create `docs/architecture/*.md` | — | `Product_Architect`, `Lead_Engineer` | Load **Skill: `[DEV:DOCS] Documentation Standards`** (§8: architecture.md rules) |
| Write or design AI skill prompts (`.agents/skills/`) | — | `Product_Architect`, `Quality_Control_Reviewer` | Load **Skill: `[META:RULE] AI Skill Engineering`** |
| Add a new UI feature | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:ARCH] System Architecture`** |
| Use Angular Framework APIs (mat-tree) | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:ANG] Angular Feature Specs`** |
| Modify visual style or layout | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:VIS] Visual & UI Density`** |
| Modify component local state | **UI** | `Lead_Engineer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Modify service reactive state | **Session** | `Lead_Engineer` | Load **Skill: `[DEV:STATE] Reactive State Flows`** |
| Implement or fix DAP protocol logic | **Session / Transport** | `Lead_Engineer` | Load **Skill: `[DEV:DAP] Protocol Implementation`** |
| Add a new transport type | **Transport** | `Lead_Engineer` | Load **Skill: `[DEV:DAP] Protocol Implementation`** |
| Write tests | — | `Lead_Engineer` | Read `../docs/tests/test-plan-index.md` + Load **Skill: `[DEV:TEST] Test Case Writing`** |
| What's next to build? | — | `Product_Architect` | Read `../docs/project/work-items.md` |
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

</workflow>

### Utility & Management Scripts

<workflow>

| Operation | Command | Constraints |
| :--- | :--- | :--- |
| **Update WI Status** | `node scripts/update-wi.js WI-<ID> <status>` | `<status>` MUST be: `pending`, `done`, `accepted`, `rework`, `abort`, or `proposed`. |
| **Inspect WI** | `node scripts/manage-wi.js show WI-<ID> [field]` | `[field]` is optional (e.g., `details`, `status`, `deps`). |
| **Add WI** | `node scripts/manage-wi.js add AUTO <Group> <Title> ...` | Arguments are positional. Use `AUTO` for automatic ID allocation. |
| **Edit WI** | `node scripts/manage-wi.js edit WI-<ID> --<field> <value>` | Supported flags: `--title`, `--desc`, `--details`, `--deps`, `--size`, `--milestone`. |
| **List Groups** | `node scripts/manage-wi.js list-groups` | Returns a summary table of all functional domains. |
| **Inspect Group** | `node scripts/manage-wi.js inspect-group <Name>` | Returns raw JSON metadata for the specified group. |
| **List Group Items** | `node scripts/manage-wi.js list-group-items <Name> [--status <v>] [--detailed]` | You MUST run `list-groups` first to identify valid `<Name>` values. |
| **Add Group** | `node scripts/manage-wi.js add-group <Name> <Fill> <Stroke> <Desc>` | Positional arguments only. Syncs all derivative Markdown docs. |

</workflow>

## 6. Context Hierarchy & Memory Management

To prevent context bloat and fact duplication, all information MUST be routed to exactly one tier.

| Tier | File | Scope | Strategy |
| :--- | :--- | :--- | :--- |
| **1. Technical Laws** | `GEMINI.md` | Global / Static | Architectural "Constitution" and top-level navigation. |
| **2. AI Personas** | `AGENTS.md` | Behavioral | Role selection, goals, and behavioral constraints. |
| **3. Operational Manual** | `.agents/project-context.md` | Functional / Shared | **Source of Truth** for commands, terminology, and DAP specs. |
| **4. Private Memory** | `MEMORY.md` | Local / Transient | Private notes and machine-specific paths (**NOT committed**). |

<constraints>

- **Precedence**: GEMINI.md > AGENTS.md > project-context.md.
- **NEVER** duplicate facts across tiers (e.g., do not put standard build commands in MEMORY.md).
- **Reloading**: Use `/memory reload` to refresh these sources in an active session.

</constraints>
