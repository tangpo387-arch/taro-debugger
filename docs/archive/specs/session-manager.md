---
title: Feature Spec - DapSessionManager Core (WI-94)
scope: dap-core, session-management, multi-process
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-04-30
---

# Feature Specification: DapSessionManager Core

## 1. Purpose

Enable the debugger to manage multiple concurrent DAP sessions, providing the foundation for multi-process and multi-target debugging.

## 2. Scope

- **Included**:
  - Implementation of `DapSessionManager` in `projects/dap-core`.
  - Refactoring of `DapSessionService` to be instantiable rather than a global singleton (if applicable).
  - Unique identification for each session (`SessionID`).
  - Management of multiple transport instances.
- **Excluded**:
  - UI integration (handled in WI-95, WI-96).
  - Cross-session synchronization (e.g., lock-step execution).

## 3. Behavior & Design

- **Session Lifecycle**: The manager provides methods to `createSession`, `getSession(id)`, and `destroySession(id)`.
- **Event Orchestration**: The manager aggregates events from all sessions and provides a unified stream with session metadata.
- **Transport Association**: Each session owns its `DapTransportService` instance.

## 4. Acceptance Criteria

- [ ] Multiple DAP sessions can be initialized and run concurrently.
- [ ] Each session maintains its own `ExecutionState` and `VerifiedBreakpoint` map.
- [ ] [Test] Verify that starting Session B does not affect the state of Session A.
- [ ] [Test] Verify that disconnecting Session A leaves Session B active.
