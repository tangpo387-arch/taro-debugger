---
title: Command Serialization: Frame Switch Cancel-and-Replace
scope: Variables & Call Stack
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Command Serialization: Frame Switch Cancel-and-Replace (WI-42)

> [!NOTE]
> **Source Work Item**: Command Serialization: Frame Switch Cancel-and-Replace
> **Description**: Implement switchMap-based cancel-and-replace for call stack frame selection in DebuggerComponent per command-serialization.md R-CS3

## Purpose

Enforce strict command serialization for call stack frame selection. When an engineer rapidly selects multiple frames, only the `scopes` and `variables` data for the final selected frame should process; prior pending requests must be silently discarded to prevent UI state divergence.

## Scope

- **Included**: Refactoring the frame-click event handler in the UI layer (`DebuggerComponent` or relevant call stack logic) to use RxJS `switchMap`.
- **Excluded**: Modifications to `DapSessionService` or the core Transport layer.

## Behavior

1. The UI layer detects a frame selection event.
2. The event is pushed into an RxJS Subject/Observable chain.
3. The chain uses `switchMap` to map the event to the asynchronous DAP request (`scopes` -> `variables`).
4. If a new frame is selected while the previous request is pending, `switchMap` unsubscribes from the old inner observable, discarding any stale data.
5. Only the final active subscription updates the Variable UI state.

## Acceptance Criteria

- **AC1**: The UI implements `switchMap` to handle frame selection.
- **AC2**: Stale scopes/variables results from prior frame selections are silently discarded.
- **AC3**: Rapid frame clicks reliably result in only the last selected frame's variables being rendered.

