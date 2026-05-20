---
title: "Assembly View: Optimize Cache Hits & DAP Communication Efficiency"
scope: Low-Level Inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer]
related:
  - work-items.md
---

# Assembly View: Optimize Cache Hits & DAP Communication Efficiency (WI-127)

> [!NOTE]
> **Source Work Item**: WI-127: Assembly View: Optimize Cache Hits & DAP Communication Efficiency
> **Description**: Optimize disassembly caching logic and thread stopped queries to eliminate redundant DAP requests, prevent cache-miss loops, and improve stepping performance.

## Purpose

The assembly view uses a sliding window of instructions centered on the active execution address or viewport scroll anchor. During rapid debug stepping or manual scroll traversal, the frontend frequently communicates with GDB/LLDB via the Debug Adapter Protocol (DAP). 

This specification establishes concrete optimization patterns within `DapAssemblyCacheService` and `AssemblyViewComponent` to address critical communication overhead, cache-eviction loops under variable-length instruction architectures (like x86_64), and redundant thread status requests.

---

## Scope

### Included in Specification
- **Sliding Window Scaling**: Reducing the size of the active assembly window requested by the UI to reduce transfer payload and memory overhead.
- **Cache Eviction Correction**: Correcting the backward byte reference calculation in the Neg leg (negative offset) disassembled instruction requests.
- **Partial Cache Hits Support**: Modifying `getFromCache` and `fetchInstructions` to support retrieving sub-ranges from the cache when full matches are not present, avoiding hard-failures that drop into total cache misses.
- **Thread Status Request Consolidation**: Merging redundant `threads` requests made during stop events in `DapSessionService`.

### Excluded from Specification
- Custom disassembler engines or client-side decompilation.
- Persistent filesystem or localStorage caching for disassembly.
- Modifying UI styles or themes (e.g., TailwindCSS remains strictly forbidden).

---

## Behavior

### 1. Sliding Window Scaling
Currently, `AssemblyViewComponent` defines:
```typescript
private static readonly ASSEMBLY_WINDOW_SIZE = 2001;
private static readonly ASSEMBLY_WINDOW_OFFSET = -1000;
```
For typical viewports showing 30–60 lines, a window of 2001 instructions introduces significant over-fetching, serialization latency, and DOM weight.

**Proposed Changes:**
- Scale the window size down to a high-density, performance-optimized viewport model:
  - `ASSEMBLY_WINDOW_SIZE = 201;`
  - `ASSEMBLY_WINDOW_OFFSET = -100;`
- Adjust the `AUTO_FETCH_THRESHOLD` to `20` to ensure smooth pagination during scrolling.

### 2. Correcting Backwards Memory Reference Byte Guessing
When disassembling backwards (instructions before PC), GDB/LLDB requires an absolute memory reference address. The frontend calculates this reference using the byte factor:
```typescript
const guessBytes = BigInt(negCount * 4 + 32);
const fallbackRef = `0x${(startAddr - guessBytes).toString(16)}`;
```
Under x86_64, instructions can average 5–6 bytes (e.g., instruction sequences with multi-byte opcodes and direct indexing). A factor of `4` yields fewer instructions than the requested `negCount`. 
For example, with `negCount = 100` and average length of 5.5 bytes, `432` bytes yields only ~78 instructions. When the cache is populated, the PC will reside at index ~78 of the returned segment. On the next step, requesting `-100` instructions relative to the PC causes a negative index lookup in `getFromCache` (`78 - 100 = -22`), resulting in a **total cache miss** and an infinite loop of redundant DAP requests on every single step.

**Proposed Changes:**
- Increase the byte factor to `6` to ensure the guess memory region is large enough to contain at least the requested `negCount` instructions, adding a robust safety buffer:
  ```typescript
  const guessBytes = BigInt(negCount * 6 + 64);
  ```
- Ensure that the disassembly request requests a safe count margin (e.g., `negCount + 20`) to guarantee backward overlap with the PC reference point, facilitating robust alignment.

### 3. Graceful Partial Cache Hits
In `DapAssemblyCacheService.ts`, the `getFromCache` method currently drops the lookup entirely and returns `[]` if the start index is negative or out of bounds:
```typescript
const startIdx = idx + instructionOffset;
if (startIdx < 0 || startIdx >= range.instructions.length) return [];
```
This forces a total cache miss even if $95\%$ of the requested window is present in the cache range.

