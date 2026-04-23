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

### 2. Breakpoint Synchronization (High-Fidelity)

1. **SSOT Storage**: `DapSessionService` maintains a `breakpointsMap: Map<string, VerifiedBreakpoint[]>` where the key is the absolute file path.
2. **Data Model Extension**:
   - `VerifiedBreakpoint` now includes an `enabled: boolean` property (default: `true`).
   - The SSOT broadcasts updates to all subscribers via `breakpoints$`.
3. **UI Implementation (`BreakpointsComponent`)**:
   - **Checkbox Integration**: A `mat-checkbox` for each item allows the user to toggle the `enabled` state.
   - **Location Badges**: Render a badge containing `line[:column]` with `surface-container-high` background and rounded corners.
   - **Inline Actions**:
     - `Remove` (Icon: `close`): Dispatches a removal request for that specific breakpoint.
     - `Edit` (Icon: `edit`): (Placeholder) Opens a dialog for condition editing.
   - **Visual Feedback**:
     - **Verified**: Solid red circle.
     - **Unverified**: Hollow red circle.
     - **Disabled**: Grayed out label and icon.
4. **Inter-panel Navigation**:
   - Clicking the label dispatches `requestReveal(path, line)`.
   - `DebuggerComponent` handles this by triggering the `fileRevealTrigger`.

## Acceptance Criteria

- [ ] **Thread Refresh**: The thread list updates automatically every time the debugger stops.
- [ ] **Context Switching**: Selecting a thread in the sidebar correctly updates the Call Stack and Variables view without a full page refresh.
- [ ] **High-Fidelity Sidebar**: The Breakpoints panel displays checkboxes, file names, relative paths, and location badges (`line:column`).
- [ ] **Enable/Disable Sync**: Toggling the checkbox in the sidebar updates the SSOT; the Editor gutter decoration reflects the disabled state (e.g., lower opacity or different color).
- [ ] **Inline Removal**: Clicking the 'X' button in a breakpoint row immediately removes it from both the sidebar and the editor gutter.
- [ ] **Navigation**: Clicking a breakpoint row successfully opens the correct file and scrolls the line into view.
