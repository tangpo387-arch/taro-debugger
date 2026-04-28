---
title: Future Roadmap
scope: future features, backlog
audience: [Product_Architect, Lead_Engineer, Human Engineer]
---

# Future Roadmap

> This roadmap outlines features scheduled for future exploration. Current targeted version: **v1.0**.

## Milestone v1.1

### WI-31: DAP 'terminated' Event _restart Payload Passing (Status: proposed)

- **Description**: Support context-aware session restart by forwarding the custom _restart field.
- **Details**:
  - Update the DapSessionService to capture the _restart field
  - Ensure disconnect() cycle cleans up stale RxJS subscriptions
  - Modify startSession() initialization sequence to accept and merge this cached _restart data

### WI-30: Local Variable Modification (Status: proposed)

- **Description**: Allow users to modify the values of local variables during a stopped debug session.
- **Details**:
  - Implement a setVariable DAP request within DapSessionService
  - Update app-variables tree component UI to support inline editing
  - Ensure updated values correctly sync back

### WI-79: Non-Stop Mode UI Integration (Status: pending)

- **Description**: Implement per-thread execution state tracking and UI controls for DAP Non-Stop mode.
- **Details**:
  - Handle 'continued' events to update per-thread state
  - Extend threads$ stream with status metadata (running/stopped)
  - Add Pause/Continue buttons to individual thread list items
  - Ensure global execution buttons reflect active thread state in non-stop mode
  - [Test] Verify thread list updates status icon when 'continued' event is received
  - [Doc] docs/archive/specs/non-stop-mode-ui.md

### WI-84: Implement Memory View (Hex Dump) (Status: pending)

- **Description**: Add a low-level memory inspection interface to the center tab group.
- **Details**:
  - 1. Update dap.types.ts with readMemory/writeMemory schemas.
  - 2. Implement DapMemoryService.
  - 3. Create MemoryViewComponent.
  - 4. Integrate into DebuggerComponent tabs and Variables context menu.
  - [Test] Verify memory data matches hex dump after 'readMemory' success.
  - [Doc] docs/archive/specs/memory-view-spec.md

### WI-76: Design Tokens & Dark Mode Support (Status: proposed)

- **Description**: Implement a centralized CSS Variable system to support seamless switching between Light and Dark themes.
- **Details**:
  - Define semantic color tokens (surface, primary, accent, error)
  - Implement theme-switching logic in the main application
  - Standardize transition durations and easings for UI elements
  - [Test] Verify all components adapt correctly to dark theme toggle

### WI-77: Generic Dialog & Notification Framework (Status: proposed)

- **Description**: Create a unified DialogService and Notification system shared across all libraries.
- **Details**:
  - Implement a generic DialogService wrapper around MatDialog
  - Standardize styling for confirmation modals and input prompts
  - Implement a centralized notification bus for non-intrusive feedback
  - [Test] Verify dialog consistency between Editor and Console modules

### WI-78: A11y Audit & Interaction Hardening (Status: proposed)

- **Description**: Conduct a full accessibility audit and harden keyboard interactions for the foundation library.
- **Details**:
  - Perform WCAG 2.1 AA audit on all shared components
  - Standardize keyboard shortcut overlays and focus-trap logic
  - Implement screen-reader friendly labels for interactive icons
  - [Test] Pass accessibility scan with 0 critical violations

### WI-85: Consolidate Debug Panels to Left Sidenav (Status: pending)

- **Description**: Refactor the global layout to move all right sidenav panels (Variables, Call Stack, Breakpoints) into a tabbed Left Sidenav, eliminating the right sidenav to optimize UX and horizontal space.
- **Details**:
  - 1. Remove right mat-sidenav from DebuggerComponent.
  - 2. Add mat-tab-group to the left sidenav (Explorer / Debug).
  - 3. Wrap existing components (Files, Threads, Variables, Call Stack, Breakpoints) in mat-expansion-panels within their respective tabs.
  - [Test] Verify all components render correctly inside expansion panels and state is preserved on tab switch.
  - [Doc] docs/archive/specs/consolidate-left-sidenav.md
