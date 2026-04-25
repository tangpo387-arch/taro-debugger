---
title: DapFileTreeService — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/src/app/dap-file-tree.service.ts
related-wi: WI-33, WI-34, WI-82
last_updated: 2026-04-26
---

# DapFileTreeService — Unit Spec Plan

## Overview

Fully isolated tests for `DapFileTreeService`. Covers source content LRU caching and hierarchical tree construction from DAP `loadedSources` responses, including WI-82 virtual root and external library grouping.

---

## Test Cases (LRU Cache)

* **Cache hit (single request)**
  * Call `readFile('/src/main.cpp')` twice in sequence. Verify `DapSessionService.sendRequest('source', ...)` is called **exactly once**; the second call resolves from cache without a DAP round-trip.

* **`sourceReference` keying priority**
  * Call `readFile` with `sourceReference = 5` and a non-empty `path`. Verify the cache key is `ref:5`, not `path:/src/virtual.cpp`. A subsequent call with the same `sourceReference` but a different path still hits the cache.

* **In-flight deduplication**
  * Initiate two concurrent `readFile('/src/main.cpp')` calls before the first DAP response resolves. Verify `sendRequest` is called **once**, and both callers receive the same resolved content.

* **LRU eviction on capacity overflow**
  * Pre-fill the cache with entries totalling just under 20 MB. Add a new entry that pushes total size over 20 MB. Verify the **least recently used** entry is evicted and total size remains ≤ 20 MB.

* **LRU ordering (access promotes entry)**
  * Fill cache with entries A, B, C (A inserted first). Access A. Add a new entry D that would trigger eviction. Verify B (now the LRU) is evicted, not A.

---

## Test Cases (Tree Construction - WI-82)

* **Virtual Root named after sourcePath basename**
  * Mock `loadedSources` with a file inside `rootPath`. Verify the first child of the returned super-root is named after the basename of `rootPath`.

* **Sources inside rootPath are grouped and relative**
  * Verify `/root/path/src/a.c` appears as `src -> a.c` under the Virtual Root when `rootPath` is `/root/path`.

* **Sources outside rootPath are grouped in 'External Libraries'**
  * Mock a source `/usr/include/stdio.h` with `rootPath = '/home/user/project'`. Verify it appears under a top-level node named 'External Libraries'.

* **External Libraries uses absolute path tree**
  * Verify `/usr/include/stdio.h` appears as `usr -> include -> stdio.h` under the 'External Libraries' node.

* **External Libraries node is omitted if empty**
  * Verify super-root only has one child (the Project root) if all sources are inside `rootPath`.

---

## Lifecycle & Error Path

* **Cache flush on `initialized` event**
  * Populate the cache with several entries. Emit a DAP `initialized` event via `DapSessionService.onEvent()`. Verify the internal cache Map size is **zero** immediately after the event.

* **Cache flush on `disconnect()`**
  * Populate the cache. Call `disconnect()`. Verify the internal cache Map size is **zero** and no string references remain (no memory leak).

* **No stale data across sessions**
  * Perform a full session lifecycle (connect → populate cache → disconnect → connect). Verify that after the second connect, a `readFile` call for a previously cached path issues a fresh DAP `source` request (cache was fully cleared).

* **`getTree()` error resilience**
  * Verify `loadedSources` failure is caught and logged.
