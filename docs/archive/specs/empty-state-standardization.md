---
title: Standardize Empty States
scope: UI System Design
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Standardize Empty States (WI-80)

> [!NOTE]
> **Source Work Item**: Standardize Empty States
> **Description**: Unify the visual pattern for empty data states across all functional panels using a reusable TaroEmptyStateComponent

## Purpose

The Taro Debugger interface currently exhibits inconsistent visual behavior when panels (File Explorer, Threads, etc.) contain no data. Some use centered icons and text (Breakpoints), while others use plain text aligned to various positions. This document defines a unified, premium "Empty State" pattern to ensure visual consistency across the entire IDE.

## Scope

This specification covers the creation of a reusable component and its integration into the following functional areas:
- **Left Panel**: File Explorer, Threads.
- **Right Panel**: Breakpoints, Variables, Call Stack.

## Behavior

### 1. `TaroEmptyStateComponent` (@taro/ui-shared)

A new standalone component will be introduced to encapsulate the empty state pattern.

**API Contract:**
- `icon?: string`: Material Symbol name (e.g., `'visibility_off'`, `'info'`).
- `message: string`: Primary status text (e.g., `'No variables available'`).
- `description?: string`: Optional multi-line explanation.
- `centered: boolean = true`: If true, centers content horizontally and vertically.

**Visual Rules (SCSS):**
- **Container**: Flex column, `align-items: center`, `justify-content: center` (if centered), `padding: 48px 24px`.
- **Icon**: `font-size: 32px`, `color: var(--mat-sys-on-surface-variant)`, `opacity: 0.5`, `margin-bottom: 12px`.
- **Message**: `font-size: var(--text-base)`, `color: var(--mat-sys-on-surface-variant)`, `font-weight: var(--weight-medium)`.
- **Description**: `font-size: var(--text-sm)`, `color: var(--mat-sys-outline)`, `margin-top: 4px`, `text-align: center`.

### 2. Integration Mapping

| Component | Message | Icon | Description |
| :--- | :--- | :--- | :--- |
| **Breakpoints** | No breakpoints set | `visibility_off` | — |
| **Variables** | No variables available | `inventory_2` | Try pausing execution to inspect local variables. |
| **Threads** | No active threads | `format_list_bulleted` | — |
| **Call Stack** | No call stack information available | `reorder` | — |
| **File Explorer** | File tree cannot be displayed | `info` | DAP Server does not support loadedSources requests. |

## Acceptance Criteria

- [ ] `TaroEmptyStateComponent` is implemented in `projects/ui-shared/src/lib/empty-state`.
- [ ] Unit tests for the component verify that `icon` and `description` are optional and rendered correctly.
- [ ] The `placeholder-content` and `unsupported-message` CSS classes in functional components are removed in favor of the new component.
- [ ] The File Explorer's "unsupported" state is updated to use the unified component.
- [ ] All 5 panels demonstrate a consistent vertical centering and visual weight when empty.
- [ ] **Architecture Update**: `docs/architecture/visual-design.md` is updated to mandate `TaroEmptyStateComponent` for all future functional panels with empty states.

