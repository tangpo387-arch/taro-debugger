---
title: EditorComponent — Unit Spec Plan
scope: unit-test
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/editor.component.ts
related-wi: [WI-49]
last_updated: 2026-04-18
---

# EditorComponent — Unit Spec Plan

## Overview

Isolated unit tests for the `EditorComponent`, covering Monaco instance initialization, breakpoint toggling, and view state persistence.

---

## Test Cases

* **Breakpoint Interaction**
  * `toggleBreakpointAtCurrentPosition()`: Should identify the current line from Monaco cursor and toggle the breakpoint.

* **View State Persistence (WI-49)**
  * **R-EVS1**: Should save the Monaco view state using the previous filename in `ngOnChanges`.
  * **R-EVS2**: Should restore the saved view state when switching back to a file that has a stored entry.
  * **R-EVS3**: SHOULD NOT attempt to restore if no saved state exists for the current filename.
  * **R-EVS4**: Logic correctly prioritizes manual scroll position over active line snapping depending on navigation intent.
  * [Test] Verify restore happens after the debounce timeout to ensure the model is ready.
  * [Test] Verify active line snapping is bypassed if a valid viewport state was restored WITHOUT a `revealTrigger` increment.
  * [Test] Verify active line snapping is FORCED if a `revealTrigger` increment is detected, regardless of view state restoration.
