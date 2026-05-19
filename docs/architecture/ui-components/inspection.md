---
title: Architecture - Inspection Panels (@taro/ui-inspection)
scope: ui-inspection, variables, call-stack, threads, breakpoints
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-05-19
related:
  - architecture/session-layer.md
  - architecture/ui-shared.md
---

# Inspection Panels

The `@taro/ui-inspection` library contains the suite of panels used to inspect the debuggee's execution state, including threads, call stacks, variables, and breakpoints.

## 1. Architectural Strategy

- **Three-Layer Pattern**: Enforces strict modularity by decoupling inspection views from the host application shell.
- **Consolidated Logic**: Centralizes all state-inspection components into a single library to maintain a consistent reactive data flow.
- **SSOT Binding**: Every component in this library subscribes directly to the reactive streams in `DapSessionService` or specialized domain services (e.g., `DapVariablesService`).

## 2. Component Portfolio

### 2.1 Thread Call Stack Panel

Consolidates threads and stack frames into a single hierarchical flat tree view (Process > Thread > Frame) using the `childrenAccessor` API. Supports horizontal scrolling for deep nesting or long function names.
- **Data Source**: Reactive streams from `DapSessionService` (`threads$`, `activeThreadId$`, `stoppedThreads$`, `allThreadsStopped$`).
- **Dynamic Loading**: Threads are loaded globally; stack frames are fetched on-demand when a thread node is expanded.
- **Selection Mode**: Decouples tree navigation from thread selection. Clicking a thread row label toggles expansion only. Selection (Focus) is performed via a dedicated **"Focus"** icon button, ensuring navigational clicks don't inadvertently switch the session's active thread. This button utilizes a `sticky` CSS layout to remain accessible on the right edge of the viewport even when long function names force horizontal scrolling.
- **Signature Formatting**: Employs the `CppSignaturePipe` to automatically parse and collapse overly verbose C++ function signatures (e.g., massive template types and lambdas) into readable shorthand, while exposing the full original signature via an Angular Material tooltip.
- **Auto-Expansion**: Automatically expands the active thread and fetches its call stack upon a *fresh* `stopped` event or active thread transition. Employs a "sticky" expansion flag to maintain state across asynchronous data reloads while explicitly respecting manual user collapse during the same debug pause.
- **Visuals**: Displays dynamic pause icons with tooltips pulled from `stopReason$`. Active threads are prominently marked with an "ACTIVE" badge.

### 2.3 Variables Panel

A hierarchical tree view for inspecting local and global variables rendered via CDK virtual scroll.
- **Data Source**: Managed by `DapVariablesService` (`scopes$`, `getVariables()`).
- **Scope Filtering**: The `Registers` scope is excluded from display via a case-insensitive regex filter (`/^(registers?)$/i`) applied during tree construction. This suppresses the typically noisy register bank displayed by LLDB and GDB.
- **Lazy Loading**: Child variables are fetched on demand when the user expands a node. The first scope (e.g., `Locals`) is auto-expanded on `stopped`.
- **Type Info**: Each variable with a type exposes an `ℹ` (`info_outline`) icon button in the row-actions area. Clicking it opens a CDK Connected Overlay anchored to the button itself, displaying the simplified type (via `CppSignaturePipe`). An expand toggle within the overlay reveals the full raw C++ type string. Clicking the same button again closes the overlay (toggle behavior).
- **Memory Inspection**: Variables with a `memoryReference` expose a `memory` icon button. Clicking it emits `inspectMemoryRequest` with the address as a `bigint`.
- **Row Actions**: Both action buttons reside inside a `.row-actions` container that is `position: sticky; right: 4px`, ensuring they remain visible on the right edge regardless of horizontal scrolling. The container fades in on row hover.
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
