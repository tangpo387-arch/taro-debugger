---
title: Decouple Disassembly Cache to Core
scope: Low-Level Inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
related:
  - work-items.md
---

# Decouple Disassembly Cache to Core (WI-111)

> [!NOTE]
> **Source Work Item**: Decouple Disassembly Cache to Core
> **Description**: Migrate disassembly caching and enhancement logic from ui-assembly to dap-core to enable reuse and architectural alignment.

## Purpose

The primary goal is to align the disassembly handling with the project's **Three-Layer Pattern**. By moving the protocol-level caching and instruction enhancement logic to `dap-core`, we ensure that the session layer serves as the Single Source of Truth (SSOT) for disassembled code, while the `ui-assembly` library focuses purely on view-specific concerns (scrolling and sliding windows). This enables future features like Memory View or Register inspection to reuse the disassembly cache.

## Scope

- **`projects/dap-core`**:
  - Define `TaroDisassembledInstruction` and `CachedRange` in `lib/session` (or a new `lib/disassembly`).
  - Implement `DapAssemblyCacheService` to handle the `instructionCache`, `sortedAddresses`, `cachedRanges`, and LRU pruning logic.
  - Port the `enhanceInstructions` logic (symbol normalization, address resolution) to the core service.
- **`projects/ui-assembly`**:
  - Refactor `DapAssemblyService` (or rename to `AssemblyViewService`) to delegate caching and fetching to `DapAssemblyCacheService`.
  - Retain responsibility for `instructions$` UI stream, infinite scroll orchestration (`onViewportScroll`, `fetchMore`), and sliding window logic (dropping items to stabilize the UI).

## Behavior

1. **Protocol Layer (`dap-core`)**:
   - `DapAssemblyCacheService.fetchInstructions()`: Checks the cache for contiguous blocks, identifies gaps, and fetches missing instructions from DAP.
   - `enhanceInstructions()`: Normalizes raw DAP symbols (e.g., removing offsets/brackets) and calculates `byteOffset` and `isFunctionStart`.
   - `pruneCache()`: Evicts instructions furthest from the current IP when the cache limit (e.g., 20,000) is exceeded.
2. **UI Layer (`ui-assembly`)**:
   - Manages a local "sliding window" of instructions for the virtual scroller.
   - Triggers fetches via the core service when approaching viewport boundaries.
   - Syncs with session events (`terminated`, `module`) to clear the cache.

## Acceptance Criteria

- [ ] `DapAssemblyCacheService` is implemented in `dap-core` and exported via `public-api.ts`.
- [ ] `TaroDisassembledInstruction` includes `normalizedSymbol`, `byteOffset`, and `isFunctionStart` properties.
- [ ] `DapAssemblyService` (UI) successfully consumes the core cache service without functional regression in the Assembly View.
- [ ] Infinite scrolling (forward and backward) remains smooth and correctly handles sliding window eviction for UI performance.
- [ ] Unit tests for cache gap-filling and pruning logic are migrated to `dap-core` and pass successfully.
