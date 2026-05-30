---
title: DapThreadSession — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/dap-core/src/lib/session/dap-thread.ts
related-wi: [WI-142]
last_updated: 2026-05-31
---

# DapThreadSession — Unit Spec Plan

## Overview

Fully isolated tests for `DapThreadSession`. Focuses on status initialization, stop reasons, stack trace caching, request coalescing, and caching cleanup.

---

## Test Cases

### Suite: `DapThreadSession`

#### initialization-test

Scenario: should initialize thread details and status based on session state

- Construct `DapThreadSession` with executionState `'stopped'`.
- Assert thread `id` and `name` are set correctly.
- Assert status is `'stopped'`.
- Construct `DapThreadSession` with executionState `'running'`.
- Assert status is `'running'`.

---

#### status-test

Scenario: should set status and stop reason correctly

- Call `setStatus('stopped')` and assert status is updated.
- Call `setStopReason('breakpoint')` and assert stopReason is updated.
- Call `setStatus('running')` and assert status is updated and stopReason is reset to `null`.
- Call `setStatus('exited')` and assert status is updated and stopReason is reset to `null`.

---

#### stacktrace-caching-test

Scenario: should fetch stack trace and cache the result

- Setup `mockSession.sendRequest` to resolve with a successful DAP response containing stack frames.
- Call `stackTrace()` first time.
- Assert request is sent with thread ID.
- Assert returned frames match the mock response.
- Assert `cachedFrames` getter returns the cached frames.
- Call `stackTrace()` second time.
- Assert `mockSession.sendRequest` was NOT called a second time (served from cache).

Scenario: should coalesce concurrent stack trace queries into a single request

- Setup `mockSession.sendRequest` to return a pending promise.
- Trigger two parallel `stackTrace()` calls.
- Assert `isLoadingStackTrace` is `true`.
- Resolve the pending promise.
- Assert both queries resolve with the same frames.
- Assert `mockSession.sendRequest` was called exactly once.
- Assert `isLoadingStackTrace` becomes `false`.

Scenario: should clear loading promise and throw if sendRequest fails

- Setup `mockSession.sendRequest` to reject with an error.
- Call `stackTrace()`.
- Assert it rejects with the same error.
- Assert `isLoadingStackTrace` is `false`.
- Call `stackTrace()` again.
- Assert `mockSession.sendRequest` is called again (not permanently stuck in failing state).

---

#### cache-clearing-test

Scenario: should clear cache when clearCache is called

- Setup `mockSession.sendRequest` to resolve with frames.
- Call `stackTrace()` and wait for resolution.
- Call `clearCache()`.
- Assert `cachedFrames` is undefined.
- Call `stackTrace()` again.
- Assert `mockSession.sendRequest` is called again (cache invalidation).
