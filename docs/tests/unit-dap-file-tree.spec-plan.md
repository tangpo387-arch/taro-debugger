---
title: DapFileTreeService (Source Content LRU Cache) — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/dap-file-tree.service.ts
related-wi: WI-33, WI-34
last_updated: 2026-04-13
---

# DapFileTreeService — Source Content LRU Cache Unit Spec Plan

## Overview

Fully isolated tests for the memory-based LRU cache embedded in `DapFileTreeService`. Covers cache hits, key prioritisation, in-flight deduplication, eviction, and session-bound invalidation.

---

## Test Cases

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

* **Cache flush on `initialized` event**
  * Populate the cache with several entries. Emit a DAP `initialized` event via `DapSessionService.onEvent()`. Verify the internal cache Map size is **zero** immediately after the event.

* **Cache flush on `disconnect()`**
  * Populate the cache. Call `disconnect()`. Verify the internal cache Map size is **zero** and no string references remain (no memory leak).

* **No stale data across sessions**
  * Perform a full session lifecycle (connect → populate cache → disconnect → connect). Verify that after the second connect, a `readFile` call for a previously cached path issues a fresh DAP `source` request (cache was fully cleared).
