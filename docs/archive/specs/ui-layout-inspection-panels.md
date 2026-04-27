---
title: UI Layout: Thread & Breakpoint Panels
scope: Variables & Call Stack
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# UI Layout: Thread & Breakpoint Panels (WI-69)

> [!NOTE]
> **Source Work Item**: UI Layout: Thread & Breakpoint Panels
> **Description**: Revamp the DebuggerComponent layout to support dedicated sections for Threads (right) and Breakpoints (left).

## Purpose

To define the architectural placement and visual layout of the Thread and Breakpoint panels within the `DebuggerComponent`, ensuring strict adherence to the project's Flush IDE aesthetics and existing grid system.

## Scope

- **Left Sidenav**: Restructuring the single file explorer into a multi-panel container (Files + Breakpoints).
- **Right Sidenav**: Expanding the context view to accommodate Threads, Variables, and Call Stack.

## Exclusions

- This specification does not cover Data Binding or DAP interaction (refer to [inspection-panels-data-binding.md](inspection-panels-data-binding.md) for data flow).
- Component implementation details for the inner contents of Threads and Breakpoints panels.

## Behavior

### 1. Panel Section Structure

Each panel MUST use the standardized `.panel-section` structure.

```html
<div class="panel-section section-name">
  <h3 class="panel-title">Panel Name</h3>
  <!-- Component Here -->
</div>
```

- **Header (`.panel-title`)**: MUST have a fixed height of `32px` and use uppercase text.
- **Divider**: Each panel header MUST have a `1px solid var(--mat-sys-outline-variant)` bottom border that extends full-width.
- **Padding**: Inner content MUST apply `var(--sys-density-panel-padding)` flush to the edges.

### 2. Left Sidebar Arrangement

- **Top**: Files (`app-file-explorer`)
- **Bottom**: Breakpoints (`app-breakpoints`)

### 3. Right Sidebar Arrangement

- **Top**: Threads (`app-threads`)
- **Middle**: Variables (`app-variables`)
- **Bottom**: Call Stack (`app-call-stack`)

## Acceptance Criteria

- [ ] **Section Dividers**: Every panel `h3.panel-title` correctly stretches edge-to-edge with a 1px bottom border.
- [ ] **Sidenav Structure**: Left sidenav contains two vertically stacked panels; right sidenav contains three.
- [ ] **Responsive Box Model**: Panels correctly use `flex` layout constraints without causing visual overflows.
- [ ] **Density System**: Panel content strictly adheres to `--sys-density-panel-padding` tokens.
