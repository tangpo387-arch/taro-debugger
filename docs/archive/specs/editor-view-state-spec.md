---
title: Editor View State Persistence Specification
scope: editor-features, cursor-persistence, monaco-view-state
audience: [Human Engineer, Product_Architect, Lead_Engineer]
last_updated: 2026-04-18
---

# Editor View State Persistence Specification

## 1. Overview

To improve user experience when navigating between multiple source files during a debug session, the editor should remember and restore the cursor position and selection for each file.

## 2. Requirements

### R-EVS1: Per-File State Storage

- The system must maintain a mapping of absolute file paths to their respective Monaco editor view states.
- The view state should include cursor position (line and column) and any active selection.
- View state should be preserved as long as the `DebuggerComponent` (and its child `EditorComponent`) remains active.

### R-EVS2: Automatic Save and Restore

- **Save Trigger**: When the active file in the editor is about to change (e.g., via `@Input() filename` change), the current editor view state must be saved for the *previous* file.
- **Restore Trigger**: When a new file is opened and its code is loaded into the editor, the component must check if a saved view state exists for this path and restore it if found.
- **Initial State**: If no saved state exists for a file, the cursor should default to the top of the file (or the active line if one is provided).

### R-EVS4: Navigation Priority

- **Passive vs. Active Navigation**: The system must differentiate between background file selection (passive) and explicit debugging reveals (active).
- **Priority Rule**: When a user selects a file via the file tree, the saved view state (scroll/cursor) MUST take precedence over any current `activeLine` highlight in that file.
- **Reveal Overrides**: Explicit debug actions (Breakpoint hits, Stepping, or Stack-Frame clicks) MUST force a "reveal" that scrolls to the `activeLine`, even if a view state was recently restored.

### R-EVS3: Session Lifecycle

- View state persistence is session-scoped only.
- Persistence does not need to survive across application restarts or session resets (return to Setup view).
- Persistence is not required across "Release" or "Stop" actions if they result in navigating away from the debug view.

## 3. Implementation Details

### Data Structure

The `EditorComponent` will use a `Map<string, any>` where `any` is the `ICodeEditorViewState` type returned by `editorInstance.saveViewState()` from `ngx-monaco-editor-v2`.

```typescript
private readonly viewStates = new Map<string, any>();
```

### Flow

1. `EditorComponent` receives a new `filename` via `ngOnChanges`.
2. Component saves the current view state using the *old* filename (if not null).
3. Component updates the editor model with the new code and language.
4. Component checks for a saved view state for the *new* filename:
   - If found: call `editorInstance.restoreViewState()`.
   - If not found: check if `activeLine` is provided; if so, scroll to it.
5. **Priority Override**: If the navigation was triggered by an explicit reveal (tracked via an incrementing `revealTrigger` input), `editorInstance.scrollToLine(activeLine)` is called *after* restoration, ensuring the execution context and breakpoint are visible.

## 4. Acceptance Criteria (Verification)

- [ ] **T-EVS1**: Open `main.cpp`, move cursor to line 50. Switch to `utils.cpp`. Switch back to `main.cpp`. Verify cursor is at line 50.
- [ ] **T-EVS2**: Select a block of text in `main.cpp`. Switch to another file and back. Verify the selection is restored.
- [ ] **T-EVS3**: Verify that switching to a new file that has never been opened defaults to line 1 or the `activeLine` highlight.
- [ ] **T-EVS4**: Restoring state for a large source file (e.g., 5k+ lines) occurs without visible UI lag (<16ms).
- [ ] **T-EVS5**: While at a breakpoint in `main.cpp`, scroll to the bottom of the file. Switch to `utils.cpp`. Switch back to `main.cpp` using the **File Tree**. Verify the viewport remains at the bottom, NOT snapped to the breakpoint.
- [ ] **T-EVS6**: Perform the same as T-EVS5, but switch back to `main.cpp` by clicking the **Stack Frame** in the Call Stack panel. Verify the viewport snaps to the breakpoint line.

## 5. Scope & Exclusions

> [!IMPORTANT]
> - **No Permanent Persistence**: View states are stored in volatile component memory. Closing the debug session or reloading the app will clear all positions.
> - **No Multi-Editor Sync**: State is managed locally within a single `EditorComponent` instance.
> - **No Content Synchronization**: If the underlying file content changes on disk without the editor's knowledge, cursor positions may drift.
