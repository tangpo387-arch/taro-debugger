---
title: Assembly Cache Range Refactor — Remove sortedAddresses
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
last_updated: 2026-05-14
related:
  - work-items.md
  - docs/archive/specs/assembly-cache-spec.md
---

# Assembly Cache Range Refactor — Remove `sortedAddresses` (WI-117)

> [!NOTE]
> **Source Work Item**: WI-117 — Remove `sortedAddresses` from `DapAssemblyCacheService`
> **Exclusion Boundaries**: This spec does not cover the UI-layer infinite scroll logic (`AssemblyViewService`), DAP transport concerns, or any change to the public `fetchInstructions()` API signature.

## Purpose

The current `DapAssemblyCacheService` maintains three separate data structures in parallel:

| Structure | Type | Role |
| :--- | :--- | :--- |
| `instructionCache` | `Map<bigint, DapDisassembledInstruction>` | Keyed instruction store |
| `sortedAddresses` | `bigint[]` | Global sorted index for range walking |
| `cachedRanges` | `CachedRange[]` | Non-overlapping address ranges |

Every time new instructions are merged into the cache, `updateSortedAddresses()` reconstructs and re-sorts the entire `sortedAddresses` array from all keys of `instructionCache`. At the 20,000-instruction cache limit, this is a full $O(N \log N)$ operation executed on every fetch — even when the new batch is only 50 instructions.

This refactor eliminates `sortedAddresses` and the global `Map` by embedding a sorted instruction array directly inside each `CachedRange` object. Merge cost then reduces to $O(K + M)$ where $K$ = instructions in the local range and $M$ = instructions in the incoming batch.

## Scope

### Files Modified

| File | Change |
| :--- | :--- |
| `projects/dap-core/src/lib/session/assembly.types.ts` | Extend `CachedRange` to include `instructions: DapDisassembledInstruction[]` |
| `projects/dap-core/src/lib/session/dap-assembly-cache.service.ts` | Full cache internals rewrite (see §Behavior) |
| `projects/dap-core/src/lib/session/dap-assembly-cache.service.spec.ts` | All existing tests must pass without modification to their assertions |

### Excluded

- The `fetchInstructions()` public signature is **unchanged**.
- No change to `CachedRange.start` / `CachedRange.end` semantics.
- No change to the `enhanceInstructions()` or `buildErrorHintInstructions()` methods.
- No change to session lifecycle subscription (`initSessionSync`).

## Behavior

### 1. Updated Data Model

Replace the parallel triple-structure with a self-contained `CachedRange`:

```typescript
// assembly.types.ts
export interface CachedRange {
  /** Absolute address of the first instruction in the range. */
  start: bigint;
  /** Absolute address byte-end of the last instruction (inclusive). */
  end: bigint;
  /** Instructions sorted ascending by address. No address gaps within this array. */
  instructions: DapDisassembledInstruction[];
}
```

The fields `instructionCache: Map<bigint, ...>` and `sortedAddresses: bigint[]` are **removed** from the service class.

### 2. Cache Lookup — `getFromCache()`

Replace the global `binarySearch(sortedAddresses, ...)` with a local binary search within the matching `CachedRange.instructions` array:

1. Find the `CachedRange` whose `[start, end]` interval contains `referenceAddr`.
2. Binary-search `range.instructions` for `referenceAddr`.
3. Apply `instructionOffset` as a local index offset.
4. Slice up to `count` instructions within the range's contiguous block.

```typescript
// Pseudocode — illustrative only
private getFromCache(referenceAddr: bigint, count: number, offset: number): DapDisassembledInstruction[] {
  const range = this.findRange(referenceAddr);
  if (!range) return [];
  const idx = this.binarySearchInstructions(range.instructions, referenceAddr);
  if (idx === -1) return [];
  const startIdx = idx + offset;
  if (startIdx < 0 || startIdx >= range.instructions.length) return [];
  return range.instructions.slice(startIdx, startIdx + count);
}
```

### 3. Merging New Instructions — `mergeBatchIntoRanges()`

Replace `updateSortedAddresses()` + `updateCachedRanges()` with a single method:

1. Create a new `CachedRange` from the incoming `uniqueEnhanced` batch.
2. Insert it into `cachedRanges` in sorted order (binary insert, not full resort).
3. Merge overlapping or adjacent `CachedRange` entries:
   - When two ranges are merged, their `instructions` arrays are concatenated and de-duplicated by address using the same ascending-order filter already used in `fetchInstructions`.
4. The `CachedRange.start` and `CachedRange.end` are derived from `instructions[0].address` and `instructions.last.address + byteLength - 1`.

**Complexity**: $O(K + M)$ where $K$ = existing range size and $M$ = batch size. No global sort.

### 4. Cache Pruning — `pruneCache()`

- Replace `this.instructionCache.size` with the sum of `range.instructions.length` across all `cachedRanges`.
- `evictRange()` removes the `CachedRange` object from the array — no per-address Map deletions required.
- The distance calculation (`dStart`, `dEnd` from IP) is unchanged.

### 5. `clear()`

```typescript
public clear(): void {
  this.cachedRanges = [];
  this.currentIpRef = null;
}
```

The `instructionCache.clear()` call is removed (no Map exists).

### 6. `binarySearch()` Utility

The existing `binarySearch(arr: bigint[], target: bigint)` is retained but its signature is generalized or overloaded to operate on `DapDisassembledInstruction[]` by comparing `.address`:

```typescript
private binarySearchInstructions(instructions: DapDisassembledInstruction[], target: bigint): number {
  let left = 0, right = instructions.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (instructions[mid].address === target) return mid;
    if (instructions[mid].address < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
```

## Acceptance Criteria

1. **API Stability**: The public method `fetchInstructions(startAddr, count, offset)` behaves identically to the pre-refactor version for all inputs covered by the existing spec suite.
2. **No Global Sort**: `updateSortedAddresses()` does not exist in the refactored service. No call to `Array.prototype.sort()` with the full cache contents is permitted.
3. **Instruction Lookup**: `getFromCache()` correctly returns a contiguous slice from the range-local `instructions` array using binary search.
4. **Range Merge Correctness**: After two contiguous fetches (e.g., `[0x1000, 0x1003]` then `[0x1004, 0x1007]`), the `cachedRanges` array collapses to a single `CachedRange` covering `[0x1000, 0x1007]` with a merged `instructions` array.
5. **Prune Correctness**: When the total instruction count across all ranges exceeds `CACHE_LIMIT`, the range farthest from the current IP is evicted as a single unit; no per-address iteration is required.
6. **Test Regression**: All 8 existing `dap-assembly-cache.service.spec.ts` tests pass without modifying their `expect` assertions.
7. **Memory**: After `clear()` is called, `cachedRanges` is an empty array and all instruction references are garbage-collectible.
