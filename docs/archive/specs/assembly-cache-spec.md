---
title: Assembly Instruction Cache Implementation
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Assembly Instruction Cache Implementation (WI-110)

> [!NOTE]
> **Source Work Item**: Assembly Instruction Cache Implementation
> **Description**: Implement a memory-resident instruction cache for the disassembly view to improve scrolling performance and reduce redundant DAP requests.

## Purpose

To eliminate redundant `disassemble` requests to the Debug Adapter during rapid scrolling or repeated context switches. This ensures a "Flush IDE" experience with zero-latency re-navigation to previously visited instruction blocks.

## Scope

- **Core Logic**: `DapAssemblyService` (projects/ui-assembly).
- **Data Structures**: In-memory address-keyed Map and range-tracking list.
- **Protocol Optimization**: Gap detection algorithm to only fetch missing instruction segments.

## Behavior

### 1. Address Management

- **Normalization**: All addresses MUST be normalized to lowercase hex strings without the `0x` prefix before caching.
- **Arithmetic**: Address calculations (offsets, range boundaries) MUST use `BigInt` to support 64-bit address spaces.

### 2. Range-Based Cache

The system maintains a list of `CachedRange` objects:

```typescript
interface CachedRange {
  start: bigint; // Absolute address of first instruction
  end: bigint;   // Absolute address of last instruction
}
```

When a request for `[RequestedStart, RequestedEnd]` arrives:
1. Identify sub-ranges within the request that are NOT covered by any `CachedRange`.
2. Fetch only the missing sub-ranges from the DAP.
3. Merge the new instructions into the primary `Map<string, TaroDisassembledInstruction>`.
4. Update and consolidate the `CachedRange` list by merging adjacent or overlapping entries.

### 2.1 Infinite Scrolling (Auto-Fetch)

- **Forward Fetch**: When the UI viewport approaches the end of the cached range (e.g., within 20 instructions of the last cached address), the service MUST automatically trigger a `disassemble` request for the next block (e.g., 100 instructions).
- **Backward Fetch**: When scrolling upwards and approaching the start of the cached range, the service MUST automatically fetch the preceding block.
- **Debouncing**: Fetch requests MUST be debounced to prevent flooding the DAP server during rapid flick-scrolling.

### 3. Eviction Policy

- **Capacity**: Maximum of 10,000 instructions.
- **Policy**: When capacity is exceeded, the cache performs **Spatial Pruning**. It calculates the absolute numerical distance between each `CachedRange` and the current `instructionPointerReference`. The range(s) with the greatest distance are evicted first until memory usage falls below the 80% watermark (8,000 instructions).

### 4. Lifecycle & Invalidation

- **Clear Trigger 1**: `DapSessionService` emits a `terminated` or `disconnect` event.
- **Clear Trigger 2**: The active `threadId` or `frameId` changes (to prevent stale data if memory is remapped).
- **Clear Trigger 3**: Manual "Refresh" action in the UI.

## Acceptance Criteria

1. **Redundancy Test**: Scrolling to an address range, scrolling away, and scrolling back MUST NOT trigger a second `disassemble` request for that range.
2. **Gap Filling**: If a request spans both cached and uncached memory, only the uncached portion is requested from DAP.
3. **Auto-Fetch**: Scrolling near the boundaries of the cached range automatically triggers background loading of adjacent instructions.
4. **Spatial Eviction**: When the 10k limit is hit, instructions farthest from the current IP are removed, while instructions near the IP remain cached.
5. **BigInt Safety**: Handles high-memory addresses (e.g., `0xffffffff80000000`) without precision loss.
