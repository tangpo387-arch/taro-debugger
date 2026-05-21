---
wi: trivial
title: Remove stoppedThreads$, allThreadsStopped$, and threadStopReasons$ Observables
author: Lead_Engineer
status: ready-for-review
skills-required: ["[DEV:STATE] Reactive State Flows", "[DEV:DAP] Protocol Implementation"]
audience: [Quality_Control_Reviewer, Human Engineer]
---

# Review Package: trivial-remove-thread-observables

## 1. Acceptance Criteria

- [x] Merge `stopReason` directly into `DapThreadSession` and remove the redundant `stoppedThreadsSubject`, `allThreadsStoppedSubject`, and `threadStopReasonsSubject` from `DapSessionService`.
- [x] Remove public observables/getters (`stoppedThreads$`, `allThreadsStopped$`, `threadStopReasons$`, etc.) from `DapSessionService` reactive API.
- [x] Dynamically update thread states and stop reasons based on DAP transport events (`stopped`, `continued`, `exited`, `thread`) in `DapSessionService`.
- [x] Refactor `ThreadCallStackComponent` to query thread status and stop reasons directly from `DapThreadSession` instances, removing the deleted streams from `combineLatest`.
- [x] Refactor `ThreadCallStackComponent` unit tests in `thread-call-stack.component.spec.ts` to remove the mock streams and dynamically resolve thread status in `makeMockThreadSession`.
- [x] Add comprehensive unit tests in `dap-session.service.spec.ts` to verify the thread status state transitions under different DAP events.
- [x] [Test] Verify that all 103 unit tests across all libraries compile and pass successfully.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-thread.ts` | L23–55 | Added `_stopReason`, `stopReason` getter, and `setStopReason()` method to `DapThreadSession`. SsetStatus resets `_stopReason` to null on runs/exits. |
| `projects/dap-core/src/lib/session/dap-session.service.ts` | L133–148, L1114, L1138–1146, L1195–1220, L1400–1408 | Removed `stoppedThreadsSubject`, `allThreadsStoppedSubject`, and `threadStopReasonsSubject` along with public observables. Handlers modified to update thread objects directly. |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | L398–421, L497–509, L611–670, L1450–1462 | Refactored tests to verify thread status and stop reasons directly on thread objects. Removed assertions and dependencies on removed observables. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.ts` | L104–120, L129–200 | Removed `stoppedThreads$`, `allThreadsStopped$`, and `threadStopReasons$` from the component's `combineLatest` subscription. Changed tree rendering to fetch `status` and `stopReason` directly from thread objects. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | L6–210 | Removed mock providers/streams for the deleted observables. Moved `makeMockThreadSession` helper inside the `describe` blocks to link its thread status getter dynamically to the mock session's `executionState$`. |
| `projects/taro-debugger-frontend/src/app/application-frame-integration.spec.ts` | L38–48 | Removed mock providers/streams for the deleted observables in mock `DapSessionService`. |
| `projects/taro-debugger-frontend/src/app/debugger.component.spec.ts` | L235–245, L481–488 | Removed mock providers/streams for the deleted observables in mock `DapSessionService`. |

## 3. Edge Cases & Design Decisions

- **Dynamic Evaluation**: `DapThreadSession` tracks its status and stop reason internally. When a thread event (like stopped or continued) is emitted, the thread object itself is updated directly using `setStatus()` and `setStopReason()`.
- **Constructor State Check**: When a new `DapThreadSession` is instantiated, it checks the parent `DapSessionService` state to determine its initial status (if the session is in the stopped state, it initializes to `stopped`; otherwise, `running`).
- **Dynamic Thread Mocking in Tests**: In component spec files, `makeMockThreadSession` was refactored to dynamically resolve its status getter using the state of the mock session (`mockSession.executionState$`). This ensures changes to the session state propagate correctly to mock threads.

## 4. Tests Added/Modified

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | `DapSessionService — Multi-Thread State Tracking` | should dynamically evaluate thread status like running/stopped/exited |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | `ThreadCallStackComponent` | Converted all `setTimeout` assertions to deterministic `vi.advanceTimersByTimeAsync(10)` tests and removed deleted stream dependencies |

## 5. Spec-Plan Updates

N/A (Trivial change).

## 6. Self-Verification

```text
 Test Files  12 passed (12)
      Tests  103 passed (103)
   Start at  20:17:00
   Duration  3.79s
```
