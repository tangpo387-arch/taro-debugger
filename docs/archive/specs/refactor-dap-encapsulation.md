---
title: Refactor DapSessionService Encapsulation
scope: DAP Transport Layer
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Refactor DapSessionService Encapsulation (WI-89)

> [!NOTE]
> **Source Work Item**: [WI-89](file:///root/taro-debugger/docs/work-items.md)
> **Description**: Make `sendRequest` private, expose high-level methods for `loadedSources` and `source`, and unify execution state access via `executionState$`.

## Overview

The `DapSessionService` currently exposes a generic `sendRequest` method and a synchronous `executionState` getter. This refactoring aims to improve encapsulation and enforce a purely reactive state management pattern for the execution state.

Objectives:
1. **Encapsulate Protocol Details**: Hide the raw command strings and argument structures from the UI layer.
2. **Improve Type Safety**: Provide strongly-typed methods for specific DAP operations.
3. **Unify State Access**: Remove the synchronous `executionState` getter, forcing consumers to use the `executionState$` observable. This ensures that UI components remain reactive and synchronized with the session state.

## Layer Responsibilities

- **Session Layer (`DapSessionService`)**:
  - Act as the Sole Source of Truth (SSOT) for DAP communication.
  - Expose semantic methods (e.g., `loadedSources()`, `source()`).
  - Manage the internal `seq` counter and `pendingRequests` map.
  - Broadcast execution state via `executionState$`.
- **UI Supporting Layer (`DapFileTreeService`)**:
  - Consume semantic methods provided by the Session Layer.
- **UI Layer (Components)**:
  - React to execution state changes via `executionState$`.
  - Avoid imperative checks of the session state.

## API Contract

### New Public Methods in `DapSessionService`

```typescript
/**
 * Get all sources currently loaded by the debug adapter.
 */
public async loadedSources(): Promise<DapResponse> {
  return this.sendRequest('loadedSources', {});
}

/**
 * Get the content of a specific source file.
 */
public async source(args: { sourceReference: number; source?: { path: string } }): Promise<DapResponse> {
  return this.sendRequest('source', args);
}
```

### Access Modifier and State Access Changes

```typescript
// DAP Request
- public sendRequest(command: string, args?: any, timeoutMs: number = 5000): Promise<DapResponse>
+ private sendRequest(command: string, args?: any, timeoutMs: number = 5000): Promise<DapResponse>

// Execution State
- public get executionState(): ExecutionState
+ // Removed. Use executionState$ instead.
```

## Constraints

1. **Backward Compatibility**: The new methods MUST use the same internal `sendRequest` logic to preserve timeout handling and traffic logging.
2. **Test Stability**: Unit tests that explicitly test `sendRequest` or the `executionState` getter must be updated.
3. **UI Impact**:
    - `DapFileTreeService` MUST be updated to use the new methods.
    - `DebugControlGroupComponent` and `DebuggerComponent` MUST be updated to remove reliance on the synchronous `executionState` getter.
    - For one-off checks in event handlers (e.g., `onResume`), use `firstValueFrom(executionState$)`.
