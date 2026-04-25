---
title: Inspection Panels Data Binding
scope: frontend, reactive-state, dap
audience: [Lead_Engineer, Product_Architect, Human Engineer]
---

# Inspection Panels Data Binding

This document outlines the reactive data binding architecture for the inspection panels in the Taro Debugger (Threads, Call Stack, Variables, Breakpoints).

## Threads Integration (WI-70)

- **Single Source of Truth**: `DapSessionService` serves as the centralized SSOT for the active thread state, avoiding fragmented UI state.
- **Data Flow**: `DapSessionService` maintains the `threadsSubject`, `activeThreadIdSubject`, and `stoppedThreadIdSubject`. When the adapter emits a `stopped` event, the system captures the specific `threadId` that triggered the stop and fetches the updated thread list.
- **UI Subscription**: The `@taro/ui-inspection` `ThreadsComponent` subscribes directly via Angular's `async` pipe. It highlights the *Active* thread (selected for inspection) and displays a "Stopped" indicator for the *Trigger* thread using `stoppedThreadId$`.
- **Interaction**: Clicking a thread invokes `setCurrentThread(threadId)`, which emits a synthetic `stopped` event over `eventSubject`. This "ping" triggers the `DebuggerComponent` to re-fetch the call stack for the newly selected thread without direct panel-to-panel coupling.

## Call Stack Integration

- **Trigger Logic**: The Call Stack is refreshed by `DebuggerComponent` whenever a `stopped` event (real or synthetic) is received.
- **Data Fetching**: The component calls `DapSessionService.stackTrace(threadId)` to retrieve frames.
- **Synchronization**: Selecting a frame via `onFrameClick` triggers a serialized RxJS stream (`frameSelected$`) that orchestrates the simultaneous update of:
  - The Source Editor (via `DapFileTreeService`).
  - The Disassembly View (via `DapAssemblyService`).
  - The Variable Inspector (via `DapVariablesService`).

## Variables Integration

- **Derived State Manager**: `DapVariablesService` acts as a local state manager for variables and scopes, decoupled from the core protocol session.
- **Caching Strategy**: To optimize UI performance, it caches variable blocks by `variablesReference`.
- **Lifecycle (R_SM5)**: The cache and scope state are automatically cleared whenever the global `executionState$` transitions away from `'stopped'`.

## Breakpoint Integration (WI-71)

- **SSOT**: `DapSessionService.breakpoints$` is the single source of truth for all verified breakpoints across the workspace.
- **Reactive Loop**:
  1. User toggles a breakpoint in the Editor.
  2. Editor notifies `DebuggerComponent`.
  3. `DapSessionService` sends `setBreakpoints` to the adapter.
  4. Adapter's verified response updates the `breakpoints$` stream.
  5. Editor and Sidebar panels subscribe to `breakpoints$` to render verified status decorations.
