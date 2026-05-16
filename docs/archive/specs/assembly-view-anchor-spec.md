---
title: Decouple viewport from execution PC in Assembly View
scope: Low-Level Inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
related:
  - work-items.md
---

# Decouple viewport from execution PC in Assembly View (WI-114)

> [!NOTE]
> **Source Work Item**: Decouple viewport from execution PC in Assembly View
> **Description**: Introduce viewAnchor state to preserve manual navigation and improve reactive rendering.

## Purpose

The purpose of this specification is to decouple the execution instruction pointer (PC) from the Assembly View's viewport navigation state. By introducing a dedicated `viewAnchor` signal, the component will preserve a user's manual navigation context (e.g., after using "Jump to Address") across tab switches and re-renders, adhering strictly to the Single Responsibility Principle (SRP).

## Scope

- **Included**: `AssemblyViewComponent` state management, `ResizeObserver` becameVisible logic, `JumpToAddressDialogComponent` interaction, and the constructor's reactive effects.
- **Excluded**: DAP protocol fetching logic, `DapAssemblyCacheService` caching mechanisms, and syntax highlighting logic.

## Behavior

1. **State Separation**: Introduce `viewAnchor = signal<bigint | undefined>(undefined)`. `currentPc` remains an input signal dedicated solely to tracking the active execution line.
2. **Tracking PC**: A reactive effect synchronizes `viewAnchor` with `currentPc` whenever the execution pointer updates (e.g., stepping or pausing), seamlessly panning the view to follow execution flow.
3. **Manual Navigation Override**: "Jump to Address" sets `viewAnchor` to the target address, bypassing `currentPc`. This becomes the new SSOT for the viewport's data rendering.
4. **Resilient Rendering**: The `ResizeObserver` (which handles centering when the component becomes visible after a tab switch) strictly relies on `viewAnchor()` instead of `currentPc()`, preserving the user's manual navigation state.

## Acceptance Criteria

- [ ] The `viewAnchor` signal exists and is the primary coordinate for viewport fetching and rendering.
- [ ] Stepping through code correctly updates `viewAnchor` and centers the viewport on the new `currentPc`.
- [ ] Jumping to a custom address updates `viewAnchor` and navigates the viewport without modifying `currentPc`.
- [ ] Switching to a different UI tab and returning after a "Jump to Address" retains the viewport at the jumped address, rather than snapping back to `currentPc`.
