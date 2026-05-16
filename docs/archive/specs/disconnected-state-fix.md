---
title: Fix Disconnected State Display Inconsistency
scope: General
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Fix Disconnected State Display Inconsistency (WI-122)

> [!NOTE]
> **Source Work Item**: Fix Disconnected State Display Inconsistency
> **Description**: Synchronize file-tree and assembly-view behavior on debugger disconnect to ensure stale data is cleared and consistent empty states are shown.

## Purpose

To resolve visual inconsistencies and stale data display when the DAP session disconnects. Currently, the `FileExplorerComponent` clears its tree upon disconnect, while the `AssemblyViewComponent` retains its instruction list and cached data. This spec defines a unified lifecycle response for all debug-data views.

## Scope

- **Affected Services**: `DapAssemblyCacheService`, `DapFileTreeService`.
- **Affected Components**: `AssemblyViewComponent`, `FileExplorerComponent`.
- **Exclusions**: Does not cover `EditorComponent` buffer persistence (Editor state is managed separately by the user's active file selection).

## Behavior

### 1. Unified Disconnect Lifecycle

All session-dependent services and components MUST monitor `DapSessionService.connectionStatus$`. When `connected` transitions to `false`:
- **State Clearing**: All memory-resident debug data (instruction caches, loaded source lists, register states) MUST be flushed immediately.
- **UI Transition**: Components MUST transition to a "Disconnected" or "No Active Session" empty state.

### 2. Service Level: DapAssemblyCacheService

- **Requirement**: Must subscribe to `DapSessionService.connectionStatus$`.
- **Action**: Call `this.clear()` when `connected === false`. This ensures that even if a component remains mounted, it cannot fetch stale instructions from the cache.

### 3. Component Level: AssemblyViewComponent

- **Requirement**: Must monitor `DapSessionService.connectionStatus$`.
- **Action**:
  - Clear the `instructions` array.
  - Reset `activeSymbol` to `null`.
  - Display `TaroEmptyStateComponent` with `icon="link_off"` and `message="No active session"`.

### 4. Component Level: FileExplorerComponent

- **Requirement**: Ensure the `TaroEmptyStateComponent` is visible when disconnected.
- **Action**:
  - Maintain the existing `fileDataSource = []` clear logic on disconnect.
  - Update template to show `taro-empty-state` when `fileDataSource.length === 0` and `fileTreeSupported === true`, indicating that a session is required to load sources.

### 5. Component Level: MemoryViewComponent

- **Requirement**: Must monitor `DapSessionService.connectionStatus$`.
- **Action**:
  - Clear current memory chunks and address state.
  - Display `TaroEmptyStateComponent` with `icon="link_off"` and `message="No active session"`.

### 6. Component Level: EditorComponent

- **Requirement**: Must monitor `DapSessionService.connectionStatus$`.
- **Action**:
  - When disconnected, if no local file is selected or if the current view depends on active debug state (e.g. temporary source buffers), transition the editor container to a "No active session" state.
  - *Note*: If the user is viewing a persistent local file, the editor may remain visible, but debug-specific overlays (PC pointers, variable tooltips) MUST be cleared.

## Acceptance Criteria

1. **AC-1**: Closing the debugger connection immediately clears all rows from the Disassembly view and Memory view.
2. **AC-2**: The Disassembly and Memory views display a "No active session" empty state message when disconnected.
3. **AC-3**: The File Explorer displays a "No active session" empty state message when disconnected.
4. **AC-4**: `DapAssemblyCacheService` and `DapMemoryService` internal caches are cleared after a disconnect.
5. **AC-5**: [Test] Vitest unit tests verify clearing logic for all session-dependent services.
