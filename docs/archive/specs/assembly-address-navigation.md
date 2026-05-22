---
title: Assembly View - Address-Based Navigation
scope: Low-Level Inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
wi: WI-113
related:
  - ../reviews/WI-112.review-package.md
  - ../../architecture/visual-design.md
last_updated: 2026-05-03
---

# Assembly View: Address-Based Navigation (WI-113)

## Purpose

The `cdk-virtual-scroll-viewport` in `AssemblyViewComponent` renders a sliding window of disassembled instructions fetched on-demand via `DapAssemblyService.relocateWindow()`. Because the total instruction count across the target's full address space is unknown at runtime (the DAP `disassemble` request does not expose a memory map), the CDK viewport's internal `totalContentSize` is derived only from the currently buffered `+/- 1000` instruction window. This causes the vertical scrollbar thumb to represent a meaninglessly small fraction of actual addressable space, misleading users about their position in the binary.

This spec defines the replacement navigation model: the scrollbar is hidden, and a **Jump-to-Address** floating button is added alongside the existing "Return to PC" FAB. Clicking the button opens a `MatDialog` containing a hex address input, providing intentional, address-accurate navigation without modifying the Assembly View toolbar or header area.

## Scope

**In scope:**
- Hiding the `cdk-virtual-scroll-viewport` vertical scrollbar via CSS in `assembly-view.component.scss`.
- Adding a new `mat-mini-fab` floating button (icon: `search` or `pin_drop`) positioned in `.floating-actions`, side-by-side with the existing "Return to PC" FAB.
- Creating a lightweight `JumpToAddressDialogComponent` (standalone, in `ui-assembly`) opened via `MatDialog` on button click.
- Wiring the dialog's confirmed address to call `DapAssemblyService.relocateWindow()` with the parsed hex address.
- Input validation inside the dialog (hex format enforcement, inline error feedback).

**Out of scope:**
- A visual mini-map or gutter-based function navigator (deferred).
- Horizontal scrollbar changes.
- Any modification to the Assembly View toolbar — the header area is intentionally unchanged.
- Changes to `DapAssemblyService`, `DapAssemblyCacheService`, or any DAP protocol logic — `relocateWindow()` is the existing correct primitive.
- Any modification to the "Return to PC" floating action button behavior (retained from WI-112).

## Behavior

### B1 — Scrollbar Removal

- The `cdk-virtual-scroll-viewport` (`.assembly-viewport`) MUST have its vertical scrollbar hidden via `::-webkit-scrollbar { display: none; }` scoped within `assembly-view.component.scss`.
- Mousewheel and trackpad scrolling MUST remain fully functional.
- The existing `scrolledIndexChange` subscription and infinite-scroll auto-fetch behavior MUST NOT be affected.

### B2 — Jump-to-Address Floating Button

- A new `mat-mini-fab` button MUST be added to the `.floating-actions` container in `assembly-view.component.html`, positioned **above** the existing "Return to PC" FAB (i.e., rendered first in DOM order within the flex-column).
- Icon: `pin_drop`. Tooltip: `Jump to address`.
- The button MUST be visible whenever `currentPc()` is truthy (same condition as the Return-to-PC FAB).
- Clicking the button MUST open `JumpToAddressDialogComponent` via Angular's `MatDialog.open()`.

### B3 — Jump-to-Address Dialog (`JumpToAddressDialogComponent`)

- A new standalone Angular component `JumpToAddressDialogComponent` MUST be created at:
  `projects/ui-assembly/src/lib/jump-to-address-dialog/jump-to-address-dialog.component.ts`
- The dialog MUST use `MatDialogModule` with the following structure:
  - **Title** (`mat-dialog-title`): `Jump to Address`
  - **Content** (`mat-dialog-content`): A single `mat-form-field` containing a text input.
    - Input placeholder: `e.g. 0x401234`
    - Input `font-family: var(--font-mono)`
    - Inline `mat-error` shown when input is invalid.
  - **Actions** (`mat-dialog-actions`, `align="end"`):
    - `Cancel` button (`mat-button`) — closes dialog with no result.
    - `Jump` button (`mat-flat-button`, `color="primary"`) — validates input and closes dialog with the normalized address as the result.
- **Validation rules** (applied on `Jump` click):
  - Input MUST NOT be empty.
  - Input MUST match `/^(0x)?[0-9a-fA-F]+$/`.
  - If invalid, `mat-error` is shown and the dialog remains open.
- **On confirmed close** (dialog result is a non-empty string):
  1. The address is normalized: prepend `0x` if absent, convert to lowercase.
  2. `DapAssemblyService.relocateWindow(normalizedAddress, 0)` is called.