**Proposed Changes:**
- Modify `getFromCache` to return a partial array of instructions that *are* available within the cached range instead of returning `[]`.
- Update `fetchInstructions` to evaluate the returned partial slice:
  - If a prefix is missing (e.g., scroll/step moved backward), request only the preceding gap.
  - If a suffix is missing (e.g., scroll/step moved forward), request only the succeeding gap.
  - Merge the newly retrieved slices cleanly using the existing O(K + M) merge pass.

**Gap Pre-fetching & Preloading Buffer:**
- To prevent making high-frequency single-instruction requests during consecutive single-stepping (e.g., `stepi` or `nexti`), enforce a minimum fetch window of `MIN_GAP_FETCH_SIZE = 50` instructions when filling missing gaps:
  - **Suffix preloading**: When a suffix gap of `missingSuffixCount` is detected, request `safeSuffixCount = Math.max(50, missingSuffixCount)` instructions starting at offset `range.instructions.length - idx`.
  - **Prefix preloading**: When a prefix gap of `missingPrefixCount` is detected, request `safePrefixCount = Math.max(50, missingPrefixCount)` instructions. Shift the starting offset backward to `instructionOffset - (safePrefixCount - missingPrefixCount)` to correctly align the preloaded buffer preceding the cached range.

### 4. Consolidating Thread Queries on Stop Events
Upon a debug stop, multiple features (Register view, Call Stack, Thread list, Assembly viewport) trigger thread status requests. Under rapid stepping, `DapSessionService` sends duplicate `threads` queries within milliseconds.

**Proposed Changes:**
- Implement a deduplication or multicast strategy in `DapSessionService.fetchThreads()` (or related streams) using an RxJS `shareReplay({ bufferSize: 1, refCount: true })` or temporary request throttling (e.g., debouncing/coalescing concurrent requests within a single microtask queue).
- Ensure that simultaneous callers of `fetchThreads` during the same stopped event share a single in-flight DAP `threads` request.

---

## Acceptance Criteria

### 1. Viewport & Payload Reduction
- **AC-1**: `ASSEMBLY_WINDOW_SIZE` in `AssemblyViewComponent` must be reduced to `201` (with `ASSEMBLY_WINDOW_OFFSET = -100`).
- **AC-2**: The browser dev tools / terminal log must verify that each sliding window relocation requests no more than `201` instructions.

### 2. Cache Hit Rate Optimization
- **AC-3**: Repeated stepping operations (Step In / Step Over) inside an already loaded range must trigger **zero** new DAP `disassemble` requests, proving a $100\%$ cache hit rate for sequential local steps.
- **AC-4**: Backward steps or scrolls that partially overlap with the cache must only request the missing address interval rather than triggering a full reload.
- **AC-8**: Suffix and prefix gap filling must enforce a minimum preloaded window of `50` instructions when fetching new ranges, pre-caching subsequent stepping/scrolling execution states.

### 3. Robust Backwards Guessing
- **AC-5**: Backward disassembly fetching must use `guessBytes = BigInt(negCount * 6 + 64)` and successfully find the overlapping PC anchor on all target architectures (x86_64/ARM).

### 4. Communication Efficiency & Test Coverage
- **AC-6**: A single `stopped` debug event must trigger at most **one** DAP `threads` request across the entire workspace, consolidated via reactive streams.
- **AC-7**: The following explicit unit tests must pass successfully in Vitest:
  - **UT-1**: Verify partial cache hit returns slice from correct range when requested window boundaries exceed the cached range.
  - **UT-2**: Verify that disassembly fetching uses `guessBytes = BigInt(negCount * 6 + 64)` and disassembles with a margin of `negCount + 20`.
  - **UT-3**: Verify gap-filling for prefix misses fetches only the missing address slice.
  - **UT-4**: Verify concurrent threads queries coalesce into a single in-flight DAP command in `DapSessionService`.
  - **UT-5**: Verify that when the suffix gap is smaller than `50`, the cache service fetches a preloaded window of `50` instructions forward.
  - **UT-6**: Verify that when the prefix gap is smaller than `50`, the cache service fetches a preloaded window of `50` instructions backward using an adjusted negative offset.

---
---
