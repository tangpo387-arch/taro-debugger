---
title: Assembly View: Fix Opcode and Mnemonic Column Truncation
scope: Low-Level Inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
related:
  - work-items.md
  - architecture/error-handling.md
---

# Assembly View: Fix Opcode and Mnemonic Column Truncation (WI-116)

> [!NOTE]
> **Source Work Item**: WI-116
> **Group**: Low-Level Inspection
> **Description**: Resolve the silent truncation of instruction bytes (opcode column) and instruction text (mnemonic column) in the Assembly View by replacing fixed-width clipping with flexible, tooltip-assisted rendering.

## Purpose

The Assembly View currently hard-clips both the opcode (`.opcode`) and mnemonic (`.mnemonic`) columns using fixed `flex-basis` widths with `overflow: hidden`. This causes **silent data loss** for the engineer inspecting low-level code:

- **Opcode column (110px)**: Multi-byte x86/x86-64 instructions such as `FF 25 00 00 00 00` (6 bytes, a `jmpq` through a GOT entry) or `48 81 EC A0 00 00 00` (7-byte `subq`) exceed 110px in any standard monospace font at the assembly view's default density, causing the trailing bytes to be clipped with no visual indication.
- **Mnemonic column (250px)**: Complex addressing operands such as `movq   -0x28(%rbp), %rax` or SIMD instructions with multiple register operands frequently exceed 250px, again resulting in silent clipping.

Neither column applies `text-overflow: ellipsis` or exposes any tooltip on hover, meaning the engineer has **no indication that content has been truncated**. This violates the fundamental debugger principle of information completeness for a disassembly view.

## Scope

**In Scope:**

- `projects/ui-assembly/src/lib/assembly-view.component.scss`: Column width rules for `.opcode` and `.mnemonic`.
- `projects/ui-assembly/src/lib/assembly-view.component.html`: Row template for the `opcode` and `mnemonic` `<div>` cells.
- Visual behavior of the Assembly View row layout under varying viewport widths.

**Out of Scope:**

- Changes to `DapDisassembledInstruction` or the cache service — this is a pure UI rendering fix.
- Changes to the address (`.address`) or offset (`.offset`) columns — these have acceptable fixed widths given their content is numerically bounded.
- Changes to the annotation (`.annotation`) column — this already uses `text-overflow: ellipsis` correctly.
- Introduction of horizontal scrolling to the `.assembly-row`.
- Changing the overall Assembly View layout or navigation logic.

## Behavior

### 3.1 Root Cause Analysis

The current column definitions in `assembly-view.component.scss` are:

```scss
.opcode {
  flex: 0 0 110px;      // Fixed; no grow, no shrink
  overflow: hidden;     // Hard-clips content, no text-overflow
}

.mnemonic {
  flex: 0 0 250px;      // Fixed; no grow, no shrink
  overflow: hidden;     // Hard-clips content, no text-overflow
}
```

The row container uses `white-space: nowrap`, so text never wraps. The combination of a fixed `flex-basis` and `overflow: hidden` without `text-overflow: ellipsis` silently discards trailing characters.

### 3.2 Column Width Audit

Real-world byte sequences that trigger truncation at the current 110px width (using a 13px monospace font, which is typical for assembly density):

| Instruction | Opcode bytes | Rendered width (est.) |
| :--- | :--- | :--- |
| `jmpq *(%rip)` | `FF 25 00 00 00 00` | ~130px |
| `subq $0xa0, %rsp` | `48 81 EC A0 00 00 00` | ~150px |
| `movabs $0x..., %rax` | `48 B8 XX XX XX XX XX XX XX XX` | ~200px |

The opcode column must accommodate at minimum **10 space-separated hex bytes** without clipping — a minimum display width of **~180px** at the standard density.

Real-world mnemonics that trigger truncation at 250px:

| Example Mnemonic | Approx. width |
| :--- | :--- |
| `movq   -0x28(%rbp), %rax` | ~220px |
| `callq  *0x4c(%rbx)` | ~175px |
| `vpcmpeqb %ymm1, %ymm0, %ymm2` | ~260px |
| `lea    0x1234(%rip), %rdi  # <symbol>` | ~300px+ |

