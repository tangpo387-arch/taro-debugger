---
title: Feature Spec - Context-Aware Debug Toolbar (WI-97)
scope: debug-controls, active-session
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-04-30
---

# Feature Specification: Context-Aware Debug Toolbar

## 1. Purpose

Ensure that debug control buttons (Step, Continue, Stop) act upon the correctly selected active process.

## 2. Scope

- **Included**:
  - Refactoring of `DebugControlGroupComponent`.
  - Integration with `ActiveSessionService`.
  - UI indicators showing which session is being controlled.

## 3. Behavior & Design

- **Targeting**: All outgoing requests from the toolbar (e.g., `continue`, `next`) are routed to the `DapSessionService` instance marked as "active".
- **State Feedback**: The buttons' enabled/disabled states must reflect the `ExecutionState` of the *active* session.

## 4. Acceptance Criteria

- [ ] Clicking "Continue" while Session B is active only resumes Session B.
- [ ] Toolbar button icons (Play/Pause) update immediately when switching active sessions.
- [ ] [Test] Verify that stepping in Session A does not accidentally send a command to Session B.
