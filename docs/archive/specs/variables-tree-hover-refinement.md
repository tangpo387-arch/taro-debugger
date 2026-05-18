---
title: Specification - Variables Tree UX Refinement (Hover-to-Reveal)
scope: ui-layer, variables-inspection, ux-refinement
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-17
related:
  - ../../file-map.md
  - ../../project/system-specification.md
  - memory-view-spec.md
---

# Specification: Variables Tree UX Refinement (Hover-to-Reveal)

## 1. Purpose

The purpose of this specification is to resolve a major UX disruption in the variables inspection panel. Currently, left-clicking anywhere on a variable row triggers a floating popup menu (containing the "Inspect Memory" action). This disrupts standard developer workflows, such as clicking to focus/select rows, navigating the panel, or toggling node expansions.

This specification introduces a premium **Hover-to-Reveal Inline Shortcut** (Option B). Regular left-clicks are decoupled from the popup menu, and instead, a context-aware inline action button is displayed dynamically on row hover for variables that support memory inspection.

## 2. Scope & Exclusion Boundaries

- **In-Scope**:
  - Modifying `projects/ui-inspection/src/lib/variables.component.html` to remove the row-level `[matMenuTriggerFor]` and replace it with a hover-triggered inline shortcut.
  - Modifying `projects/ui-inspection/src/lib/variables.component.scss` to define visual alignment, layout density, and hover fade-in transitions.
  - Modifying `projects/ui-inspection/src/lib/variables.component.ts` to coordinate row interaction logic.
  - Updating Vitest unit tests in `projects/ui-inspection/src/lib/variables.component.spec.ts` to assert correct left-click behavior, hover-state capabilities, and event emission.
- **Exclusions**:
  - This spec does NOT cover changing variable values (which is tracked in WI-30).
  - This spec does NOT cover the layout visualization casts or structure shading within the Memory View itself (tracked in WI-120).

## 3. Component Behavior & Interaction Design

The refined interaction model for `VariablesComponent` enforces strict separation between generic tree navigation and specialized variable operations:

### 3.1 Standard Navigation Flow (Left-Click)

- **Action**: Normal left-clicking on a variable row.
- **Outcome**:
  - If the row represents an expandable node, it toggles node expansion (Lazy-loading child nodes if first opened).
  - Highlights/focuses the clicked row to show focus state.
  - **No context menu is displayed.**

### 3.2 Action Shortcut Flow (Hover & Context-Aware Icon)

- **Action**: Hovering the cursor over a variable row.
- **Condition Check**: The system checks if the hovered node has a non-empty `memoryReference` string (indicating it is a pointer, array, or object that GDB can read raw memory from).
- **Outcome**:
  - If a `memoryReference` is present, a small, semi-transparent inline action button fades into view on the far right end of the row.
  - Clicking this button immediately calls `onInspectMemory(node.memoryReference)` and emits `inspectMemoryRequest`.
  - The button is accompanied by a material tooltip: `Inspect Memory`.
  - If no `memoryReference` is present (e.g. primitive integers, floats, local scopes), no action button is rendered, maintaining a clean, high-density presentation.

[Diagram: Variable Row Layout and Hover State Transition]

```text
+-------------------------------------------------------------+
| > Locals : Scope                                            |
|   i : int = 32767                                           |
|   my_ptr : char* = 0x7fffffffdc00           [Inspect Memory]| <-- Cursor Hovering
+-------------------------------------------------------------+
```

## 4. Styling & Visual Specification

To maintain high density and clean alignments, the inline action button resides inside the main row flexbox layout:

```scss
// projects/ui-inspection/src/lib/variables.component.scss

.variable-row {
  display: flex;
  align-items: center;
  height: var(--sys-density-variable-row, 32px);
  position: relative;
  
  // Truncating standard values to make room for inline actions when hovered
  .var-value {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // Hover Action Button Container
  .row-action-btn {
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
    width: 24px;
    height: 24px;
    line-height: 24px;
    padding: 0;
    margin-left: 8px;
    flex-shrink: 0;

    mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      line-height: 16px;
    }
  }

  // Reveal inline actions on hover
  &:hover {
    .row-action-btn {
      opacity: 1;
    }
  }
}
```

## 5. Verification & Test Plan

Unit test coverage must be robustly updated in `variables.component.spec.ts` using the Vitest framework and Angular TestBed.

### 5.1 Required Test Cases

1. **Standard Interaction Verification**:
   - Assert that clicking a variable row does not invoke any context menu or emit `inspectMemoryRequest`.
2. **Hover Action Visibility Verification**:
   - Set up test tree data containing variables with and without `memoryReference`.
   - Assert that the HTML template renders the `.row-action-btn` only for rows containing a valid `memoryReference`.
3. **Hover Action Click Verification**:
   - Simulate a click on the `.row-action-btn` button.
   - Assert that the component triggers the `onInspectMemory()` method and that `inspectMemoryRequest` correctly emits the corresponding `memoryReference` string.

## 6. Acceptance Criteria

- [ ] **Decoupled Row Click**: Normal clicks on variable rows toggle expansions or select the row without triggering the `mat-menu` or overlays.
- [ ] **Context-Aware Button**: The inline action button (`memory` icon) is rendered only for nodes containing a non-empty `memoryReference`.
- [ ] **Hover State Transition**: The inline action button is invisible (or opacity `0`) by default and fades in smoothly on row hover.
- [ ] **Action Integrity**: Clicking the inline action button triggers `onInspectMemory()` and fires the `@Output() inspectMemoryRequest` event emitter.
- [ ] **Passes Validation**: Vitest unit tests verify the above behaviors with 100% assertion pass rate.
