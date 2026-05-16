---
title: Feature Spec - Unified Call Stack Tree (WI-93)
scope: ui-inspection, threads, call-stack, mat-tree
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-05-01
status: Implemented
related:
  - docs/project/system-specification.md
  - docs/architecture/ui-components/inspection.md
---

# Feature Specification: Unified Call Stack Tree

## 1. Purpose

Consolidate the **Threads** and **Call Stack** panels into a single, hierarchical tree view to provide a unified "Execution Context" inspection experience. This alignment reduces cognitive load, improves multi-thread visibility, and prepares the architecture for future multi-process debugging support.

## 2. Scope

- **Included**:
  - Creation of a new `ThreadCallStackComponent` in `@taro/ui-inspection`.
  - Migration of `ThreadsComponent` and `CallStackComponent` logic into the new tree structure.
  - Implementation of a mandatory 3-level tree hierarchy (Process > Thread > Frame) using `mat-tree` to ensure future-proof multi-process support.
  - Integration with DAP `process` event for process naming.
  - Relocation of the combined panel to the **Right Sidebar**.
- **Excluded**:
  - Modification of the Variable Inspector or Breakpoint panels.
  - Support for multiple *active* debug sessions (out of scope for WI-93, though hierarchy must support it).

## 3. Behavior & Interaction Design

### 3.1 Tree Hierarchy

The tree will represent the execution state using the following hierarchy:

1. **Process Node** (Root):
    - **Label**: `[Process Name] (PID: [ID]) - [Status]`
    - **Behavior**: Auto-expanded on session start.
    - **Icon**: `rocket_launch` (Active) or `terminal` (Inactive).
1. **Thread Node** (Level 2):
    - **Label**: `Thread [[ID]] [Name] ([Status])`
    - **Interaction**: Clicking a thread node makes it the "Active Thread" in `DapSessionService`.
    - **Status Markers**: Display a `pause_circle` icon if the thread is stopped.
1. **Stack Frame Node** (Level 3):
    - **Label**: `#[ID] [Function] [Source]:[Line]`
    - **Interaction**: Clicking a frame selects it as the "Active Frame", updating the Editor and Variables view.

### 3.2 Dynamic Data Loading

- **Initial Load**: When the session stops, the `process` and `threads` data are retrieved.
- **On-Demand Frames**: Stack frames for a thread are only fetched via `stackTrace` when the Thread Node is expanded.
- **Persistence**: Expanded/collapsed states of thread nodes should be preserved across step operations where possible.

### 3.3 DAP Event Integration

- **`process` Event**: The component must listen for the DAP `process` event to update the Root Node name.
- **Fallback**: If no `process` event is received, use the `executablePath` basename from the session configuration.

### 3.4 Layout Adjustments

- **Left Sidenav**: Remove the "Threads" panel. The Left Sidenav will now only contain the "Files" panel (File Explorer).
- **Right Sidebar**:
  1. Breakpoints
  2. Variables
  3. **Call Stack (Unified)**

## 4. Technical Constraints

- **Framework**: MUST use Angular Material `mat-tree` with `NestedTreeControl` or `FlatTreeControl`.
- **Reactive State**: MUST bind to `DapSessionService` streams (`threads$`, `activeThreadId$`, etc.).
- **Performance**: Ensure efficient rendering for sessions with 50+ threads using virtual scrolling if necessary (initially 20+ threads should be smooth without it).

## 5. Acceptance Criteria

- [x] A single "Call Stack" panel replaces the separate Threads and Call Stack components.
- [x] Threads are displayed as root nodes, with frames as child nodes.
- [x] Expanding a thread correctly fetches and displays its stack frames.
- [x] Selecting a frame correctly updates the source editor line highlight and the Variables panel.
- [x] The process name is correctly displayed based on the DAP `process` event or fallback logic.
- [x] The Left Sidenav only displays the File Explorer panel.
- [x] [Test] Unit test verifies that clicking a thread node triggers `setCurrentThread` and subsequent `stackTrace` request.
- [x] [Test] Integration test verifies that the active frame is automatically highlighted in the tree after a step operation.
