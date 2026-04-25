---
title: File Explorer Redesign (WI-82)
audience: [Human Engineer, Lead_Engineer]
last_updated: 2026-04-26
---

# File Explorer Redesign (WI-82)

## Purpose

Optimize the File Explorer user interface by consolidating headers, implementing virtual root nodes for project context, and grouping external dependencies to improve navigation efficiency in large codebases.

## Behavior

### 1. Virtual Roots

The File Explorer now presents two primary virtual nodes at the top level:

- **Project Root**: Named after the workspace's `sourcePath` basename. Contains all sources located within the project directory.
- **External Libraries**: A grouping node for sources located outside the `sourcePath` (e.g., system headers, third-party libraries). This node only appears if external sources are detected.

### 2. Auto-Expansion

To reduce clicks, both virtual roots are automatically expanded upon the initial load of the file tree. Subsequent reloads (e.g., due to dynamic library loads) preserve the user's existing expansion state.

### 3. UI Consolidation

- The internal component header has been removed.
- The **Collapse All** action has been moved to the `taro-panel` action slot in the primary debugger layout, aligning with other inspection panels (Variables, Breakpoints).
- Hovering over any node (file or directory) displays a tooltip containing the full absolute path of the resource.

## Technical Implementation

### Tree Construction (`DapFileTreeService`)

The service now constructs a synthetic "Super Root" whose direct children are the visible virtual roots. Sources are categorized during the `loadedSources` processing:

- Sources matching the `sourcePath` prefix are mapped to a relative path tree under the Project Root.
- Other sources are mapped using their absolute paths under the "External Libraries" node.

### Component Logic (`FileExplorerComponent`)

- Expansion state is snapshotted and restored using absolute paths as keys.
- `revealActiveFile` logic ensures that when a user selects a frame in the call stack, the tree expands and scrolls to the corresponding source file, even if it is located deep within the External Libraries group.

## Verification

### Automated Tests

- `file-explorer.component.spec.ts`: Verifies virtual root expansion, tooltip binding, and header button delegation.
- `dap-file-tree.service.spec.ts`: Verifies tree construction logic, grouping, and alphabetical sorting (preserving Project Root as the first entry).

### Manual Verification

1. Open a project and start debugging.
2. Verify the tree shows a node named after the project folder.
3. Verify the "Collapse All" button in the panel header works.
4. Hover over a file to see its absolute path.
