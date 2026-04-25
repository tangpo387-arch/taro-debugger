---
title: Optimize File Explorer and Implement Virtual Root
scope: File Explorer
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Optimize File Explorer and Implement Virtual Root (WI-82)

> [!NOTE]
> **Source Work Item**: Optimize File Explorer and Implement Virtual Root
> **Description**: Consolidate file explorer headers to save space and implement a virtual root node for improved source tree navigation.

## Purpose

The File Explorer currently utilizes a redundant double-header layout, consuming approximately 40px of valuable vertical space. Additionally, the source tree renders absolute paths directly from the system root, leading to deeply nested and repetitive structures (e.g., `test/root/test/...`).

This redesign aims to:

- **Consolidate headers** into the existing `taro-panel` structure to maximize tree visibility.
- **Implement a Virtual Root** that serves as a clean entry point for the project source code.
- **Group external sources** (system headers, third-party libs) to prevent cluttering the main project view.

## Scope

- **Frontend Component**: `projects/taro-debugger-frontend/src/app/file-explorer.component.ts` (and `.html`, `.scss`).
- **Layout Integration**: `projects/taro-debugger-frontend/src/app/debugger.component.html`.
- **Tree Logic**: `projects/taro-debugger-frontend/src/app/dap-file-tree.service.ts`.
- **Shared Panel**: `projects/ui-shared/src/lib/panel/panel.component.ts` (usage of `[panel-actions]`).

## Behavior

### 1. Header Consolidation

- **Removal**: The `div.sidenav-header` in `FileExplorerComponent` is removed.
- **Relocation**: The "Collapse All" button is moved to the `taro-panel` (Files) in `DebuggerComponent`.
- **Space Recovery**: The file tree starts immediately below the 32px panel header.

### 2. Virtual Root Construction

The `DapFileTreeService.buildTreeFromSources` logic is updated:
- **Synthetic Root**: Instead of being unwrapped, the root node is displayed as the first item in the tree.
- **Labeling**:
  - Name: `basename(sourcePath)` (e.g., `/home/user/project` -> `project`).
  - Tooltip: Full absolute `sourcePath`.
  - Icon: `account_tree`.
- **Path Relativization**:
  - If a source path is a sub-path of `sourcePath`, it is rendered **relative** to the virtual root.
  - Redundant parent segments matching the `sourcePath` are stripped.

### 3. External Library Grouping

- Sources that do **not** fall under the `sourcePath` are grouped under a second virtual root named **"External Libraries"**.
- This ensures that system headers (e.g., `/usr/include/stdio.h`) do not pollute the main project structure.

### 4. Tree State Management

- The **Virtual Root** and **External Libraries** nodes are expanded by default upon the first successful `loadedSources` fetch.
- Expansion state snapshots (`snapshotExpandedPaths`) must correctly track these virtual nodes to prevent collapse on library reload (`dlopen`).

## Acceptance Criteria

- [ ] `FileExplorerComponent` has no internal header.
- [ ] "Collapse All" button is visible in the `taro-panel` header and functional.
- [ ] The tree starts with a "Project Root" node named after the current `sourcePath` basename.
- [ ] Files within the project are nested directly under the Project Root (no redundant absolute path segments).
- [ ] Files outside the project (e.g. `/usr/include`) are grouped under "External Libraries".
- [ ] [Test] Clicking "Collapse All" in the panel header successfully collapses all nodes in the tree.
- [ ] [Test] The Virtual Root node is expanded by default when the debugger starts.
- [ ] [Test] Tooltip on the Virtual Root shows the full absolute path.
