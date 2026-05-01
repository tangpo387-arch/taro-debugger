---
title: Refactor: Centralize Breakpoint State Management
scope: Execution Context Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Refactor: Centralize Breakpoint State Management (WI-103)

> [!NOTE]
> **Source Work Item**: Refactor: Centralize Breakpoint State Management
> **Description**: Migrate 'Local Intent' breakpoint logic to a centralized service for SSOT synchronization.

## Purpose

To eliminate synchronization bugs between the Breakpoints Panel and the Source Editor by centralizing both "Local Intent" (user clicks) and "DAP Reality" (verified breakpoints) into a single reactive service.

## Scope

- **Affected Components**: `EditorComponent`, `BreakpointsComponent`, `DebuggerComponent`.
- **Affected Services**: `DapSessionService` (to be enhanced) or a new `BreakpointService`.

## Behavior

1. **Centralized SSOT**: A single `Observable` stream will broadcast the unified breakpoint state (File -> List of {line, status}).
2. **Status Lifecycle**:
   - `intent`: User clicked in editor/panel but DAP hasn't confirmed yet. Rendered as a grey/hollow circle (optimistic UI).
   - `verified`: DAP confirmed the breakpoint. Rendered as a solid red circle.
   - `error`: DAP rejected the breakpoint. Rendered as an unverified/error glyph.
3. **Optimistic Updates**: Gutter clicks in the editor immediately update the centralized intent map, which triggers an emission to both the Editor (for decoration) and the Sidebar Panel (for the list entry).
4. **Server-Side Sync**: `DapSessionService` handles the debounced `setBreakpoints` calls and updates the SSOT upon response.
5. **Console Sync**: `breakpoint` events from the DAP REPL are merged into the same SSOT.

## Acceptance Criteria

1. [ ] A click in the editor gutter immediately shows a "pending" entry in the Breakpoints Panel (Optimistic UI).
2. [ ] Deleting a breakpoint via the Sidebar trash icon immediately clears the decoration in the Monaco editor.
3. [ ] Using a console command (e.g., `-break-insert`) correctly updates both the Sidebar and Editor views via the centralized stream.
4. [ ] Multi-file breakpoints are correctly preserved and synced even when the respective file is not active in the editor.
