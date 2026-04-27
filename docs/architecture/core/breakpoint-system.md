---
title: Architecture - Breakpoint Management System
scope: breakpoints, editor, session, serialization
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/command-serialization.md
  - architecture/ui-components/editor.md
---

# Breakpoint Management System

The breakpoint system coordinates user interactions in the source editor with declarative `setBreakpoints` updates in the Debug Adapter Protocol (DAP).

## 1. Interaction Flow

The system uses a distributed approach to ensure high performance and protocol integrity:

1. **UI Mutation**: User clicks the gutter in the `EditorComponent`.
2. **Jitter Filtering**: The UI layer debounces these clicks (150ms) per file.
3. **Protocol Dispatch**: The Session layer dispatches a declarative `setBreakpoints` request containing the *complete* list of breakpoints for the affected file.
4. **Serialization**: The Session layer ensures only one update is in-flight per file at any time.

## 2. Jitter Filtering (UI Layer)

To prevent redundant protocol traffic from rapid gutter interactions:
- **Mechanism**: RxJS `Subject` with `debounceTime(150)`.
- **Grouping**: Mutations are grouped by file path. A click on `file_a.cpp` does not debounce a click on `file_b.cpp`.
- **Local Response**: The UI updates markers immediately to provide instant feedback, while the server sync happens in the background.

## 3. Per-File Serialization (Session Layer)

DAP's `setBreakpoints` expects the latest state. To prevent race conditions or out-of-order responses:
- **State Map**: A map tracks `{ inFlight: boolean; pending: lines[] | undefined }` keyed by file path.
- **Last-Write-Wins**: If an update for File X is in-flight, any new mutations are stored in the `pending` slot, overwriting previous pending updates for that file.
- **Dispatch**: Upon response settlement, the system checks the `pending` slot and immediately dispatches a new request if an update is waiting.

## 4. Parallelism Constraints

- **File Isolation**: Requests for different file paths are fully independent and execute in parallel.
- **Session State**: Breakpoint updates are permitted only when the session is `Running` or `Paused`. Updates during `Launching` are queued until the handshake completes.

---

## 5. Performance Verification (AC)

- **Debounce**: 5 clicks in 100ms on the same file = 1 protocol request.
- **Parallelism**: A slow response from `file_a.cpp` must not block a request for `file_b.cpp`.
- **Ordering**: The final state of the Debug Adapter must always match the user's *last* interaction.
