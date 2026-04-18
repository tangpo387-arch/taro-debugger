---
title: KeyboardShortcutService — Unit Spec Plan
scope: unit-test
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: src/app/keyboard-shortcut.service.ts
related-wi: WI-43
last_updated: 2026-04-16
---

# KeyboardShortcutService — Unit Spec Plan

## Overview

Tests for global keyboard shortcut interception and Action ID mapping. Focuses on event filtering (NG Zone optimization) and focus guard logic (Monaco whitelist).

---

## Test Cases

* **Global Action Mapping**
  * **F5 (Continue)**: Ensure `F5` key maps to `ActionID.DEBUG_CONTINUE`.
  * **Shift+F5 (Stop)**: Ensure `Shift+F5` maps to `ActionID.DEBUG_STOP`.
  * **Ctrl/Cmd+Shift+F5 (Restart)**: Ensure mapping for restart works on both Ctrl and Meta modifiers.
  * **F9 (Toggle Breakpoint)**: Ensure `F9` maps correctly.
  * **F10/F11/Shift+F11**: Ensure stepping shortcuts map correctly.

* **NG Zone Optimization**
  * **Lazy Zone Entrance**: Verify that random alphanumeric keystrokes do NOT trigger Angular change detection (remain outside zone).
  * **Shortcut Re-entry**: Verify that a matched shortcut triggers a zone re-entry via `ngZone.run()` for broadcast.

* **Focus Guards**
  * **Standard Input Inhibition**: Verify that shortcuts are ignored when focus is in a standard `<input>`.
  * **Monaco Whitelist**: Verify that shortcuts are NOT ignored when focus is in a textarea with the `.inputarea` class.

* **Event Handling**
  * **Prevent Default**: Ensure `preventDefault()` and `stopPropagation()` are called ONLY when a shortcut matches.
