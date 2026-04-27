---
title: Consolidate Debug Panels to Left Sidenav
scope: UI System Design
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Consolidate Debug Panels to Left Sidenav (WI-85)

> [!NOTE]
> **Source Work Item**: Consolidate Debug Panels to Left Sidenav
> **Description**: Refactor the global layout to move all right sidenav panels (Variables, Call Stack, Breakpoints) into a tabbed Left Sidenav, eliminating the right sidenav to optimize UX and horizontal space.

## Purpose

To improve the user experience by adopting an industry-standard layout that reads left-to-right. Consolidating all navigation and state-inspection panels to a single Left Sidenav eliminates right-side visual clutter, frees up critical horizontal space for the Editor and the upcoming Memory View, and prevents dense tree views from awkwardly competing for attention.

## Scope

- Modifying the global `DebuggerComponent` layout by removing the right `<mat-sidenav>`.
- Refactoring the left `<mat-sidenav>` to host a `<mat-tab-group>` with two tabs: **Explorer** and **Debug**.
- Wrapping the existing structural components (Files, Threads, Variables, Call Stack, Breakpoints) inside `<mat-expansion-panel>` containers within their respective tabs.
- **Exclusion Boundaries**: Do not alter the internal business logic, state management, or DAP event handling of the individual components. This is strictly a layout refactoring task.

## Behavior

1. **Unified Navigation (Activity Bar)**: The left sidenav contains a `mat-tab-group` pinned to the top.
2. **Tab Grouping**:
   - **Tab 1 ("Explorer")**: Contains the `Files` component and `Threads` list.
   - **Tab 2 ("Debug")**: Contains the `Call Stack`, `Variables`, and `Breakpoints` components.
3. **Component Stacking**:
   - Components are housed within `mat-expansion-panel` elements to allow vertical space sharing.
   - Panels must default to the expanded state (`expanded="true"`).
   - The panels must be contained in a `mat-accordion` with `multi="true"` enabled, ensuring users can view multiple panels simultaneously.
4. **Main Content Area**: The `<mat-sidenav-content>` component (holding the Editor, Disassembly, etc.) expands to fill the newly freed horizontal space on the right.

## Acceptance Criteria

- [ ] The right `mat-sidenav` is completely removed from the DOM and template.
- [ ] The left `mat-sidenav` successfully renders a `mat-tab-group` with "Explorer" and "Debug" tabs.
- [ ] The "Explorer" tab correctly displays the Files and Threads expansion panels.
- [ ] The "Debug" tab correctly displays the Variables, Call Stack, and Breakpoints expansion panels.
- [ ] All panels can be expanded and collapsed independently.
- [ ] Switching between the Explorer and Debug tabs does not destroy the active state (e.g., expanded variable tree nodes) of the internal components.
