---
title: Centralize Assembly PC & Window Logic
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Centralize Assembly PC & Window Logic (WI-112)

> [!NOTE]
> **Source Work Item**: Centralize Assembly PC & Window Logic
> **Description**: Migrate Program Counter (PC) state and centered instruction window logic (+/- 1000) to DapAssemblyService.

## Purpose

Decouple Program Counter (PC) state management and instruction window orchestration from the UI layer. By moving this logic to the `DapAssemblyService`, we ensure that the disassembly view provides a consistent "execution context" that remains stable and reactive, regardless of whether the user is manually scrolling or the debugger has stopped at a new location.

## Scope

- **DapAssemblyService**: Will become the Single Source of Truth (SSOT) for the current active PC and the managed instruction stream.
- **AssemblyViewComponent**: Refactored to be a "dumb" presentation component that reflects the service state.
- **DebuggerComponent**: Updated to update the service-level PC during frame selection and session stops.

## Behavior

1. **PC Hosting**: `DapAssemblyService` exposes `currentPc$` (Observable) and `setPC(address: string)`.
2. **Centered Window Logic**: Calling `setPC()` automatically triggers `fetchInstructions(address, 2001, -1000)`. This ensures that whenever the execution point moves, the UI is pre-loaded with sufficient context before and after the PC.
    - **Split-Request Anchoring**: To prevent the underlying Debug Adapter from swallowing the PC due to backward instruction misalignment (common in variable-length architectures like x86), cache requests spanning negatively across the PC are explicitly split. A positive fetch strictly anchored at `instructionOffset: 0` guarantees the PC boundary is preserved, which is then deduplicated and merged with the negative pre-fetch block.
3. **Reactive UI**: `AssemblyViewComponent` subscribes to `currentPc$`. It uses this value to:
    - Apply the `.is-pc` CSS class for highlighting.
    - Trigger a smooth scroll to center the PC line in the viewport.
4. **Orchestration**: `DebuggerComponent` calls `setPC()` when a stack frame is clicked or when a `stopped` event is processed.

## Acceptance Criteria

1. **Auto-Centering**: After a Step Over/Into/Out, the assembly view must automatically scroll to center the new PC.
2. **Context Persistence**: Switching between frames in the Call Stack must correctly update the instruction stream and PC highlight.
3. **Buffer Consistency**: The instruction list must contain approximately 1000 instructions before and after the PC (total ~2000) upon jump-to-PC.
4. **Performance**: Jumping to a new PC must be smooth, utilizing the `DapAssemblyCacheService` to avoid redundant network requests if the instructions are already cached.

