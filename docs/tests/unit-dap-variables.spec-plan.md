---
title: DapVariablesService — Unit Spec Plan
scope: unit-test
target-file: src/app/dap-variables.service.ts
related-wi: ~
last_updated: 2026-04-13
---

# DapVariablesService — Unit Spec Plan

## Overview

Fully isolated tests for `DapVariablesService`. Focuses on variable inspector state, cache behaviour, state-driven cleanup, and Observable lifecycle management.

---

## Test Cases

### `fetchScopes`

* **Success path**
  * Call `fetchScopes(frameId)` with a mocked `DapSessionService.scopes()` returning `{ success: true, body: { scopes: [...] } }`. Verify `scopes$` emits the corresponding `DapScope[]` array.

* **Failure path**
  * Mock `DapSessionService.scopes()` to reject. Verify `scopes$` emits `[]` and the error is re-thrown to the caller.

* **Cache invalidation**
  * Pre-populate the variables cache via `getVariables()`, then call `fetchScopes()`. Verify the cache is cleared (a subsequent `getVariables()` with the same reference makes a new DAP request, not a cache hit).

---

### `getVariables`

* **Success path**
  * Call `getVariables(ref)` with a mocked `DapSessionService.variables()` returning `{ success: true, body: { variables: [...] } }`. Verify the returned `DapVariable[]` matches the mock response.

* **Cache hit**
  * Call `getVariables(ref)` twice with the same reference. Verify `DapSessionService.variables()` is only called once (second call returns cached data).

* **Error propagation**
  * Mock `DapSessionService.variables()` to reject. Verify the method re-throws the error to the caller and emits a `console.warn`. The caller (`VariablesComponent.toggleNode`) is responsible for catching the error and gracefully degrading to an empty children array — the service must not silently swallow errors, as doing so would render the UI-layer catch block dead code.

* **Zero-ref guard**
  * Call `getVariables(0)`. Verify `DapSessionService.variables()` is **not** called and the method returns `[]`.

---

### State & Lifecycle

* **State-driven cleanup (R_SM5)**
  * Emit `executionState$` as `'running'` from the mocked `DapSessionService`. Verify `scopes$` resets to `[]` and `variablesCache` is cleared. Repeat with `'idle'` and `'terminated'`.

* **No redundant clear emission**
  * When `scopes$` is already `[]`, emit a non-`'stopped'` executionState. Verify `scopes$` does **not** emit a second `[]` (the guard `scopesSubject.value.length > 0` prevents unnecessary emissions).

* **`ngOnDestroy` cleanup**
  * Call `ngOnDestroy()`. Verify the `executionState$` subscription is unsubscribed and both `scopes$` and `variablesCache` are cleared.
