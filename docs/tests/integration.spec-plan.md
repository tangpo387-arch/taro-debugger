---
title: Integration Tests — Spec Plan
scope: integration-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/
related-wi: ~
last_updated: 2026-04-13
---

# Integration Tests — Spec Plan

## Overview

Tests for interactions and data flow between multiple Services or Components. The outermost I/O (e.g., WebSocket) is mocked; all other wiring is real.

---

## DAP Launch Flow Integration

* From `SetupComponent` form submission → write to `DapConfigService` → drive `DebuggerComponent` initialization → trigger `DapSessionService`'s `initialize()` and `launch()` sequence. Verify data transfer integrity at each step.

---

## Event-Driven State Sync

* Simulate WebSocket receiving a `stopped` event → verify `DapSessionService` sends `stackTrace` and other requests → verify UI state management switches to "paused" state.
* Simulate WebSocket receiving an `output` event → verify console log array adds new entries with correct category classification.

---

## FileExplorer ↔ DebuggerComponent Integration

* **`stopped` event increments `fileTreeReloadTrigger`**
  * Emit a `stopped` DAP event via `DapSessionService.onEvent()`. Verify `DebuggerComponent.fileTreeReloadTrigger` increments by `1`, causing `FileExplorerComponent.ngOnChanges` to fire and call `getTree()`.

* **`loadedSource` event increments trigger**
  * Emit a `loadedSource` DAP event. Verify `fileTreeReloadTrigger` increments and tree reloads.

* **Multiple rapid events accumulate correctly**
  * Emit `stopped` → `loadedSource` in sequence. Verify `fileTreeReloadTrigger` increments by `2` total (no coalescing; each event is independently documented).

* **`onFileSelected()` issues DAP `source` request**
  * Simulate `FileExplorerComponent` emitting `fileSelected` with `{ path: '/src/main.cpp', type: 'file', name: 'main.cpp' }`. Verify `DapSessionService.fileTree.readFile('/src/main.cpp')` is called, and `DebuggerComponent.currentCode` is updated to the resolved content.

* **`onFileSelected()` error path**
  * Mock `readFile()` to reject with `Error('source not found')`. Verify `currentCode` is set to `'// Error loading file: source not found'` and no unhandled rejection surfaces.

* **`activeFilePath` propagates to `FileExplorerComponent` after frame-click**
  * Call `DebuggerComponent.onFrameClick()` with a frame referencing `/src/foo.cpp`. Verify `activeFilePath` is updated in `DebuggerComponent` **and** the `[activeFilePath]` binding propagates to `FileExplorerComponent` (i.e., the corresponding tree node receives `active-file` CSS class).

* **`activeFilePath` propagates after file node click**
  * Simulate `fileSelected` output → `onFileSelected()`. Verify `DebuggerComponent.activeFilePath` is set, which is then passed back to `FileExplorerComponent` as `@Input()` to highlight the clicked node.

---

## Breakpoint & Editor Sync

* **Toggle → DAP request**
  * Simulate a Monaco Editor glyph-margin click while `executionState === 'running'` or `'stopped'` → verify `DapSessionService.setBreakpoints()` is called with the correct `sourcePath` and `lines` array.

* **Verified decoration update**
  * Mock `setBreakpoints` response with `{ breakpoints: [{ line: 5, verified: true }] }` → verify `EditorComponent.setVerifiedBreakpoints()` is called with `[5]` and the glyph switches from `.breakpoint-glyph-unverified` (gray) to `.breakpoint-glyph` (red).

* **Unverified decoration stays gray**
  * Mock response with `{ verified: false }` → verify the line's glyph class remains `.breakpoint-glyph-unverified`.

* **Breakpoint removal clears Map entry**
  * Toggle the same line twice (add then remove) → verify `setBreakpoints` is called with an empty array and `setVerifiedBreakpoints` is called with `[]`, which triggers `verifiedBreakpoints.delete(file)` (no stale Map entry).

* **Session guard — idle state**
  * Simulate toggling a breakpoint while `executionState === 'idle'` → verify `setBreakpoints` DAP request is **not** sent (session not ready).

* **Re-sync on restart**
  * After populating `EditorComponent.breakpoints` with two files, call `resyncAllBreakpoints()` → verify `setBreakpoints` is called once per file in parallel.

---

## Connection Error & Intent Detection

> **Note**: 12 logic-dense tests are implemented in `projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/connection-error-integration.spec.ts`.

* **Normal stop & intent interception**
  * Call `disconnect()` then simulate transport layer `complete()`, verify `DapSessionService` correctly intercepts the signal without emitting `_transportError` synthetic event.

* **Unexpected disconnect detection**
  * Simulate transport layer triggering `error()`, verify `executionState` transitions to `error` and emits `_transportError` for UI display.

* **Connection timeout verification**
  * Simulate connection request timeout, verify `firstValueFrom` correctly catches the RxJS `timeout` error.
