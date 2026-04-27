---
title: Design Proposal - Merging 'terminated' and 'idle' Execution States
scope: architecture, session-layer, state-machine
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-26
status: proposed
---

# Design Proposal: Merging 'terminated' and 'idle' States

## 1. Problem Statement

The `DapSessionService` currently defines six execution states: `idle`, `starting`, `running`, `stopped`, `terminated`, and `error`.

Analysis reveals several issues:
1. **Redundancy**: UI treats `idle` and `terminated` as functionally identical.
2. **Transient Nature**: `terminated` is used as a temporary guard before `reset()` in `disconnect()`.
3. **Session Leak**: Server-initiated `terminated` events transition to `terminated` state but do not call `reset()`. Since `disconnect()` returns early if state is `terminated`, the transport remains open and data stays stale.

## 2. Proposed Solution

Merge `terminated` into `idle`. Redefine `idle` as "Inactive".

### 2.1 State Machine Changes

Updated `ExecutionState`:

```typescript
type ExecutionState = 'idle' | 'starting' | 'running' | 'stopped' | 'error';
```

### 2.2 Functional Changes

- **DAP Events**: `terminated` or `exited` now trigger `this.reset()`.
- **`isDisconnecting` Flag**: Private flag blocks concurrent calls during async handshake.
- **UI**: Remove `isTerminated$` checks.

## 3. Acceptance Criteria

1. `ExecutionState` type is reduced to 5 members.
2. Server `terminated` events trigger `DapSessionService.reset()`.
3. UI buttons use only `isIdle$` for inactive state logic.
4. `DapSessionService.disconnect()` works after server termination.
