---
title: Feature Spec - Multi-Session Tree Support (WI-96)
scope: ui-inspection, mat-tree, multi-process
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-04-30
---

# Feature Specification: Multi-Session Tree Support

## 1. Purpose

Extend the `ThreadCallStackTreeComponent` to visualize and manage multiple debug sessions (processes) within a single view.

## 2. Scope

- **Included**:
  - Implementation of a `SessionNode` root in the hierarchical tree.
  - Integration with `DapSessionManager` to list all active sessions.
  - Visual indicators for each session's status.
- **Excluded**:
  - Global actions across all sessions (handled in WI-98).

## 3. Behavior & Design

- **Hierarchy**:
  - `Level 1`: **Session Node** (Name, PID, Status).
  - `Level 2`: Threads.
  - `Level 3`: Frames.
- **Auto-Selection**: Selecting any node (Session, Thread, or Frame) within a session's subtree updates the `ActiveSessionService`.

## 4. Acceptance Criteria

- [ ] Tree displays multiple Root nodes when multiple sessions are active.
- [ ] Expanding a new session root correctly fetches its thread list.
- [ ] [Test] Verify that selecting a frame in Session B correctly switches the global active session to Session B.
