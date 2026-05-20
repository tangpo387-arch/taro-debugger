---
wi: trivial
title: Introduce thread status tracking (running, stopped, exited)
author: Lead_Engineer
status: ready-for-review
skills-required: ["[DEV:STATE] Reactive State Flows", "[DEV:DAP] Protocol Implementation"]
audience: [Quality_Control_Reviewer, Human Engineer]
---

# Review Package: trivial-thread-status

## 1. Acceptance Criteria

- [x] Expose individual thread execution state (running/stopped/exited) via `status` and `setStatus` in `DapThreadSession`.
- [x] Dynamically update thread states based on DAP transport events (`stopped`, `continued`, `exited`, `thread`) in `DapSessionService`.
- [x] Refactor `ThreadCallStackComponent` unit tests in `thread-call-stack.component.spec.ts` to use Vitest fake timers for deterministic execution and to prevent asynchronous test flakiness.
- [x] Add comprehensive unit tests in `dap-session.service.spec.ts` to verify the thread status state transitions under different DAP events.
- [x] [Test] Verify that all 103 unit tests across all libraries compile and pass successfully.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-thread.ts` | L1–22, L37–41 | Added `DapThreadStatus` type and `status`/`setStatus` to `DapThreadSession`. Initialized status in constructor based on whether thread is stopped. |
| `projects/dap-core/src/lib/session/dap-session.service.ts` | L133–148, L1114, L1138–1146, L1195–1220, L1400–1408 | Added getters for `threadsList`, `stoppedThreads`, `allThreadsStopped`, `executionState`. Updated `handleTransportEvent` and state transitions to manage thread status. |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | L398–421, L497–509, L611–670, L1450–1462 | Added transport + auto-responding threads mock in `beforeEach` for `Multi-Thread State Tracking` and `Active Thread Auto-Selection` suites, plus inline transport wiring for `should transition through states based on events`. Eliminates all `fetchThreads` warnings at the test level. Added integration test `should dynamically evaluate thread status like running/stopped/exited`. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | L6–35, L60–109, L130–210 | Converted test suite to use Vitest fake timers (`vi.useFakeTimers()`, `vi.advanceTimersByTimeAsync()`) for deterministic debounce rendering checks. |

## 3. Edge Cases & Design Decisions

- **Dynamic Evaluation**: `DapThreadSession` tracks its status internally. When a thread event (like stopped or continued) is emitted, the thread object itself is updated directly using `setStatus()`.
- **Constructor State Check**: When a new `DapThreadSession` is instantiated, it checks the parent `DapSessionService` state to determine its initial status (if the session is all-threads-stopped or if it's in the stopped set, it initializes to `stopped`; otherwise, `running`).
- **Test-level Transport Wiring**: `fetchThreads()` is always called on a `stopped` event. Rather than adding a production guard, the unit test suites that trigger `stopped` events without a full session now wire `mockTransport` in a `beforeEach` and configure `sendRequest` to auto-respond with an empty `threads` list. This ensures clean `fetchThreads` resolution without any console noise.
- **Fake Timer Drain Before `reset()`**: In the `should transition through states based on events` test, `vi.advanceTimersByTime(1)` is called after the `stopped` event to flush the mock `threads` response before the subsequent `terminated` event triggers `reset()` — preventing an in-flight promise from being rejected.
- **Vitest Fake Timers**: Standard asynchronous tests using `setTimeout` are highly prone to race conditions in container environments. Converting `thread-call-stack.component.spec.ts` to Vitest fake timers makes the async tests 100% deterministic and significantly faster.

## 4. Tests Added/Modified

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | `DapSessionService — Multi-Thread State Tracking` | should dynamically evaluate thread status like running/stopped/exited |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | `ThreadCallStackComponent` | Converted all `setTimeout` assertions to deterministic `vi.advanceTimersByTimeAsync(10)` tests |

## 5. Spec-Plan Updates

N/A (Trivial change).

## 6. Self-Verification

```text
 Test Files  12 passed (12)
      Tests  103 passed (103)
   Start at  23:30:48
   Duration  3.87s
```
