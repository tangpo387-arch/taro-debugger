---
title: Non-Stop Mode UI Integration
scope: Execution Context Inspection
milestone: v1.1
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Non-Stop Mode UI Integration (WI-79)

> [!NOTE]
> **Source Work Item**: Non-Stop Mode UI Integration
> **Description**: Implement per-thread execution state tracking and UI controls for DAP Non-Stop mode.

## Purpose

Enable the user to interact with multiple threads independently when the debug adapter supports "Non-Stop" mode. This allows one thread to remain suspended at a breakpoint while other threads continue execution, providing a more granular debugging experience for multi-threaded applications.

## Scope

- **DAP-Core**: Extension of the `DapThread` model and the `DapSessionService` reactive state to track per-thread execution status.
- **UI-Inspection Library**: Enhancements to the `ThreadsComponent` to include status indicators and per-thread control actions.
- **Protocol Handling**: Implementation of logic for `continued` events and the handling of `allThreadsStopped`/`allThreadsContinued` flags in `stopped` and `continued` events.

## Behavior

### 1. Per-Thread State Management

The `DapSessionService` will maintain the execution state for each thread:
- **Default State**: Threads are assumed to be `running` unless a `stopped` event is received.
- **Stopped Event**: When a `stopped` event is received, the thread specified by `threadId` is marked as `stopped`. If the `allThreadsStopped` property is `true`, all registered threads are updated to `stopped`.
- **Continued Event**: When a `continued` event is received, the thread specified by `threadId` is marked as `running`. If the `allThreadsContinued` property is `true`, all registered threads are updated to `running`.

### 2. Thread List Visualization

The `ThreadsComponent` will be updated to provide visual feedback:
- **Status Indicators**: A distinct icon or color badge will indicate whether a thread is `Stopped` or `Running`.
- **Active Context**: The "active" thread (the one being inspected) will be highlighted. If the active thread is `running`, the Call Stack and Variables views should display a "Thread is running" placeholder or a loading state.

### 3. Independent Execution Controls

In Non-Stop mode, users can control threads individually:
- **Per-Thread Buttons**: Each list item in the Thread Panel will feature "Pause" or "Continue" buttons that appear on hover or as fixed icons.
- **Action Dispatch**: Clicking a per-thread control will send a `pause` or `continue` request with the specific `threadId` to the Debug Adapter.

## Acceptance Criteria

- [ ] **Data Model**: `DapThread` interface includes a mandatory `state: 'running' | 'stopped'` property.
- [ ] **Reactive State**: `DapSessionService.threads$` emits updated lists with correct state metadata upon receiving `stopped` or `continued` events.
- [ ] **UI Feedback**: The thread list successfully renders status icons and toggles between Pause/Continue buttons based on the thread state.
- [ ] **Independent Control**: The system correctly handles multiple threads in mixed states (some running, some stopped) without UI flickering or global state corruption.
- [ ] **Self-Verification**: [Test] `wi-79-non-stop.spec.ts` verifies that a `continued` event for Thread A does not transition Thread B from `stopped` to `running`.
