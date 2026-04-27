---
title: Architecture - Inspection Panels (@taro/ui-inspection)
scope: ui-inspection, variables, call-stack, threads, breakpoints
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/core/session-logic.md
  - architecture/ui-shared.md
---

# Inspection Panels

The `@taro/ui-inspection` library contains the suite of panels used to inspect the debuggee's execution state, including threads, call stacks, variables, and breakpoints.

## 1. Architectural Strategy

- **Three-Layer Pattern**: Enforces strict modularity by decoupling inspection views from the host application shell.
- **Consolidated Logic**: Centralizes all state-inspection components into a single library to maintain a consistent reactive data flow.
- **SSOT Binding**: Every component in this library subscribes directly to the reactive streams in `DapSessionService` or specialized domain services (e.g., `DapVariablesService`).

## 2. Component Portfolio

### 2.1 Threads Panel

Displays the list of active threads and their execution status.
- **Data Source**: `DapSessionService.threads$`.
- **Interactions**: Selecting a thread updates the global `activeThreadId$` and triggers a call stack refresh.
- **Visuals**: Displays "Stopped" markers for threads suspended at a breakpoint.

### 2.2 Call Stack Panel

Renders the stack frames for the currently selected thread.
- **Data Source**: Fetched via `DapSessionService.stackTrace(threadId)`.
- **Frame Selection**: Clicking a frame triggers a synchronized update across the Editor, Variables, and Disassembly views.

### 2.3 Variables Panel

A hierarchical tree view for inspecting local and global variables.
- **Data Source**: Managed by `DapVariablesService`.
- **Persistence**: Scopes and variable states are cleared automatically when execution resumes.

### 2.4 Breakpoints Panel

Provides a centralized list of all breakpoints across the workspace.
- **Data Source**: `DapSessionService.breakpoints$`.
- **Status**: Visualizes the "Verified" status returned by the Debug Adapter.

## 3. UI Layout & Styling

Every inspection panel MUST utilize the standardized structural patterns from `@taro/ui-shared`:

- **Container**: Wrapped in `PanelComponent` for consistent headers and collapsing behavior.
- **Title**: Fixed `32px` height with a `1px` bottom border.
- **Empty States**: Uses `TaroEmptyStateComponent` when no data is available (e.g., "No active threads").

## 4. Reactive Data Flow

```mermaid
sequenceDiagram
    participant DA as Debug Adapter
    participant Sess as DapSessionService
    participant UI as Inspection Panels

    DA->>Sess: stopped event (threadId: 1)
    Sess->>Sess: Update executionState$
    Sess->>UI: Emit threads$ & activeThreadId$
    UI->>Sess: stackTrace(threadId: 1)
    Sess->>UI: Return frames[]
    UI->>UI: Select top frame
    UI->>Sess: variables(frameId: 1)
```

> [Diagram: Sequential flow from a DAP 'stopped' event through thread updates, stack trace fetching, and final variable inspection.]
