---
title: Command Serialization — Architecture & Lifecycle
scope: architecture, command-serialization, session-layer, ui-layer, dap-cancel
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-31
related:
  - ../architecture.md
  - session-layer.md
  - ui-layer.md
  - ../../.agents/skills/dev-dap-protocol-impl/SKILL.md
tech_stack:
  angular: 21
  rxjs: 7.8
  dap: 1.64
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
| **R-CS1** | Control buttons (Run / Continue / Next / Step In / Step Out / Pause / Stop) | Drop — second command while in-flight is silently discarded; Play button is multi-purpose (Run vs Continue) |
| **R-CS2** | Evaluate command (console input) | Cancel-able — in-flight can be interrupted; auto-timeout at 30 s |
| **R-CS3** | Call stack frame switch | Cancel-and-replace — latest selection wins; prior in-flight chain is discarded |
| **R-CS4** | Breakpoint gutter click (`setBreakpoints`) | Debounce (150 ms) + per-file last-write-wins; distinct files are independent |
| **R-CS5** | Stop / Restart / Disconnect button (`stop` / `restart`) | One-shot guard — calls after first dispatch are no-ops until `reset()`; hierarchical fallback based on capabilities |

### 1.1 Layer Responsibilities

Serialization is jointly enforced by the UI and Session layers to ensure both visual responsiveness and protocol integrity:

- **UI Layer (`DebuggerComponent`, `EditorComponent`)**: Responsible for **Jitter Filtering**. It prevents redundant DAP requests through event debouncing and immediate button state updates (disabling clicking), ensuring that human interaction noise stays at the edge.
- **Session Layer (`DapSessionService`)**: Responsible for **Protocol Safety**. It enforces strict single-execution for control commands and serialized state synchronization for breakpoints. This prevents race conditions and state divergence if multiple components attempt to interact with the Debug Adapter simultaneously.

### 1.2 Architecture Constraints

The following fundamental constraints govern all command serialization patterns in this system:

1. **Isolation**: Guards for different command types (e.g., execution control vs. evaluate) are fully independent and must never block one another.
2. **Eventual Consistency**: Breakpoint updates must eventually synchronize with the user's latest intent, even if intermediate states are discarded or collapsed.
3. **Transport Integrity**: Method guards must stop data from being piped to a transport that is transitioning to a closed state (one-shot guard).

---

## 2. R-CS1: Control Button Serialization

### Behavior

- When any execution-control command is dispatched:
  - If a prior control command has not yet received its response, the new click is **silently dropped** (no queue, no retry).
  - All control buttons enter a **disabled state** immediately on click (jitter filtering).
  - Buttons re-enable when the command response is settled **or** when the `executionState$` transitions via a DAP `stopped` / `continued` / `terminated` event.
- Rationale: Sending a second control command before the first state transition is confirmed is a DAP protocol violation.
- **Run vs. Resume Differentiation**: The "Play" button icon (`play_arrow`) is enabled in `idle`, `terminated`, and `stopped` states, but maps to different semantic actions:
  - **Run (`onRun`)**: Triggered from `idle` or `terminated`. Calls `startSession()` to establish a fresh transport and handshake.
  - **Resume (`onResume`)**: Triggered from `stopped`. Calls `continue()` to resume the existing process.
- Rationale: Explicitly separating the "Run" intent (session initialization) from the "Resume" intent (execution control) prevent protocol race conditions when attempting to restart a naturally terminated session.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Guard against duplicate dispatch | **Session** (`DapExecutionController`) | `private commandInFlightSubject = new BehaviorSubject<boolean>(false)` guards each of `continue()`, `next()`, `stepIn()`, `stepOut()`, `pause()` |
| Button disabled binding | **UI** (`DebugControlGroupComponent`) | `[disabled]="commandInFlight$ \| async"` |

### State Transition Timeout Guard

If the Debug Adapter fails to emit a state transition event (`stopped`, `continued`, `terminated`) within **5 000 ms** after a successful step command response, `DapExecutionController` automatically:

1. Resets `commandInFlight$` to `false` (unlocking the UI).
2. Emits a synthetic `_sessionError` event warning the user.

This prevents the UI from becoming permanently locked when the adapter silently drops a state transition.

> [!NOTE]
> The timeout guard applies only to stepping commands (`continue`, `next`, `stepIn`, `stepOut`). The `pause` command does not use this guard because its response directly resolves the in-flight state.

