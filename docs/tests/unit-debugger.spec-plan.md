---
title: DebuggerComponent — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/src/app/debugger.component.ts
related-wi: [WI-83, WI-91]
last_updated: 2026-04-29
---

# DebuggerComponent — Unit Spec Plan

## Overview

Fully isolated tests for `DebuggerComponent`. Focuses on session lifecycle hooks, control button state bindings, execution state cleanup, and UI orchestration during session transitions.

---

## Test Cases

* **Session lifecycle hooks**
  * Ensure the component correctly calls Session Service's `initialize` and `disconnect` during initialization and destruction.

* **Control button state binding**
  * Simulate different `executionState` values (`stopped`, `running`, `terminated`), verify the corresponding control button (Continue, Pause, Step, etc.) `disabled` properties are correctly applied.

* **Control button interaction**
  * Simulate clicking each control button, verify the correct `DapSessionService` method is called (e.g., `continue()`, `pause()`, `next()`, etc.).

* **Command Serialization (R-CS1)**
  * Verify that all control buttons are actively disabled if the `commandInFlight$` signal is true for the session, regardless of the `executionState`.

* **State Cleanup (WI-83 / WI-91)**
  * **Reactive Cleanup**: Verify that `stackFrames` are cleared whenever the state transitions to `running`, `error`, or `idle`.
  * **Idle Reset**: Verify that `activeFilePath` and `currentCode` are cleared when the state transitions to `idle`.
  * **Race Guard**: Verify that `stackFrames` are discarded if the state is no longer `stopped` after an asynchronous `stackTrace` request completes.

* **Panel Layout — WI-69**
  * Verify that the component initializes with the correct default expand state for all 5 inspection panels (left: Files=true, Threads=true; right: Breakpoints=true, Variables=true, CallStack=true).
  * Verify that the component initializes with exactly 2 left panel states and 3 right panel states, matching the Flush IDE layout contract.