The mnemonic column must accommodate the instruction text itself without truncation; any appended annotation belongs in the `.annotation` column.

### 3.3 Target Behavior

After this fix:

1. **Opcode column**: Uses `flex: 0 0 180px` (min-width upgraded from 110px to 180px). `text-overflow: ellipsis` is applied so that any pathological case (> 10 bytes) renders with an ellipsis instead of silent clipping. A native `title` attribute on the `<div>` exposes the full raw value on hover.

2. **Mnemonic column**: Uses `flex: 1 1 250px` (changed from `0 0` to `1 1`) so the column expands to consume available row space. `text-overflow: ellipsis` is applied as a safety net when the viewport is very narrow. A native `title` attribute on the `<div>` exposes the full instruction text on hover.

3. **Row overflow strategy**: The row container continues to use `white-space: nowrap` and `overflow: hidden`. No horizontal scroll is introduced; the annotation column shrinks to accommodate the expanded mnemonic column.

4. **Visual regression prevention**: The total minimum row width remains approximately unchanged (sum of all fixed column widths stays within 750px), ensuring the layout does not break at standard debugger viewport widths (≥ 900px).

### 3.4 Template Changes

Both the `opcode` and `mnemonic` `<div>` elements in the HTML template must bind a `title` attribute for native browser tooltip support:

```html
<!-- Before -->
<div class="opcode">{{ instruction.instructionBytes || '' }}</div>
<div class="mnemonic">{{ instruction.instruction }}</div>

<!-- After -->
<div class="opcode" [title]="instruction.instructionBytes || ''">
  {{ instruction.instructionBytes || '' }}
</div>
<div class="mnemonic" [title]="instruction.instruction">
  {{ instruction.instruction }}
</div>
```

### 3.5 SCSS Changes

```scss
// Before
.opcode {
  flex: 0 0 110px;
  color: var(--mat-sys-secondary);
  font-size: var(--text-sm);
  overflow: hidden;
}

.mnemonic {
  flex: 0 0 250px;
  font-weight: var(--weight-medium);
  overflow: hidden;
}

// After
.opcode {
  flex: 0 0 180px;                   // Accommodates 10-byte sequences
  min-width: 180px;
  color: var(--mat-sys-secondary);
  font-size: var(--text-sm);
  overflow: hidden;
  text-overflow: ellipsis;           // Ellipsis instead of silent clip
  white-space: nowrap;
}

.mnemonic {
  flex: 1 1 250px;                   // Grows to fill available row space
  min-width: 200px;
  font-weight: var(--weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;           // Safety net for narrow viewports
  white-space: nowrap;
}
```

## Acceptance Criteria

| # | Criterion | Verification Method |
| :--- | :--- | :--- |
| AC-1 | A 6-byte opcode string (`FF 25 00 00 00 00`) is fully visible without truncation in a 1280px-wide Assembly View viewport. | Visual inspection / DOM measurement |
| AC-2 | A 10-byte opcode string renders with an ellipsis (not hard-clipped) if the viewport is narrower than 900px. | Visual inspection at 900px viewport |
| AC-3 | A mnemonic string of 30+ characters (e.g., `vpcmpeqb %ymm1, %ymm0, %ymm2`) is fully visible in the default viewport, with the mnemonic column expanding to accommodate it. | Visual inspection |
| AC-4 | Hovering over the opcode cell displays the full raw `instructionBytes` value in a native browser tooltip. | Manual hover test |
| AC-5 | Hovering over the mnemonic cell displays the full `instruction` value in a native browser tooltip. | Manual hover test |
| AC-6 | The `.annotation` column (symbol) continues to receive any available remaining space and truncates with an ellipsis. | Visual inspection |
| AC-7 | No horizontal scrollbar appears on any `.assembly-row` at 1280px viewport. | Visual inspection |
| AC-8 | The existing unit tests for `AssemblyViewComponent` pass without modification. | `npm run test:file -- ui-assembly --include=**/assembly-view.component.spec.ts --watch=false` |
