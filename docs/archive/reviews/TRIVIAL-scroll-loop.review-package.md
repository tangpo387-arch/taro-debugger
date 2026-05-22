---
wi: trivial
title: Unified scroll alignment for disassembly virtual scrolling
author: Lead_Engineer
status: ready-for-review
skills-required: [DEV:TEST, DEV:STATE, DEV:VIS]
---

# Review Package: TRIVIAL-scroll-loop

## 1. Acceptance Criteria

- [x] Unified scroll alignment dynamically updates the viewport offset during forward and backward sliding-window fetches so that content does not jump relative to the viewport.
- [x] All unit tests must pass.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/ui-assembly/src/lib/assembly-view.component.ts` | L134, L247–276 | Exposed getOffsetForIndex; implemented unified distance-preserving offset restoration during forward/backward sliding-window updates. |
| `projects/ui-assembly/src/lib/assembly-view.component.spec.ts` | L270–350 | Added unit tests for scroll offset adjustment in both forward and backward scroll directions. |

## 3. Edge Cases & Design Decisions

- Since the virtual scroll strategy adjusts viewport offset when new instructions are loaded, we measure the relative distance from the viewport's top to the target address *before* updating the array, and restore that exact distance *after* layout detection.
- This unified approach replaces the previous backward-only adjustment logic and applies to both forward and backward page transitions, eliminating the infinite scroll loops caused by unexpected viewport jumps.

## 4. Tests Added

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/ui-assembly/src/lib/assembly-view.component.spec.ts` | `AssemblyViewComponent` -> `AssemblyVirtualScrollStrategy and centering calculation` | should adjust scroll offset correctly when scrolling forward (items removed from top) |
| `projects/ui-assembly/src/lib/assembly-view.component.spec.ts` | `AssemblyViewComponent` -> `AssemblyVirtualScrollStrategy and centering calculation` | should adjust scroll offset correctly when scrolling backward (items added to top) |

## 5. Spec-Plan Updates

N/A (Trivial fix).

## 6. Self-Verification

```text
 ✓ |ui-assembly| projects/ui-assembly/src/lib/assembly-view.component.spec.ts (13 tests) 838ms
   ✓ AssemblyViewComponent (13)
     ...
     ✓ AssemblyVirtualScrollStrategy and centering calculation (3)
       ✓ should calculate correct target scroll offset with variable row heights 37ms
       ✓ should adjust scroll offset correctly when scrolling forward (items removed from top) 53ms
       ✓ should adjust scroll offset correctly when scrolling backward (items added to top) 58ms
```
