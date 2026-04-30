---
title: Feature Spec - Global Debug Lifecycle Actions (WI-98)
scope: debug-controls, multi-session-control
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-04-30
---

# Feature Specification: Global Debug Lifecycle Actions

## 1. Purpose

Provide batch operations to manage all active debugging sessions simultaneously (e.g., stopping all processes).

## 2. Scope

- **Included**:
  - "Stop All" and "Restart All" commands.
  - Confirmation dialog integration for batch termination.
  - `DapSessionManager` orchestration for batch commands.

## 3. Behavior & Design

- **Stop All**: Iterates through all registered sessions in `DapSessionManager` and calls `stop()` on each.
- **Restart All**: Performs a sequential or parallel restart of all active sessions.
- **Safety**: Terminating the "primary" session may optionally prompt to terminate dependent sessions.

## 4. Acceptance Criteria

- [ ] "Stop All" successfully terminates 3+ concurrent sessions.
- [ ] UI correctly transitions to `idle` state only after the last session is closed.
- [ ] [Test] Verify that batch operations correctly handle sessions in different states (e.g., some running, some stopped).
