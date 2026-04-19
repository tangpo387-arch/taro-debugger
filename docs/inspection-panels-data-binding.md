---
title: Data Binding: Threads and Breakpoints
scope: Variables & Call Stack, Editor Features
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Data Binding: Threads and Breakpoints (WI-70 & WI-71)

> [!NOTE]
> **Source Work Items**: Data Binding: Thread List Integration (WI-70) and Global Breakpoint Synchronization (WI-71)
> **Description**: Implement reactive data flow for thread enumeration and breakpoint synchronization using DapSessionService as SSOT.

## Purpose

To centralize the management of execution threads and program breakpoints within the `DapSessionService` (SSOT), ensuring real-time synchronization between the DAP server, the Monaco editor, and the dedicated side panels.

## Scope

- **Threads**: Lifecycle management of the thread list, selection-driven stack refreshing, and stopped-event triggers.
- **Breakpoints**: Unified state management for UI-initiated mutations and server-side verification responses.

## Exclusions

- This specification does not cover manual thread manipulation (suspending/resuming individual threads).
- Breakpoint condition management and hit-count filters are out of scope for this work item.
- Handling asynchronous `breakpoint` events from the DAP server (dynamically updated verification states post-launch) is out of scope. We will rely solely on the synchronous `setBreakpoints` response.

## API Contract

```typescript
// DapSessionService reactive SSOT declarations
public readonly threads$ = new BehaviorSubject<Thread[]>([]);
public readonly activeThreadId$ = new BehaviorSubject<number | null>(null);

// Keyed by absolute file path (e.g., '/root/src/main.c')
private breakpointsMap = new Map<string, Breakpoint[]>();
public readonly breakpoints$ = new BehaviorSubject<Map<string, Breakpoint[]>>(this.breakpointsMap);
```

## Behavior

### 1. Thread Enumeration Sequence

1. **Trigger**: `DapSessionService` listens for the `stopped` event.

2. **Action**: Upon receiving `stopped`, the service immediately dispatches a `threads` request.
3. **Storage**: The response is mapped to the `threadsSubject: BehaviorSubject<Thread[]>`.
4. **Binding**: `app-threads` subscribes to `threads$` using the `async` pipe. It renders the thread ID, name, and an indicator for the "current" thread.
5. **Selection**:
   - User interaction calls `DapSessionService.setCurrentThread(id)`.
   - This method updates a local `activeThreadId$` and triggers a `stackTrace` request for the selected thread.

### 2. Breakpoint Synchronization

1. **SSOT Storage**: `DapSessionService` maintains a `breakpointsMap: Map<string, Breakpoint[]>` where the key is the absolute file path.
2. **Mutation Flow**:
   - `EditorComponent` emits line changes via `onBreakpointsChange`.
   - `DebuggerComponent` proxies this to `DapSessionService.setBreakpoints(path, lines)`.
   - `DapSessionService` executes the DAP `setBreakpoints` request.
3. **Consistency**:
   - On `setBreakpoints` response, the local `breakpointsMap` is updated with the adapter-verified breakpoints (which may have shifted lines).
   - This ensures the `app-breakpoints` panel always displays the "Verified" state.
4. **Inter-panel Navigation**:
   - `app-breakpoints` dispatches `requestReveal(path, line)` on click.
   - `DebuggerComponent` handles this by triggering the `fileRevealTrigger` observable, which both the File Explorer and Editor subscribe to.

## Acceptance Criteria

- [ ] **Thread Refresh**: The thread list updates automatically every time the debugger stops.
- [ ] **Context Switching**: Selecting a thread in the sidebar correctly updates the Call Stack and Variables view without a full page refresh.
- [ ] **Breakpoint SSOT**: Adding or removing a breakpoint in the Monaco editor gutter results in an immediate update in the Breakpoints sidebar.
- [ ] **Verification Feedback**: Breakpoints in the sidebar show a "verified" status (e.g., solid red vs hollow circle) based on the DAP response.
- [ ] **Navigation**: Clicking a breakpoint in the sidebar successfully opens the correct file and scrolls the line into view.
