---
title: FileExplorerComponent — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/src/app/file-explorer.component.ts
related-wi: WI-82
last_updated: 2026-04-26
---

# FileExplorerComponent — Unit Spec Plan

## Overview

Fully isolated tests for `FileExplorerComponent`. Covers `reloadTrigger` change detection, capability-based branching, node click emission, active-file highlight binding, `collapseAll` delegation, subscription lifecycle, and WI-82 specific features (virtual root expansion and path tooltips).

---

## Test Cases

* **`reloadTrigger` first-change guard**
  * Create the component with `reloadTrigger = 0` (initial binding). Verify `DapFileTreeService.getTree()` is **not** called on first render (DAP session or UI not yet ready for data).

* **`reloadTrigger` reload on increment**
  * After initial render, change `reloadTrigger` from `0` to `1`. Verify `getTree()` is called exactly once, and `fileDataSource` is populated with the returned root's children.

* **Two consecutive increments call `getTree()` twice**
  * Change `reloadTrigger` from `1` to `2`, then `2` to `3`. Verify `getTree()` is called for each distinct value (verifying the counter pattern guarantees reloads are not swallowed by reference-equality checks).

* **`supportsLoadedSourcesRequest = false` → unsupported fallback**
  * Set `dapSession.capabilities.supportsLoadedSourcesRequest = false`, trigger a reload. Verify `fileTreeSupported = false` is set, `getTree()` is **not** called, and the template renders the unsupported message block.

* **`supportsLoadedSourcesRequest = true` → supported path**
  * Set `dapSession.capabilities.supportsLoadedSourcesRequest = true`, mock `getTree()` to return a super-root with children. Trigger reload. Verify `fileDataSource` matches the super-root's children (unwrapping the synthetic root).

* **`fileSelected` emitted on file node click**
  * Call `onNodeClick()` with a node of `type: 'file'`. Verify `fileSelected` EventEmitter emits the node object.

* **`fileSelected` NOT emitted on directory node click**
  * Call `onNodeClick()` with a node of `type: 'directory'`. Verify `fileSelected` does **not** emit.

* **`activeFilePath` highlight binding**
  * Set `activeFilePath = '/foo/bar.cpp'`, populate `fileDataSource` with a node at path `/foo/bar.cpp`. Verify the rendered node has the CSS class `active-node`. Set `activeFilePath = null`. Verify the class is removed.

* **`collapseAll()` delegates to mat-tree**
  * Call `collapseAll()`. Verify `matTree.collapseAll()` is called (spy on the `@ViewChild('tree')` instance).

* **Virtual Root expands by default (WI-82)**
  * Trigger `loadTree()` for the first time (no previous expansion state). Verify `matTree.expand()` is called for every node in the initial `fileDataSource` (the top-level virtual roots).

* **Tooltip displays full absolute path (WI-82)**
  * Verify that both file and directory nodes in the template bind `[title]` to the `node.path` property.

* **Subscription cancelled on component destroy**
  * Simulate a long-running `getTree()` Observable (never completes). Destroy the component. Verify the Observable is unsubscribed (no subscription-after-destroy; `takeUntilDestroyed` fires).

* **`getTree()` error path**
  * Mock `getTree()` to throw an error. Trigger reload. Verify `fileDataSource` remains unchanged, and `console.warn` is called with the error message.
