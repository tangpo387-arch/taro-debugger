---
title: FileExplorerComponent — Unit Spec Plan
scope: unit-test
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/debugger/file-explorer/file-explorer.component.ts
related-wi: ~
last_updated: 2026-04-13
---

# FileExplorerComponent — Unit Spec Plan

## Overview

Fully isolated tests for `FileExplorerComponent`. Covers `reloadTrigger` change detection, capability-based branching, node click emission, active-file highlight binding, `collapseAll` delegation, `sourcePath` getter, subscription lifecycle, and error-path resilience.

---

## Test Cases

* **`reloadTrigger` first-change guard**
  * Create the component with `reloadTrigger = 0` (initial binding). Verify `DapSessionService.fileTree.getTree()` is **not** called on first render (DAP session not yet ready).

* **`reloadTrigger` reload on increment**
  * After initial render, change `reloadTrigger` from `0` to `1`. Verify `getTree()` is called exactly once, and `fileDataSource` is populated with the returned root's children.

* **Two consecutive increments call `getTree()` twice**
  * Change `reloadTrigger` from `1` to `2`, then `2` to `3`. Verify `getTree()` is called for each distinct value (counter pattern does not coalesce calls).

* **`supportsLoadedSourcesRequest = false` → unsupported fallback**
  * Set `dapSession.capabilities.supportsLoadedSourcesRequest = false`, trigger a reload. Verify `fileTreeSupported = false` is set, `getTree()` is **not** called, and the template renders the unsupported message block.

* **`supportsLoadedSourcesRequest = true` → supported path**
  * Set `dapSession.capabilities.supportsLoadedSourcesRequest = true`, mock `getTree()` to return a root with two children. Trigger reload. Verify `fileDataSource` has the two children (root is unwrapped) and the tree block renders.

* **`fileSelected` emitted on file node click**
  * Call `onNodeClick()` with a node of `type: 'file'`. Verify `fileSelected` EventEmitter emits the node object.

* **`fileSelected` NOT emitted on directory node click**
  * Call `onNodeClick()` with a node of `type: 'directory'`. Verify `fileSelected` does **not** emit.

* **`activeFilePath` highlight binding**
  * Set `activeFilePath = '/foo/bar.cpp'`, populate `fileDataSource` with a node at path `/foo/bar.cpp`. Verify the rendered button has the CSS class `active-file`. Set `activeFilePath = null`. Verify the class is removed.

* **`collapseAll()` delegates to mat-tree**
  * Call `collapseAll()`. Verify `matTree.collapseAll()` is called (spy on the `@ViewChild('tree')` instance).

* **`sourcePath` getter reads from `DapConfigService`**
  * Mock `DapConfigService.getConfig()` to return `{ sourcePath: '/root/test' }`. Verify `sourcePath` getter returns `'/root/test'` and the template renders `Source: /root/test`.

* **Subscription cancelled on component destroy**
  * Simulate a long-running `getTree()` Observable (never completes). Destroy the component. Verify the Observable is unsubscribed (no subscription-after-destroy; `takeUntilDestroyed` fires).

* **`getTree()` error path**
  * Mock `getTree()` to throw an error. Trigger reload. Verify `fileDataSource` remains unchanged, and `console.warn` is called with the error message.
