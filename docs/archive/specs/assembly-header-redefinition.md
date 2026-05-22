---
title: Redefine Assembly View Header & Symbol Extraction
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Redefine Assembly View Header & Symbol Extraction (WI-129)

> [!NOTE]
> **Source Work Item**: Redefine Assembly View Header & Symbol Extraction
> **Description**: Remove sticky header, implement inline function labels, range-level symbol propagation, and GDB info symbol fallback.

## Purpose

Redefine the function header in the disassembly view (which currently displays incorrect/dimmed function names like `print` instead of `main` due to viewport auto-scroll offsets and sparse DAP symbol data) and implement a reliable method to extract instruction symbols and offsets when scrolling through arbitrary memory.

## Scope

- **UI Component**:
  - `projects/ui-assembly/src/lib/assembly-view.component.html`: Remove sticky header container, add inline function label container.
  - `projects/ui-assembly/src/lib/assembly-view.component.scss`: Style inline function labels and adjust scroll height parameters.
  - `projects/ui-assembly/src/lib/assembly-view.component.ts`: Expose necessary template fields.
- **Session / Core Services**:
  - `projects/dap-core/src/lib/session/dap-assembly-cache.service.ts`: Update instruction enhancement to implement range-level symbol propagation and issue GDB CLI `info symbol <address>` fallback queries.
  - `projects/dap-core/src/lib/session/dap-assembly-cache.service.spec.ts`: Add test cases verifying correct range propagation and fallback handling.

## Behavior

### 1. Remove Sticky Header
The current sticky function header at the top of the disassembly view will be removed to avoid showing stale or incorrect function names when scrolling.

### 2. Inline Function Labels
Render demangled function name labels inline directly within the instruction stream. A label container will be rendered immediately before any instruction that has `isFunctionStart: true` or matches the beginning of a resolved function block:
```html
<div *ngIf="instruction.isFunctionStart" class="assembly-function-label">
  {{ instruction.symbol }}:
</div>
```

### 3. Range-Level Symbol Propagation
Update the instruction enhancement step in `DapAssemblyCacheService`. When a new batch of disassembled instructions is merged:
- Perform propagation across the entire merged cached range.
- Start from the first instruction in the range. If it has a `symbol`, propagate it forward to subsequent instructions (updating their `symbol` and computing the cumulative bytecode offset based on instruction size) until a new instruction with its own `symbol` (or `isFunctionStart` true) is encountered.
- This ensures that backwards scrolling or isolated chunks loaded via scroll jumps receive proper symbols.

### 4. GDB `info symbol` Query Fallback
If a newly fetched assembly range starts with an instruction that does NOT have a symbol:
- Issue a DAP `evaluate` request with expression `info symbol <address>` (no `-exec` prefix).
- Parse the resulting string output. GDB CLI output formatting for `info symbol` is typically:
  `SymbolName + Offset in section .text of Program` (or just `SymbolName in section .text`).
  Use the regular expression `^([^\s+]+)(?:\s*\+\s*([^\s]+))?` to extract the `symbol` and `offset`.
- Set the extracted symbol and offset on the first instruction of the fetched range.
- Run range-level symbol propagation to flow this symbol forward through the rest of the fetched instructions.
- Ensure safety by validating that `<address>` matches `^0x[0-9a-fA-F]+$` before invoking GDB evaluate requests to prevent malformed commands.

### 5. Out-of-Range Styling Simplification
Refactor `isOutOfRange()` in `assembly-view.component.ts` to only return true for typical zero padding and unmapped memory blocks. Valid instructions from adjacent functions will not be dimmed or italicized, ensuring high readability across the entire address space.

### 6. Unified Scroll Alignment During Sliding-Window Fetches
When the sliding-window auto-fetch replaces the instruction list (forward or backward page transition), the viewport offset must be preserved relative to the address that triggered the fetch:
- Before updating `instructions`, measure the pixel distance from the viewport top to the target address using `scrollStrategy.getOffsetForIndex()`.
- After `setConfig()` and CDK layout detection, locate the same address in the new list, compute its new offset, and restore the original distance by scrolling to `newTargetOffset - distance`.
- Set `isAligningScroll = true` and `expectedScrollOffset` during the transition. `onViewportScroll` suppresses auto-fetch triggers while the flag is set.
- Clear the guard immediately when `measureScrollOffset()` matches `expectedScrollOffset` (within ±2 px), or via a 150 ms safety timeout, whichever comes first.
- This unified approach applies to both forward and backward transitions, eliminating viewport jumps that caused infinite scroll-fetch loops.

## Acceptance Criteria

1. **Visual presentation**:
   - No sticky header container exists at the top of the disassembly viewport.
   - Function label lines (e.g., `main:`) are rendered inline within the assembly view list.
   - Active instructions are fully bright and styled as normal code even if they belong to a different function from the current PC frame.
   - Zero-padding and unmapped memory instructions (such as `00 00 00 00` or `add %al, (%rax)`) remain dimmed to mark the boundaries of executable memory.
2. **Symbol resolution**:
   - Instructions following a function entry point display correct relative offsets in the address/offset column (e.g., `<+4>`, `<+8>`).
   - Jumping to arbitrary addresses or scrolling backwards retrieves symbols via GDB `info symbol` evaluation and propagates them forward correctly.
3. **Scroll stability**:
   - Sliding-window forward and backward fetches preserve the viewport offset relative to the anchor address; content does not jump during page transitions.
   - The scroll alignment guard (`isAligningScroll`) suppresses redundant auto-fetch triggers while a programmatic offset correction is in flight.
4. **Safety**:
   - Target addresses are strictly checked (hexadecimal regex `^0x[0-9a-fA-F]+$`) before formatting GDB evaluate command strings.
5. **Test suite**:
   - `dap-assembly-cache.service.spec.ts` includes unit tests for range propagation and `info symbol` fallback command execution.
   - `assembly-view.component.spec.ts` includes unit tests for scroll offset adjustment in both forward and backward directions.
   - All tests pass: `npm run test -- --watch=false`.


