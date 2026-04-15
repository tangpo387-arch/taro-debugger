---
title: Architecture - Command Serialization
scope: architecture, command-serialization, session-layer, ui-layer, dap-cancel
audience: [Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-15
related:
  - ../architecture.md
  - session-layer.md
  - ui-layer.md
  - ../../.agents/skills/dap-implementation/SKILL.md
---

# Command Serialization

> [!IMPORTANT]
> **Exclusions**: This document does not cover the DAP handshake sequence (`initialize` →
> `launch`/`attach` → `configurationDone`) — that flow is already serialized by the
> `startSession()` async chain in `session-layer.md §5`. Read-only query commands
> (`stackTrace`, `scopes`, `variables`, `loadedSources`, `source`) are also excluded.

## 1. Overview

Three UI interaction surfaces require strict one-at-a-time serialization to prevent
interleaved DAP messages reaching the Debug Adapter (DA) before it has transitioned state.

| Rule | Interaction Surface | Semantic |
| :--- | :--- | :--- |
| **R-CS1** | Control buttons (Continue / Next / Step In / Step Out / Pause / Stop) | Drop — second command while in-flight is silently discarded |
| **R-CS2** | Evaluate command (console input) | Cancel-able — in-flight can be interrupted; auto-timeout at 30 s |
| **R-CS3** | Call stack frame switch | Cancel-and-replace — latest selection wins; prior in-flight chain is discarded |
| **R-CS4** | Breakpoint gutter click (`setBreakpoints`) | Debounce (150 ms) + per-file last-write-wins; distinct files are independent |
| **R-CS5** | Stop / Disconnect button (`disconnect` / `terminate`) | One-shot guard — calls after first dispatch are no-ops until `reset()` |

---


## 2. R-CS1: Control Button Serialization

### Behavior

- When any execution-control command is dispatched:
  - If a prior control command has not yet received its response, the new click is **silently dropped** (no queue, no retry).
  - All control buttons enter a **disabled state** immediately on click.
  - Buttons re-enable when the command response is received (resolved or rejected) **or** when the `executionState$` transitions via a DAP `stopped` / `continued` / `terminated` event.
- Rationale: Sending a second control command before the first state transition is confirmed is a DAP protocol violation.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Guard against duplicate dispatch | **Session** (`DapSessionService`) | `private commandInFlightSubject = new BehaviorSubject<boolean>(false)` guards each of `continue()`, `next()`, `stepIn()`, `stepOut()`, `pause()` |
| Button disabled binding | **UI** (`DebuggerComponent`) | `[disabled]="commandInFlight$ \| async"` |

### New Session Layer Observable

```typescript
// Emits true while any execution-control command is in-flight; false when idle.
public readonly commandInFlight$: Observable<boolean>;
```

Implemented as a `BehaviorSubject<boolean>` initialized to `false`. Set to `true`
immediately before `sendRequest()` is called; reset to `false` on promise settlement.

---

## 3. R-CS2: Evaluate Command

### Capability Pre-Check

`supportsCancelRequest` is a **mandatory capability** for the `evaluate` feature.

- After `initialize` response, Session reads `capabilities.supportsCancelRequest`.
- If `false` or absent: `evaluateInFlight$` is permanently set to a terminal state and the
  evaluate input is **permanently disabled** with tooltip:
  `"Evaluate not supported: this debug adapter does not support request cancellation."`
- No fallback (e.g., `pause`) is attempted — the feature simply does not activate.

### In-Flight State

When an `evaluate` request is submitted:

| Element | Behavior |
| :--- | :--- |
| Submit button | Replaced by a **Cancel** button (`mat-icon-button` with stop icon) |
| Input field | Set to `readonly`; preserves the submitted expression for reference |
| Loading indicator | Inline spinner shown alongside the Cancel button |

### Cancel Mechanism

When the user clicks Cancel:

1. **UI Layer** — optimistically resets immediately (input editable, Cancel → submit button). Does **not** wait for DAP cancel acknowledgement.
2. **Session Layer** — calls `cancelRequest(pendingEvaluateSeq)` → dispatches a DAP `cancel` request for the stored `seq`.
3. The in-flight `evaluate` promise rejects with `EvaluateCancelledError`.

```typescript
class EvaluateCancelledError extends Error {
  constructor() { super('Evaluate cancelled by user'); }
}
```

### Auto-Timeout Fallback

Every `evaluate` call is wrapped with a 30-second timeout:

```typescript
// Session Layer — evaluate() implementation sketch
public evaluate(expression: string, frameId?: number): Promise<DapResponse> {
  const TIMEOUT_MS = 30_000;
  return Promise.race([
    this.sendRequest('evaluate', { expression, frameId, context: 'repl' }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new EvaluateCancelledError()), TIMEOUT_MS)
    ),
  ]);
}
```

On timeout, the same cancel flow is triggered automatically and a snackbar warns:
`"Evaluate timed out. The debugger may be unresponsive."`

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Capability gate | **Session** (`DapSessionService`) | Check `capabilities.supportsCancelRequest` after `initialize` |
| In-flight signal | **UI** (`LogViewerComponent`) | `private evaluateInFlight$ = new BehaviorSubject<boolean>(false)` — isolated from `commandInFlight$` |
| Pending seq storage | **UI** (`LogViewerComponent`) | `private pendingEvaluateSeq: number \| undefined` |
| Cancel dispatch | **Session** (`DapSessionService`) | `public cancelRequest(requestId: number): Promise<void>` |
| Timeout guard | **Session** (`DapSessionService`) | `Promise.race` inside `evaluate()` |
| Auto-timeout snackbar | **UI** (`LogViewerComponent`) | Catch `EvaluateCancelledError` with `source === 'timeout'` flag |

### New Session Layer API

```typescript
/**
 * Sends a DAP `cancel` request for the given in-flight request.
 * No-op if called after session disconnect.
 * Pre-condition: capabilities.supportsCancelRequest must be true.
 * @param requestId - The `seq` of the request to cancel.
 */
public cancelRequest(requestId: number): Promise<void>;

/**
 * Sends a DAP `evaluate` request with a built-in 30 s cancel timeout.
 * Rejects with EvaluateCancelledError on user cancel or timeout.
 * Returns the full DAP response on success.
 */
public evaluate(expression: string, frameId?: number): Promise<DapResponse>;
```

---

## 4. R-CS3: Call Stack Frame Switch

### Behavior

- When the user clicks a new call stack frame row while a prior `scopes` → `variables`
  chain is in-flight: the in-flight chain is **discarded** and a fresh `scopes` request
  is dispatched for the newly selected frame.
- "Latest selection wins" — stale responses from the prior chain are never rendered.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Cancel-and-replace | **UI** (`DebuggerComponent` / call stack component) | `switchMap` on user frame-click stream — outer emission cancels the inner subscription |
| No Session Layer change | **Session** | `stackTrace`, `scopes`, `variables` remain unchanged — no guard needed |

```typescript
// UI Layer — frame switch pattern
frameSelected$.pipe(
  switchMap(frame => this.session.scopes(frame.id).then(/* ... */))
).subscribe(/* update variable display */);
```

> [Diagram: Frame selection stream → switchMap cancels prior in-flight scopes/variables
> chain → new scopes request dispatched → variables fetched for selected frame.]

---

## 5. Signal Isolation Summary

| Signal / Guard | Owner | Scope | Consumers |
| :--- | :--- | :--- | :--- |
| `commandInFlight$` | `DapSessionService` | Control button commands only | `DebuggerComponent` (button `[disabled]`) |
| `evaluateInFlight$` | `LogViewerComponent` | Evaluate command only | `LogViewerComponent` template (Cancel/submit swap) |
| `pendingEvaluateSeq` | `LogViewerComponent` | Single in-flight evaluate seq | `LogViewerComponent.onCancelEvaluate()` |
| `breakpointFileState` map | `DapSessionService` (or `DapBreakpointService`) | Per-file in-flight + pending flags | Internal only — no Observable exposed |
| `ExecutionState` terminal guard | `DapSessionService` | `disconnect()`/`terminate()` one-shot | Session state machine — no new signal |

All signals are **fully independent**. No two guards share state or block each other.

---

## 6. R-CS4: setBreakpoints Debounce + Per-File Serialization

### Behavior

- Breakpoint gutter clicks (add / remove / move) mutate the breakpoint list for the affected file and trigger a `setBreakpoints` request.
- Rapid clicks within **150 ms** on the same file are collapsed into one request using the **latest** breakpoint list (debounce).
- While a `setBreakpoints` for file X is in-flight:
  - Any new mutation for file X is stored as a single **pending update** (last-write-wins). Queue depth per file is capped at **1** — no growing queue.
  - As soon as the in-flight response arrives (success or error), the pending update is dispatched immediately.
- `setBreakpoints` requests for **different files** are fully independent and may execute in parallel.
- Rationale: DAP's `setBreakpoints` transmits the **complete breakpoint list per file** on every call. Out-of-order responses for the same file would leave the DA's breakpoint state inconsistent with the UI's intended state.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Debounce gutter clicks | **UI** (`DebuggerComponent` / `EditorComponent`) | `debounceTime(150)` on per-file breakpoint mutation stream |
| Per-file in-flight guard + pending slot | **Session** (`DapSessionService` or dedicated `DapBreakpointService`) | `Map<string, { inFlight: boolean; pending: BreakpointList \| undefined }>` keyed by source path |
| Dispatch pending on response | **Session** | After `setBreakpoints` response, check pending slot; dispatch and clear immediately if non-empty |

```typescript
// Session Layer — per-file serialization sketch
type BreakpointFileState = { inFlight: boolean; pending: number[] | undefined };
private readonly breakpointFileState = new Map<string, BreakpointFileState>();

public async setBreakpoints(path: string, lines: number[]): Promise<DapResponse> {
  const state = this.breakpointFileState.get(path) ?? { inFlight: false, pending: undefined };
  if (state.inFlight) {
    state.pending = lines; // last-write-wins
    this.breakpointFileState.set(path, state);
    return; // caller does not await the pending dispatch
  }
  state.inFlight = true;
  state.pending = undefined;
  this.breakpointFileState.set(path, state);
  try {
    return await this.sendRequest('setBreakpoints', { source: { path }, breakpoints: lines.map(l => ({ line: l })) });
  } finally {
    state.inFlight = false;
    if (state.pending !== undefined) {
      const next = state.pending;
      state.pending = undefined;
      void this.setBreakpoints(path, next); // fire pending
    }
  }
}
```

> [Diagram: Gutter click stream → debounceTime(150ms) → setBreakpoints(file X).
> If in-flight: store as pending (last-write-wins). On response → dispatch pending if exists.
> Parallel files proceed independently.]

---

## 7. R-CS5: disconnect / terminate One-Shot Guard

### Behavior

- Once `disconnect()` or `terminate()` is dispatched, all subsequent calls to either method are **no-ops** until `reset()` returns the session to `idle`.
- The guard is enforced via the existing `ExecutionState` machine — no new signal is introduced.
- When `executionState` is already `terminated`, `idle`, or `error`, both methods return `Promise.resolve()` immediately without sending any DAP request.
- Rationale: `disconnect()` tears down the Transport and sets it to `undefined`. A second call on a destroyed Transport causes unhandled rejections and potential state corruption.
- The existing `executionState$` transition to `terminated` already causes the Stop button to be hidden or disabled in the UI — this rule adds the complementary **service-level** guard.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| One-shot guard | **Session** (`DapSessionService`) | Early-exit at top of `disconnect()` and `terminate()` based on `ExecutionState` |
| UI button suppression | **UI** (`DebuggerComponent`) | Existing `executionState$` binding — no change required |

```typescript
// Session Layer — one-shot guard (early exit)
public async disconnect(): Promise<void> {
  if (this.executionState === 'terminated' ||
      this.executionState === 'idle' ||
      this.executionState === 'error') {
    return; // no-op
  }
  // ... existing teardown logic
}
```

> [Diagram: Stop button click → executionState guard → if 'terminated'/'idle'/'error': return immediately.
> Otherwise: dispatch disconnect/terminate, transition state to 'terminated'.]
