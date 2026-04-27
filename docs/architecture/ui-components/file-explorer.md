---
title: Architecture - File Explorer Component
scope: ui-inspection, file-explorer, file-tree
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/ui-components/inspection.md
  - architecture/ui-shared.md
---

# File Explorer Component

The File Explorer provides a navigable tree view of all source files involved in the debug session, categorized by project context.

## 1. Responsibilities

- **Source Discovery**: Displays files fetched via the DAP `loadedSources` request.
- **Project Categorization**: Groups files into virtual roots based on their location relative to the project source path.
- **Navigation**: Allows users to open files in the Source Editor.
- **Auto-Reveal**: Automatically expands and scrolls to the active file when a breakpoint is hit or a stack frame is selected.

## 2. Tree Structure

The explorer uses a synthetic "Super Root" to organize sources into two primary categories:

### 2.1 Project Root

- **Scope**: All sources located within the user's workspace directory.
- **Naming**: Labeled with the project's basename.
- **Behavior**: Automatically expanded on initial load to prioritize local source visibility.

### 2.2 External Libraries

- **Scope**: Sources located outside the project directory (e.g., system headers, `/usr/include`, third-party libs).
- **Behavior**: Grouped under a single node to reduce clutter in the main tree. Only visible if external sources are detected.

## 3. UI Patterns

- **Tooltips**: Hovering over any file or directory displays its absolute path.
- **Global Actions**: Actions like "Collapse All" are hosted in the parent `PanelComponent` header to maintain layout consistency.
- **Expansion State**: The component snapshots and restores the tree expansion state using absolute paths, ensuring consistency during session transitions.

---

## 4. Technical Constraints

- **Reactive Source**: Relies on `DapFileTreeService` for tree construction and sorting.
- **Large Codebases**: Employs virtual scrolling (via `mat-tree`) to maintain performance when thousands of files are loaded.
- **Unsupported State**: If the DAP server does not support `loadedSources`, the panel displays a unified `TaroEmptyStateComponent` explaining the limitation.
