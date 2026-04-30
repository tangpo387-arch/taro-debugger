---
title: Feature Spec - Reactive Active-Session Binding (WI-95)
scope: ui-layer, state-management, active-session
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-04-30
---

# Feature Specification: Reactive Active-Session Binding

## 1. Purpose

Provide a mechanism for UI components to dynamically switch their data sources based on the currently selected "Active Session".

## 2. Scope

- **Included**:
  - `ActiveSessionService` in the host application.
  - `activeSession$` observable stream.
  - Subscription logic for functional components (Editor, Variables, Call Stack).
- **Excluded**:
  - Implementation of the selection UI (handled in WI-96).

## 3. Behavior & Design

- **Single Source of Truth**: The `ActiveSessionService` determines which session is "focused".
- **Component Reaction**: When the active session changes, components must:
  - Unsubscribe from the old session's streams.
  - Subscribe to the new session's streams.
  - Clear or refresh their local view state.

## 4. Acceptance Criteria

- [ ] Switching the active session ID updates the source code in the Editor to match the new session's execution point.
- [ ] Variables panel displays the scopes of the active session's current frame.
- [ ] [Test] Verify that UI components correctly "cleanup" subscriptions when a session is destroyed or deselected.