- **Enter key** inside the input MUST trigger the same action as clicking the `Jump` button.
- The dialog MUST NOT inject `DapAssemblyService` directly. It MUST return the address as the `MatDialogRef` close value. The parent `AssemblyViewComponent` handles the service call after `afterClosed()` resolves.

### B4 — Retained Navigation Affordances

- The "Return to PC" `mat-mini-fab` floating action button (from WI-112) MUST remain present and functional.
- The infinite-scroll auto-fetch on viewport edge MUST remain present and functional.

## UI Layout

```text
┌──────────────────────────────────────────────────────┐
│ cdk-virtual-scroll-viewport (no scrollbar)           │
│    Function <symbol>:                                │  <- Inline function label
│  > 0x401234  <+0>  48 89 e5  push %rbp               │
│    0x401238  <+4>  48 81 ec  sub $0x20, %rsp         │
│    ...                                               │
│                                        [* Jump FAB]  │  <- New Jump-to-Address FAB (above Return-to-PC)
│                                         [o PC FAB]   │  <- Existing Return-to-PC FAB
└──────────────────────────────────────────────────────┘

         ┌──────────────────────────────────┐
         │  Jump to Address                 │  <- MatDialog
         │  ┌────────────────────────────┐  │
         │  │ e.g. 0x401234              │  │  <- mat-form-field (mono font)
         │  │ [!] Invalid hex address    │  │  <- mat-error (conditional)
         │  └────────────────────────────┘  │
         │                  [Cancel] [Jump] │
         └──────────────────────────────────┘
```

> [Diagram: Assembly View — Two FABs appear at bottom-right: the new Jump-to-Address button (top, `[*]`) and the existing Return-to-PC button (bottom, `[o]`). Clicking Jump opens a MatDialog with a single hex input field, Cancel and Jump action buttons.]

### Layout Constraints

| Element | Specification |
| :--- | :--- |
| Jump FAB icon | `pin_drop` (Material icon) |
| Jump FAB position | First child of `.floating-actions` flex column — rendered above the Return-to-PC FAB |
| FAB gap | `12px` — matches the existing `.floating-actions gap` |
| Dialog input font | `font-family: var(--font-mono)` |
| Dialog input font-size | `var(--text-base)` |
| Dialog min-width | `320px` |
| Dialog title | "Jump to Address" |

### SCSS Rules

- All new SCSS MUST be authored in `assembly-view.component.scss` (for FAB) and `jump-to-address-dialog.component.scss` (for dialog internals) using design tokens.
- No hardcoded hex or rgba color values are permitted.
- The scrollbar hide rule MUST target only `.assembly-viewport`:

  ```scss
  .assembly-viewport {
    &::-webkit-scrollbar { display: none; }
    scrollbar-width: none; // Firefox compatibility
    -ms-overflow-style: none; // IE/Edge compatibility
  }
  ```

## Acceptance Criteria

| # | Criterion | Verifiable By |
| :--- | :--- | :--- |
| AC-1 | No vertical scrollbar is visible in the Assembly View when instructions are loaded. | Visual inspection / screenshot diff |
| AC-2 | Mousewheel and trackpad scrolling still scrolls the instruction list. | Manual test |
| AC-3 | A new `pin_drop` `mat-mini-fab` button is visible in the `.floating-actions` area when `currentPc()` is truthy, positioned above the Return-to-PC FAB. | Visual inspection |
| AC-4 | Clicking the Jump FAB opens the `JumpToAddressDialogComponent` via `MatDialog`. | Unit test (spy on `MatDialog.open`) |
| AC-5 | Entering a valid hex address (e.g., `0x401234` or `401234`) and confirming closes the dialog and causes `AssemblyViewComponent` to call `DapAssemblyService.relocateWindow()` with the normalized `0x`-prefixed lowercase address. | Unit test (mock dialog result + mock service) |
| AC-6 | Entering an invalid value (e.g., `xyz`, empty) in the dialog and clicking Jump shows `mat-error` and does NOT close the dialog or call `relocateWindow()`. | Unit test |
| AC-7 | Pressing Enter inside the dialog input triggers the same validation and confirmation as clicking the `Jump` button. | Unit test |
| AC-8 | Clicking `Cancel` closes the dialog without calling `relocateWindow()`. | Unit test |
| AC-9 | The "Return to PC" FAB remains visible and functional and is not displaced by the new FAB. | Manual test |
| AC-10 | The Assembly View toolbar is visually unchanged. | Visual inspection |
| AC-11 | The infinite-scroll auto-fetch behavior is not regressed. | Existing test suite passing |
| AC-12 | All new SCSS uses design tokens only — no hardcoded colors. | QCR SCSS review |
