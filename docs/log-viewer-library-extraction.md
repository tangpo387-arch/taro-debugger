---
title: Library Extraction: LogViewerComponent
scope: Console & Status Bar
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Library Extraction: LogViewerComponent (WI-67)

> [!NOTE]
> **Source Work Item**: Library Extraction: LogViewerComponent
> **Description**: Extract LogViewerComponent into a dedicated library @taro/ui-console and modularize it into separate sub-components for better maintainability.

## Purpose

The current `LogViewerComponent` is a monolithic component residing in the main application. It handles both program output (stdout/stderr) and the debug console (expression evaluation and system logs). This extraction aims to:
- **Improve Modularity**: Isolate console and output logic into a reusable library.
- **Enhance Maintainability**: Split the monolith into smaller, focused sub-components.
- **Standardize UI**: Ensure all console-like interfaces follow the "Flush IDE" visual design rules.

## Scope

### Included

- Creation of `@taro/ui-console` library.
- Implementation of `DebugConsoleComponent`: Handles expression evaluation input and system log display.
- Implementation of `OutputConsoleComponent`: Handles program output display.
- Implementation of `LogViewerComponent` (Orchestrator): Manages the tabbed interface between the consoles.
- Relocation of `DapLogService` to the library or maintaining it as a shared service if required (currently shared).
- Migration of SCSS styles to the library, adhering to `visual-design.md`.

### Excluded

- Modification of `DapSessionService` core logic.
- Implementation of the DAP Protocol Inspector (reserved for WI-68).

## Behavior

### 1. Component Hierarchy

- `LogViewerComponent` (Library Export)
  - `mat-tab-group` (Orchestrator)
    - `mat-tab` (Label: "Debug Console")
      - `app-debug-console`
    - `mat-tab` (Label: "Output")
      - `app-output-console`

### 2. Data Flow

- All sub-components inject `DapLogService` (SSOT) to access log streams.
- `DebugConsoleComponent` injects `DapSessionService` to perform `evaluate` requests and manage `executionState`.
- Both consoles use `cdk-virtual-scroll-viewport` for performant rendering.

### 3. Visual Requirements

- **Flush Tabs**: Use the "Surface Fusion" metaphor from `visual-design.md §8.2`.
- **Auto-scroll**: Both consoles must automatically scroll to the bottom on new entries, with a short debounce to prevent thrashing.
- **Evaluation Input**: The "Debug Console" input must be gated by `executionState` (disabled when program is running) and support request cancellation.

## Acceptance Criteria

- [ ] `@taro/ui-console` library is created and exports `LogViewerComponent`.
- [ ] `LogViewerComponent` is split into `DebugConsole` and `OutputConsole` sub-components.
- [ ] `DebuggerComponent` consumes `@taro/ui-console` via the library import.
- [ ] Virtual scroll behaves correctly in both tabs (no jitter, correct `itemSize`).
- [ ] "Debug Console" evaluation functions correctly and shows "system" category logs.
- [ ] "Output" tab correctly shows "stdout"/"stderr" category logs.
- [ ] UI adheres to `visual-design.md` (32px tab headers, 1px dividers, surface fusion background).
- [ ] [Test] All unit tests for `log-viewer.component.ts` are migrated and pass in the library.
- [ ] [Test] Integration test confirms `DebuggerComponent` renders the library component without layout regression.
