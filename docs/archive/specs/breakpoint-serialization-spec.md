---
title: Command Serialization: setBreakpoints Debounce + Per-File Serialization
scope: Editor Features
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Command Serialization: setBreakpoints Debounce + Per-File Serialization

> [!NOTE]
> **Source Work Item**: Command Serialization: setBreakpoints Debounce + Per-File Serialization
> **Description**: Implement per-file debounce and last-write-wins serialization for setBreakpoints per command-serialization.md R-CS4

## Purpose

The `setBreakpoints` command in the Debug Adapter Protocol (DAP) is declarative: it expects the *complete* list of breakpoints for a given file. Rapid UI interactions (multiple clicks in the gutter) can lead to interleaved requests and out-of-order responses, causing the Debug Adapter's state to diverge from the UI. This specification implements a per-file serialization and debounce mechanism to ensure consistency.

## Scope

- **UI Layer**: `EditorComponent` (debounce click events).
- **Session Layer**: `DapSessionService` (manage per-file in-flight status and pending updates).
- **Protocol**: DAP `setBreakpoints` request.

## Behavior

### 1. UI-Level Debounce (R-CS4.UI)

The `EditorComponent` shall maintain a stream of breakpoint mutation events.
- **Mechanism**: Use RxJS `Subject` and `debounceTime(150)`.
- **Grouping**: Mutations are grouped by file path. A click on file A does not debounce a click on file B.
- **Dispatch**: After the debounce window, the latest consolidated line list for that file is sent to `DapSessionService.setBreakpoints(path, lines)`.

### 2. Session-Level Serialization (R-CS4.Session)

The `DapSessionService` (or a dedicated internal state manager) shall enforce per-file serialization:
- **State Map**: Maintain a `Map<string, { inFlight: boolean; pending: number[] | undefined }>` keyed by source path.
- **Request Guard**:
  - If `inFlight` is `true` for a path, the new request is stored in the `pending` slot (last-write-wins). The caller receives a `Promise` that resolves when the *initial* request completes (or we could choose to not wait).
  - If `inFlight` is `false`, set `inFlight = true` and dispatch the DAP request.
- **Completion Logic**:
  - Upon receiving a response (success or error) for file X:
    - Set `inFlight = false` for file X.
    - If `pending` contains a list, immediately clear `pending` and re-invoke `setBreakpoints(path, pending)`.

### 3. Parallelism

Requests for different file paths are fully independent. Serializing file A must not block or delay a request for file B.

## Acceptance Criteria

1. **Debounce Verification**: Rapidly clicking the gutter 5 times within 100ms on the same file results in exactly one `setBreakpoints` request to the Debug Adapter.
2. **Serialization Verification**: If a request for `file_a.cpp` is in-flight and a new mutation occurs, the second request is deferred until the first one returns.
3. **Parallel Verification**: A request for `file_a.cpp` does not prevent a request for `file_b.cpp` from being sent immediately.
4. **Ordering Verification**: The final state of the Debug Adapter must match the *last* user interaction, regardless of how many clicks occurred while a request was in-flight.
5. **Error Resilience**: If an in-flight request fails, the `pending` update is still dispatched.
