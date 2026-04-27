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

- **Included**:
  - Refactoring `onFrameClick` in the `DebuggerComponent` to use an RxJS `Subject` and `switchMap` to serialize `readFile` and `fetchInstructions` requests.
  - Refactoring `DapVariablesService` to prevent Promise race conditions during `fetchScopes` (e.g., tracking the latest `frameId` or using an internal `switchMap`), ensuring stale `scopes` responses do not mutate the `scopesSubject`.
- **Excluded**: Modifications to `DapSessionService` or the core Transport layer.

## Behavior

1. The user clicks a frame in `CallStackComponent`, emitting an event to `DebuggerComponent`.
2. `DebuggerComponent` pushes the event into an RxJS Subject (`frameSelected$`).
3. The chain uses `switchMap` to serialize asynchronous UI operations (Source fetch, Disassembly fetch).
4. For variable extraction, `DapVariablesService` guarantees that rapid concurrent calls to `fetchScopes` will only mutate `scopesSubject` for the most recently requested `frameId`.
5. Stale responses from prior in-flight requests are silently discarded.

## Acceptance Criteria

- **AC1**: `DebuggerComponent` implements `switchMap` to handle frame selection orchestration (source code and disassembly).
- **AC2**: `DapVariablesService` implements an anti-race guard to prevent stale scopes from overwriting the active variable state.
- **AC3**: Rapid frame clicks reliably result in only the last selected frame's source, disassembly, and variables being rendered.
