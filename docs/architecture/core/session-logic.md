---
title: Architecture - Advanced Session Logic
scope: session, non-stop-mode, threads, frame-switching
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/session-layer.md
  - architecture/command-serialization.md
---

# Advanced Session Logic

This document covers complex session management scenarios, including multi-threaded execution (Non-Stop Mode) and asynchronous context switching.

## 1. Non-Stop Mode (Multi-Threaded Control)

Non-Stop mode allows threads to execute independently. One thread can be suspended at a breakpoint while others continue to run.

### 1.1 Per-Thread State Tracking

The `DapSessionService` maintains an execution state for every thread in the `threads$` stream.
- **State Transition (Stopped)**: When a `stopped` event is received:
  - The specific `threadId` is marked as `stopped`.
  - If `allThreadsStopped` is `true`, all threads in the system are transitioned to `stopped`.
- **State Transition (Continued)**: When a `continued` event is received:
  - The specific `threadId` is marked as `running`.
  - If `allThreadsContinued` is `true`, all threads are transitioned to `running`.

### 1.2 Independent Controls

In Non-Stop mode, the UI provides per-thread "Pause" and "Continue" actions. These requests are dispatched with the specific `threadId` target, ensuring that the global execution state reflects the union of all thread states.

## 2. Call Stack & Frame Management

### 2.1 Context Switching (R-CS3)

When the user switches between call stack frames, the system enforces a **"Latest Selection Wins"** policy.
- **Mechanism**: The UI uses `switchMap` on the frame selection stream.
- **Behavior**: Selecting a new frame automatically cancels any in-flight `scopes` or `variables` requests for the previous frame. Stale responses are discarded to prevent rendering incorrect data for the active context.

### 2.2 Thread Selection

The "Active Thread" is the primary context for the Variables and Call Stack panels. If the active thread is `running` in Non-Stop mode, these panels must display a "Thread is running" placeholder to prevent stale data inspection.

## 3. Execution State Consolidation

The global `executionState$` (Running vs. Paused) is derived from the thread states:
- If **any** thread is `stopped`, the global state may be considered `Paused` (depending on the "Stop the world" behavior of the adapter).
- In true Non-Stop mode, the global state is a composite, and the UI must rely on the per-thread metadata for granular control.
