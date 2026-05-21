---
title: Unify Tree Node Expansion Behavior
scope: UI System Design
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Unify Tree Node Expansion Behavior (WI-128)

> [!NOTE]
> **Source Work Item**: Unify Tree Node Expansion Behavior
> **Description**: Unify mouse click node expansion behavior across variables, thread & call stack, and file explorer panels, and update the visual design document.

## Purpose

The Taro Debugger tree components currently exhibit inconsistent behaviors when clicked.
- **File Explorer**: Clicking anywhere on a directory node row toggles expansion.
- **Variables View**: Clicking the row toggles expansion, but clicking the chevron button triggers a double-toggle because of event bubbling.
- **Thread Call Stack**: Only clicking the tiny chevron button toggles expansion; clicking elsewhere on the row has no effect.

This specification establishes a unified tree node expansion interaction model across the entire application, improving UX consistency and resolving the double-toggle bug in the Variables View.

## Scope

This specification applies to the following components and documents:
- **Components**:
  - [FileExplorerComponent](file:///root/taro-debugger/projects/taro-debugger-frontend/src/app/file-explorer.component.ts) and its template.
  - [VariablesComponent](file:///root/taro-debugger/projects/ui-inspection/src/lib/variables.component.ts) and its template.
  - [ThreadCallStackComponent](file:///root/taro-debugger/projects/ui-inspection/src/lib/thread-call-stack.component.ts) and its template.
- **Documentation**:
  - [visual-design.md](file:///root/taro-debugger/docs/architecture/visual-design.md) (Section 6.4, Side Panel Navigation).

## Behavior

### 1. Unified Click Target for Expansion
For all expandable tree nodes (directories, threads, process root, variable scopes, and nested variable properties), the entire row element is an active click target for toggling the node's expansion state (expand/collapse).

### 2. Event Bubbling & Stop Propagation
To prevent double-toggling or unintended parent row actions:
- All inner buttons (e.g., active thread focus button, memory view button, type overlay button) must call `$event.stopPropagation()` on click.
- The toggle chevron button in the Variables View must either stop click propagation or be modified to prevent triggering the parent row's toggle handler twice.

### 3. Separation of Click Targets
- **Thread Call Stack**:
  - Clicking on a Process or Thread row toggles its expansion.
  - Clicking on the active thread Focus button sets it as active and stops click propagation (does not toggle expansion).
  - Clicking on a Frame row selects and navigates to the frame (does not toggle expansion as it is a leaf node).
- **Variables View**:
  - Clicking on a Scope or Variable row toggles its expansion (if it is expandable).
  - Clicking on the Type Info (`ℹ`) button or Memory (`memory`) button triggers their respective actions/menus and stops click propagation (does not toggle expansion).

## Acceptance Criteria

- **AC-1**: Clicking anywhere on a File Explorer directory row toggles its expansion state.
- **AC-2**: Clicking anywhere on a Variables View scope or expandable variable row toggles its expansion state.
- **AC-3**: Clicking the chevron button in the Variables View toggles expansion exactly once (no double-toggle).
- **AC-4**: Clicking anywhere on a Thread Call Stack process or thread row toggles its expansion state.
- **AC-5**: In the Thread Call Stack, clicking the "Focus" button sets the active thread without expanding or collapsing the thread node.
- **AC-6**: In the Variables View, clicking the type-info (`info_outline`) button or memory (`memory`) button triggers their respective actions without expanding or collapsing the variable node.
- **AC-7**: The visual design documentation ([visual-design.md](file:///root/taro-debugger/docs/architecture/visual-design.md)) is updated to record these unified click-to-expand behaviors.
