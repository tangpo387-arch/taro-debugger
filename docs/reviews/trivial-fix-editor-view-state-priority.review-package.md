---
wi: trivial-fix-editor-view-state-priority
title: Fix Editor View State Priority vs Active Line Snap
author: Lead_Engineer
status: ready-for-review
skills-required: [advanced-angular, visual-design, test-case-writing]
audience: [Human Engineer]
---

# Review Package: trivial-fix-editor-view-state-priority

## 1. Description

Fixed a bug in WI-49 implementation where switching back to a file with an active breakpoint via the file tree would cause the editor to snap to the breakpoint line, overriding the user's previously scrolled position (e.g., at the bottom of the file).

## 2. Acceptance Criteria

- [x] View state restoration is preserved when navigating via the file tree even if the file contains an active line.
- [x] Explicit reveal actions (Step Over, Breakpoint Hit, Stack Frame Click) still correctly snap to the active line.
- [x] Restoration of state for the first time in a session still defaults to the active line if no state exists.

## 3. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `src/app/editor.component.ts` | L81–82, L92–93, L110–135, L146–148 | Introduced `revealTrigger` to differentiate between passive and active navigation. |
| `src/app/debugger.component.html` | L78–81 | Wired `fileRevealTrigger` to the Editor. |

## 4. Edge Cases & Design Decisions

- **Reveal Trigger Concept**: Leveraged the existing `fileRevealTrigger` from `DebuggerComponent` (originally for tree discovery) to provide context to the `EditorComponent`.
- **Priority Logic**: The editor now only snaps to the `activeLine` if:
  1. `revealTrigger` was incremented (active action).
  2. OR `stateRestored` is false (first time opening the file).
  Otherwise, it respects the `restoreViewState()` output.

## 5. Tests Added

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `src/app/editor.component.spec.ts` | `View State Persistence` | should NOT snap to active line if state was restored and no reveal was requested |
| `src/app/editor.component.spec.ts` | `View State Persistence` | should snap to active line if revealTrigger was incremented even if state was restored |

## 6. Self-Verification

```text
 ✓ View State Persistence (5)
   ✓ ...
   ✓ should NOT snap to active line if state was restored and no reveal was requested 102ms
   ✓ should snap to active line if revealTrigger was incremented even if state was restored 105ms
```
