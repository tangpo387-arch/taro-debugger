---
title: Refine Thread Interaction & Auto-Expansion
scope: Execution Context Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Refine Thread Interaction & Auto-Expansion (WI-102)

> [!NOTE]
> **Source Work Item**: Refine Thread Interaction & Auto-Expansion
> **Description**: Decouple thread click from selection and implement auto-expansion on stop.

## Purpose

Enhance the multi-threaded debugging experience by decoupling navigational interactions (tree expansion) from state-changing interactions (session context switching) and ensuring critical context (call stack) is immediately visible upon process interruption.

## Scope

- **UI Components**: `ThreadCallStackComponent` (Template, SCSS, and TypeScript).
- **Session Layer**: `DapSessionService` (interaction via `setCurrentThread`).
- **Interaction Model**: Mouse clicks on Thread nodes.
- **Event Handling**: `stopped` DAP event lifecycle within the tree view.

## Behavior

### 1. Explicit Thread Selection

- **Removal of Implicit Selection**: Clicking the thread node row (label, status area, etc.) is STRICTLY FORBIDDEN from calling `setCurrentThread`. Row clicks should be reserved for standard tree navigation (node focus/expansion).
- **Focus Action**: A new `mat-icon-button` with the `my_location` icon (material icon) shall be added to the thread node row.
  - **Tooltip**: "Set as Active Thread" or "Focus Thread".
  - **Location**: Right-aligned within the `.node-label` or as a sibling to the label.
  - **Visibility**: The button should be hidden or visually distinct if the thread is already the "Active Thread".
  - **Effect**: Clicking this button executes `dapSession.setCurrentThread(node.threadId)`.

### 2. Auto-Expansion on Stop

- **Reactive Trigger**: When a `stopped` event is received (or when `executionState$` transitions to `stopped`), the component must identify the `activeThreadId`.
- **Forced Expansion**: The tree must automatically expand the node corresponding to the `activeThreadId`.
- **Lazy Loading Integration**: If the thread's stack frames are not yet fetched, the expansion must trigger `fetchFrames` and then expand the node once data is available.
- **Stepping Context**: This behavior must persist across stepping commands (`next`, `stepIn`, etc.) which emit sequential `stopped` events.

## Acceptance Criteria

### Interaction

- [ ] Clicking a thread row label does **not** change the active thread in the session.
- [ ] Clicking the new "Focus" icon button on a thread node **does** update the session's active thread.
- [ ] The "Focus" button is only visible or interactive for non-active threads.
- [ ] Frame selection (Level 3) remains unchanged (clicking a frame node emits `frameSelected`).

### Automation

- [ ] When the debugger pauses (any stop reason), the tree automatically expands the active thread.
- [ ] If frames are not present for the active thread on stop, they are fetched and the node expands after the fetch completes.
- [ ] The process root (`process-root`) remains expanded by default.

### Visuals

- [ ] The active thread indicator (star badge or similar) remains visible and correct.
- [ ] High-density layout is maintained (32px row height).