For multi-threaded non-stop mode behavior that affects control button state, see [§7. Multi-Threaded Non-Stop Thread Filtering](#7-multi-threaded-non-stop-thread-filtering).

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
| In-flight signal | **UI** (`DebugConsoleComponent`) | `private evaluateInFlight$ = new BehaviorSubject<boolean>(false)` — isolated from `commandInFlight$` |
| Pending seq storage | **UI** (`DebugConsoleComponent`) | `private pendingEvaluateSeq: number \| undefined` |
| Cancel dispatch | **Session** (`DapSessionService`) | `public cancelRequest(requestId: number): Promise<void>` |
| Timeout guard | **Session** (`DapSessionService`) | `Promise.race` inside `evaluate()` |
| Auto-timeout snackbar | **UI** (`DebugConsoleComponent`) | Catch `EvaluateCancelledError` with `source === 'timeout'` flag |

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

> [Diagram: Frame selection stream → `switchMap` cancels prior in-flight `scopes`/`variables`
> chain → new `scopes` request dispatched → `variables` fetched for selected frame.]

---

## 5. R-CS4: setBreakpoints Debounce + Per-File Serialization

### Behavior

- Breakpoint gutter clicks (add / remove / move) mutate the breakpoint list for the affected file and trigger a `setBreakpoints` request.
- Rapid clicks within **150 ms** on the same file are collapsed into one request using the **latest** breakpoint list (debounce).
- While a `setBreakpoints` for file X is in-flight:
  - Any new mutation for file X is stored as a single **pending update** (last-write-wins). Queue depth per file is capped at **1** — no growing queue.
  - As soon as the in-flight response arrives (success or error), the pending update is dispatched immediately.
- `setBreakpoints` requests for **different files** are fully independent and may execute in parallel.
- Rationale: DAP's `setBreakpoints` transmits the **complete breakpoint list per file** on every call. Out-of-order responses for the same file would leave the DA's breakpoint state inconsistent with the UI's intended state.

### Design Rationale: Layer Responsibility

The implementation of R-CS4 is intentionally distributed across both layers to solve two distinct problems:

1. **UI Layer (`EditorComponent`) — Human Noise Filtering**:
    - **Debouncing**: Gutter clicks are inherently "jittery." Grouping by file and debouncing ensures we only synchronize the user's final intent, significantly reducing redundant protocol traffic.
    - **Responsiveness**: The UI can update local decorations (markers) immediately without waiting for the 150 ms window, while the expensive server sync happens asynchronously.
2. **Session Layer (`DapBreakpointManager`) — Protocol Safety**:
    - **Serialization**: While the UI delays the *start* of a request, the Session Layer ensures that once a request is dispatched, any subsequent updates for that file wait for the first to complete.
    - **Integrity**: This prevents race conditions where a fast second request might be overwritten by a slow first request's confirmation, maintaining the "latest-write-wins" guarantee.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Debounce gutter clicks | **UI** (`EditorComponent`) | `debounceTime(150)` on per-file breakpoint mutation stream |
| Per-file in-flight guard + pending slot | **Session** (`DapBreakpointManager`) | `Map<string, { inFlight: boolean; pending: BreakpointList \| undefined }>` keyed by source path |
| Dispatch pending on response | **Session** (`DapBreakpointManager`) | After `setBreakpoints` response, check pending slot; dispatch and clear immediately if non-empty |

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

> [Diagram: Gutter click stream → `debounceTime(150ms)` → `setBreakpoints(file X)`.
> If in-flight: store as pending (last-write-wins). On response → dispatch pending if exists.
> Parallel files proceed independently.]

---

## 6. R-CS5: stop / restart Hierarchical Fallback & Guards

### Behavior

- **Hierarchy Strategy**: Both `stop()` and `restart()` adapt their behavior based on the Debug Adapter's `capabilities` to ensure the most graceful termination possible.
- **Stop Action**:
  - Primary: If `supportsTerminateRequest`, send `terminate`.
- **Restart Action**:
  - Primary: If `supportsRestartRequest`, send `restart`.
  - Fallback: "Soft Restart" — execute `stop()` → `disconnect({ restart: true })` → `startSession()`.
- **One-Shot Guard**:
  - Once `stop()` or `restart()` is dispatched, all subsequent calls to either are **no-ops** until the session returns to `idle`.
  - **Terminal Guard**: `restart()` is explicitly blocked (early return) if the current state is `idle` or `terminated`. In these states, the UI directs the user to the "Run" action (`startSession`) instead.
- **Rationale**:
  - `disconnect()` triggers transport teardown. Multiple concurrent calls would attempt to write to a closing socket, causing unhandled rejections.
  - Pre-terminating an active session before a soft restart prevents DAP servers from hanging in an undefined state when a new handshake is initiated.
  - Restricting `restart()` to active sessions prevents semantic confusion with "Run" and maintains the integrity of the state machine.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| One-shot guard | **Session** (`DapSessionService`) | Early-exit at top of `stop()`, `restart()`, and `disconnect()` |
| Terminal action filtering | **UI** (`DebugControlGroupComponent`) | `[disabled]` binding blocks Restart button in `idle`/`terminated` |
| UI button suppression | **UI** (`DebuggerComponent`) | Existing `executionState$` binding |

> [Diagram: Control button click → check `executionState` → if terminal (and command is restart): return.
> Otherwise: dispatch hierarchical command (`terminate`/`restart`/`disconnect`), transition state.]

---

## 7. Multi-Threaded Non-Stop Thread Filtering

This section documents a **cross-cutting concern** that affects control button serialization (§2), pause routing (§6), and signal isolation (§8).

### Behavior under GDB Non-Stop Mode

When the GDB Debug Adapter is executed in native multi-threaded non-stop mode (`--interpreter=dap` and GDB non-stop active), individual threads can resume or step independently while other threads remain paused. As a consequence, the global session `executionState` may be `'stopped'` (because at least one thread is suspended) while the user's active/focused thread is `'running'`.

To prevent protocol-level failures (such as GDB issuing `notStopped` errors when trying to step a running thread):

1. **Stepping Buttons Blocked**: Stepping control buttons (Step Over, Step Into, Step Out, Nexti, Stepi) are disabled if the active thread's status is `'running'`.
2. **Play/Pause Toggle**: The floating toolbar's **Play** button toggles to a **Pause** button if either the global session state is running OR the focused thread itself is currently `'running'`.
3. **Execution Guards**: Both UI buttons and global keyboard shortcuts (F5, F10, F11, Shift+F11) are guarded within the controller. If the active thread status is `'running'`, stepping requests are dropped immediately. The Pause command (F6) is allowed and targets the running active thread specifically.

### Enforcement

| Concern | Layer | Mechanism |
| :--- | :--- | :--- |
| Thread-level State Mapping | **UI** (`DebugControlGroupComponent`) | `isActiveThreadStopped$ = activeThread$.pipe(map(thread => !thread &#124;&#124; thread.status !== 'running'))` |
| Floating Toolbar Binding | **UI** (`debug-control-group.component.html`) | Stepping disabled binding: `[disabled]="!(isStopped$ &#124; async) &#124;&#124; !(isActiveThreadStopped$ &#124; async) &#124;&#124; (commandInFlight$ &#124; async)"`<br>Play/Pause toggle expression: `@if ((isRunning$ &#124; async) &#124;&#124; !(isActiveThreadStopped$ &#124; async))` |
| Keyboard Shortcut & Action Guards | **UI** (`DebuggerComponent`) | Methods `onResume()`, `onStepOver()`, `onStepInto()`, `onStepOut()`, and `onStepInstructionTab()` exit early if `this.activeThread?.status === 'running'`. `onPause()` is permitted if `this.executionState === 'running' &#124;&#124; this.activeThread?.status === 'running'`. |
| Thread-Specific Pause Request | **Session** (`DapExecutionController`) | Dispatches DAP `pause` request with the active thread ID (`{ threadId: activeThread.id }`). |

---

## 8. Signal Isolation Summary

| Signal / Guard | Owner | Scope | Consumers |
| :--- | :--- | :--- | :--- |
| `commandInFlight$` | `DapExecutionController` | Control button commands only | `DebugControlGroupComponent` (button `[disabled]`) |
| `evaluateInFlight$` | `DebugConsoleComponent` | Evaluate command only | `DebugConsoleComponent` template (Cancel/submit swap) |
| `pendingEvaluateSeq` | `DebugConsoleComponent` | Single in-flight evaluate seq | `DebugConsoleComponent.onCancelEvaluate()` |
| `breakpointFileState` map | `DapBreakpointManager` | Per-file in-flight + pending flags | Internal only — no Observable exposed |
| `ExecutionState` terminal guard | `DapSessionService` | `disconnect()`/`terminate()` one-shot | Session state machine — no new signal |
| `isActiveThreadStopped$` | `DebugControlGroupComponent` | Active thread stopped check | Stepping button `[disabled]` binding |

All signals are **fully independent**. No two guards share state or block each other.

---

## 9. API Reference

### Session Layer Observables

```typescript
// DapExecutionController
// Emits true while any execution-control command is in-flight; false when idle.
public readonly commandInFlight$: Observable<boolean>;
```

Implemented as a `BehaviorSubject<boolean>` initialized to `false`. Set to `true`
immediately before `sendRequest()` is called; reset to `false` on promise settlement.

### Session Layer Methods

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
