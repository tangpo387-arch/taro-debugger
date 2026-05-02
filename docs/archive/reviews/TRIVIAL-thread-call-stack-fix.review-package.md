---
wi: TRIVIAL
title: Fix Thread Call Stack Node Conflicts and Auto-Expansion Bug
author: Lead_Engineer
status: ready-for-review
skills-required: [[DEV:STATE] Reactive State Flows, [DEV:ANG] Angular Feature Specs]
---

# Review Package: TRIVIAL-thread-call-stack-fix

## 1. Acceptance Criteria

> As a Trivial Change, this resolves an architectural console warning and a reported UI bug.

- [x] Resolve "conflicting node types" error by converting `mat-nested-tree-node` to `mat-tree-node` (flat tree).
- [x] Enable horizontal scrollbar by removing label truncation and allowing tree expansion.
- [x] Eliminate phantom vertical scrollbars using `display: inline-block` with `vertical-align: top`.
- [x] Implement `position: sticky` on the "Focus" button to keep it visible during horizontal scrolling.
- [x] Create `CppSignaturePipe` to automatically collapse heavily nested C++ template arguments.
- [x] Prevent active thread from force-expanding when clicking other threads (respect manual collapse).
- [x] Ensure auto-expansion still triggers on a "fresh" stop or thread switch.
- [x] [Test] Verify tests pass, including auto-expansion, explicit selection, and C++ signature parsing.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/ui-inspection/src/lib/cpp-signature.pipe.ts` | New File | Created an O(n) structural parser to collapse `<...>` and `(...)` in C++ signatures safely. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.ts` | Imports | Imported `CppSignaturePipe` to the standalone imports array. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.html` | L18 | Applied `cppSignature` pipe and `[matTooltip]` to the function name element. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.scss` | Layout | Fixed phantom scrollbars using `vertical-align: top`, and added `position: sticky` to `.focus-button` with background color masking. |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | Core Tests | Updated tree node selectors for flat DOM structure, and adjusted test timing. |
| `projects/ui-inspection/src/lib/cpp-signature.pipe.spec.ts` | New File | Full suite for testing C++ template and operator overload parsing edge cases. |

## 3. Edge Cases & Design Decisions

- Decision: Converted to a purely flat tree using `childrenAccessor`. This correctly aligns with Angular Material's recommended approach for hierarchical data without using `TreeControl`, eliminating the "conflicting node types" warning.
- Decision: Used a sticky state flag (`autoExpandedActiveThread`) instead of recalculating expansion purely based on DAP events. This ensures that the active thread stays expanded during asynchronous cache reloads (which recreate objects), while correctly letting go of the expansion state if the user manually collapses it.
- Decision: Implemented a Regex pre-pass in `CppSignaturePipe` to temporarily mask operator overloads (e.g., `operator<<`). This allows the O(n) parser to blindly collapse all remaining `<...>` structures without mangling valid C++ operator syntax.
- 🔍 Inspect: The `CppSignaturePipe` logic. Verify the fallback logic correctly handles unbalanced brackets and effectively collapses extremely deep template nesting without redundant output.

## 4. Tests Added/Modified

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | `Explicit Thread Selection` | should NOT call setCurrentThread when a thread row label is clicked (Updated selectors) |
| `projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts` | `Auto-Expansion on Stop` | should expand the active thread even if frames were already cached (Updated with state transition) |
| `projects/ui-inspection/src/lib/cpp-signature.pipe.spec.ts` | `CppSignaturePipe` | handles extremely long C++ template lambda signatures (regression test for full parser pipeline) |

## 5. Spec-Plan Updates

| Spec-Plan File | Section Added |
| :--- | :--- |
| `N/A` | `Trivial UI and State Bug Fix` |

## 6. Self-Verification

```bash
> taro-debugger-frontend@1.0.0-dev test:file
> ng test ui-inspection --include=**/thread-call-stack.component.spec.ts,**/cpp-signature.pipe.spec.ts --watch=false

 ✓ |ui-inspection| projects/ui-inspection/src/lib/cpp-signature.pipe.spec.ts (6 tests) 5ms
   ✓ CppSignaturePipe (6)
     ✓ creates an instance 1ms
     ✓ simplifies template arguments 1ms
     ✓ handles operator overloads gracefully without mangling 0ms
     ✓ returns original string if brackets are unbalanced 0ms
     ✓ returns empty string for undefined input 0ms
     ✓ handles extremely long C++ template lambda signatures 1ms

 ✓ |ui-inspection| projects/ui-inspection/src/lib/thread-call-stack.component.spec.ts (6 tests) 671ms
   ✓ ThreadCallStackComponent (6)
     ✓ Explicit Thread Selection (3)
       ✓ should NOT call setCurrentThread when a thread row label is clicked 236ms
       ✓ should call setCurrentThread when the Focus button is clicked 66ms
       ✓ should NOT show Focus button for the currently active thread 57ms
     ✓ Auto-Expansion on Stop (2)
       ✓ should automatically expand the active thread and fetch frames on stopped event 69ms
       ✓ should expand the active thread even if frames were already cached (override manual collapse) 143ms
     ✓ Frame Interaction (1)
       ✓ should emit frameSelected when a frame node is clicked 100ms

 Test Files  2 passed (2)
      Tests  12 passed (12)
```
