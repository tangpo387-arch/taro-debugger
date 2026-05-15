---
title: Assembly View: Fix Header Symbol Overflow
scope: Low-Level Inspection
audience: [Lead_Engineer, Product_Architect, Human Engineer]
---

# Assembly View: Fix Header Symbol Overflow

> [!NOTE]
> **Source**: User screenshot showing overlapping text in Assembly View header.
> **Group**: Low-Level Inspection
> **Description**: Resolve the vertical overflow and overlapping text in the sticky function header caused by long C++ mangled symbols.

## 1. Problem Statement

The `.function-header` in `AssemblyViewComponent` has a fixed height (28px/24px) but lacks constraints on text wrapping or horizontal overflow. When a C++ symbol is exceptionally long (e.g., mangled template names), the text wraps into multiple lines, exceeding the fixed container height and rendering on top of the instruction rows. This obscures critical debugging data and violates the "Flush IDE" aesthetic.

## 2. Proposed Changes

### 2.1 Component Logic & State (`assembly-view.component.ts`)

- Import `CppSignaturePipe` from `@taro/ui-shared`.
- Use the pipe in the template to simplify the `activeSymbol` for display.

### 2.2 CSS Constraints (`assembly-view.component.scss`)

Modify `.function-header` and `.symbol-name` to enforce a single-line layout with graceful truncation:

- **`.function-header`**:
  - Add `white-space: nowrap` to prevent words from breaking into new lines.
  - Add `overflow: hidden` to ensure any remaining overflow is clipped.
- **`.symbol-name`**:
  - Add `overflow: hidden`.
  - Add `text-overflow: ellipsis`.
  - Add `min-width: 0` (required for flexbox truncation).
  - Use `flex: 1` to allow the symbol to consume available space.

### 2.3 Template Enhancements (`assembly-view.component.html`)

- Apply `cppSignature` pipe to `activeSymbol` in the display text.
- Add `matTooltip` to the `.symbol-name` span, bound to the **original** `activeSymbol` (full mangled name).
- Add `matTooltipShowDelay="400"`.

## 3. Implementation Specification

### 3.1 Pipe Relocation

Move `projects/ui-inspection/src/lib/cpp-signature.pipe.ts` to `projects/ui-shared/src/lib/pipes/cpp-signature.pipe.ts` and export it from `ui-shared`.

### 3.2 SCSS Refinement

```scss
.function-header {
  flex-shrink: 0;
  height: var(--sys-density-variable-row, 28px);
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 0 var(--sys-density-panel-padding);
  background-color: var(--mat-sys-surface-container-high);
  color: var(--mat-sys-on-surface-variant);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  border-bottom: 1px solid var(--mat-sys-outline-variant);
  z-index: 10;
  
  white-space: nowrap;
  overflow: hidden;

  .symbol-name {
    color: var(--mat-sys-primary);
    font-weight: var(--weight-bold);
    margin-left: 4px;
    
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}
```

### 3.3 Template Update

```html
<div *ngIf="activeSymbol && instructions.length > 0" class="function-header">
  Dump of assembler code for function 
  <span class="symbol-name" 
        [matTooltip]="activeSymbol" 
        matTooltipShowDelay="400">{{ activeSymbol | cppSignature }}</span>:
</div>
```

## 4. Acceptance Criteria

| # | Criterion | Verification Method |
| :--- | :--- | :--- |
| AC-1 | Long symbols are simplified using `cppSignature` (e.g., `<...>` and `(...)` placeholders). | Visual inspection. |
| AC-2 | The header height remains fixed (28px/24px) and does not wrap. | DOM measurement. |
| AC-3 | Hovering over the simplified symbol reveals the **full, unsimplified** mangled name in a tooltip. | Manual hover test. |
| AC-4 | `CppSignaturePipe` is correctly relocated to `ui-shared` and available for both `ui-inspection` and `ui-assembly`. | Build/Import check. |
| AC-5 | The instruction rows below the header are not obscured. | Visual inspection. |

