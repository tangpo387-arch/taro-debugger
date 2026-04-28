---
title: Extract panel group layout component
scope: UI System Design
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Extract panel group layout component (WI-88)

> [!NOTE]
> **Source Work Item**: Extract panel group layout component
> **Description**: Create TaroPanelGroup to encapsulate sibling panel resizing logic

## Purpose

The `debugger.component.ts` currently handles the complex mathematical calculations for distributing vertical heights among its child `taro-panel` components (e.g., `leftFilesHeight`, `rightBreakpointsHeight`). This violates the Single Responsibility Principle (SRP) by mixing view-layer layout orchestration with DAP session management. The purpose of this Work Item is to extract this mathematical logic into a reusable `TaroPanelGroup` container component within the `ui-shared` library.

## Scope

- **Included**:
  - Creation of `TaroPanelGroupComponent` (`ui-shared/src/lib/panel-group/panel-group.component.ts`).
  - Addition of `@Input() public minExpandedHeight: number = 72;` to `taro-panel` (`PanelComponent`).
  - Migration of vertical flex-height calculation logic (`onLeftPanelResizeDrag`, `onRightPanelResizeDrag`) from `DebuggerComponent` to `TaroPanelGroupComponent`.
  - Refactoring of `DebuggerComponent` templates to use `<taro-panel-group>`.
- **Excluded**:
  - Modification of `mat-sidenav` horizontal width resizing logic (`leftWidth`, `rightWidth`). This remains in the parent `DebuggerComponent` for now.
  - Modification of the internal workings of `taro-panel` beyond exposing necessary lifecycle hooks and the new input property.

## Behavior

1. **Component Projection**: `TaroPanelGroup` accepts multiple `<taro-panel>` components via Angular content projection (`@ContentChildren`).
2. **Height Orchestration**: The group component listens to the `(resizeDrag)` events emitted by its child panels. When a drag occurs, it recalculates the appropriate `flex-basis` heights for the dragged panel and its adjacent siblings.
3. **Dynamic Clamping**: The resizing math queries each panel's `minExpandedHeight` property. It guarantees that an expanded panel cannot be shrunk smaller than its declared `minExpandedHeight`, preventing UI overlap or invisible content.
4. **Collapse/Expand Behavior**: 
   - **Collapse**: When a user clicks the panel's header to collapse it, the panel emits an `(expandedChange)` event. The `TaroPanelGroup` updates the collapsed panel's style to a fixed height (`flex: 0 0 var(--sys-density-header-height)`). The drag handle is hidden. Native CSS Flexbox automatically redistributes the freed vertical space to the remaining expanded siblings (which retain `flex-grow: 1`).
   - **Expand**: When re-expanded, the panel returns to its previously recorded `flex-basis` pixel height (`flex: 1 1 <previous_height>px`), restoring the layout perfectly.
5. **Angular Template Safety**: Parent layouts utilizing template reference variables (`#filesPanel`) to check sibling states MUST use optional chaining (`?.` and `?? false`) in expressions (e.g., `[resizable]`). This prevents fatal `undefined` template compilation errors during the first render pass before all sibling nodes are instantiated.
6. **Flexbox Stability & Lazy Locking**: 
   - To prevent flex-proportion skewing during drags, the group lazily locks the physical DOM height (`getBoundingClientRect().height`) of all expanded panels into absolute pixel bases at the exact moment a drag starts.
   - It strictly applies a CSS `min-height` equal to the panel's `minExpandedHeight`. This physically guarantees that CSS Flexbox cannot crush a panel below its minimum bound even when the container's physical height is constrained.
7. **Stacking and Alignment (Edge Cases)**:
   - **Push to Bottom**: If the top panel is expanded and the bottom panels are collapsed, the top panel (`flex-grow: 1`) will automatically push the collapsed headers to the absolute bottom of the container. This matches standard IDE UX (e.g., VS Code).
   - **All Collapsed**: If *all* panels in the group are collapsed, their combined height will not fill the container. Because the group utilizes `justify-content: flex-start`, the collapsed headers will gracefully stack together at the **top** of the container.
8. **State Management**: The group component maintains the height state of its children and applies them dynamically, ensuring the total height of all expanded panels fits within the container's bounds.

## Acceptance Criteria

1. `TaroPanelGroupComponent` is exported from the `ui-shared` module.
2. `PanelComponent` exposes a `minExpandedHeight` input that defaults to `72`.
3. `DebuggerComponent` no longer contains vertical panel height calculation logic (e.g., `onLeftPanelResizeDrag`, `leftFilesHeight` are removed from the component class).
4. The left and right sidebars in the debugger visually resize exactly as they did prior to the refactor.
5. If an individual `<taro-panel>` is collapsed, the `TaroPanelGroup` redistributes the remaining vertical space appropriately among the remaining expanded siblings.
