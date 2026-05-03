---
title: Architecture - Assembly View (Disassembly)
scope: ui-assembly, disassembly, dap-integration
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-05-02
related:
  - architecture/ui-layer.md
  - system-specification.md
---

# Assembly View (Disassembly)

The Assembly View provides a low-level inspection interface for machine instructions, enabling debugging when source code is unavailable or instruction-level precision is required.

## 1. Component Architecture

### 1.1 AssemblyViewComponent (`app-assembly-view`)

- **Library**: `@taro/ui-assembly`
- **Responsibility**: Render the disassembled instruction list and synchronized Instruction Pointer (IP) highlight.
- **Performance**: Utilizes `cdk-virtual-scroll-viewport` to handle large address ranges with minimal DOM overhead.

### 1.2 DapAssemblyService

- **Scope**: Component-scoped (provided in `DebuggerComponent` to persist state across tab switches).
- **Responsibility**:
  - Orchestrate DAP `disassemble` requests.
  - Synchronize with the global `executionState$` to update the current address highlight.
  - Manage the instruction buffer and caching logic.

### 1.3 Reactive Lifecycle Management

- **Cleanup**: Uses `DestroyRef` and `takeUntilDestroyed()` to automatically close RxJS streams (instructions, loading, scroll events) upon component destruction.
- **Timer Safety**: Explicitly manages and clears `setTimeout` IDs (e.g., `scrollTimeout`) to prevent asynchronous errors when navigating away from the view.

## 2. UI/UX Standards

### 2.1 Layout (Material Design 3 High Density)

| Element | Description | Styling |
| :--- | :--- | :--- |
| **Gutter** | Leftmost column for IP and breakpoint indicators. | widened to 32px, featuring pulsing IP arrow. |
| **Address** | 16-character hex memory address. | Monospaced, muted (`var(--mat-sys-outline)`). |
| **Offset** | Instruction offset from function start (e.g., `<+16>`). | `var(--mat-sys-tertiary)`, monospaced. |
| **Opcode** | Raw machine bytes. | `var(--mat-sys-secondary)`, monospaced. |
| **Instruction** | Human-readable assembly mnemonic. | `var(--weight-medium)`, monospaced. |
| **Annotation** | Associated symbol or source line comments. | Italic, very muted. |

### 2.2 Navigation Features

- **Return to PC Button**: A floating `mat-mini-fab` (icon: `my_location`) in the bottom right corner. Clicking it triggers a smooth-scroll to center the active Instruction Pointer.
- **Scroll Stabilization**: Implements an offset-adjustment algorithm when prepending instructions (backward scroll) to prevent the viewport from jumping.
- **Fast-Path Stepping**: Bypasses DAP disassemble requests if the target IP is already within the loaded UI stream, ensuring zero-latency stepping for function-local execution.

## 3. Protocol & Data Flow

### 3.1 Disassembly Request

The system dispatches `disassemble` requests with explicit context windows to ensure balanced context for immediate bidirectional scrolling.

### 3.2 GDB-Style Function Grouping

The application applies post-processing to normalize the display of function blocks:
- **Base Address Tracking**: Detects symbol boundaries to calculate relative offsets.
- **Sticky Headers**: A floating `div.function-header` displays the active symbol name for the top-most visible instruction.

---

## 4. Technical Constraints

- **Capability Guard**: The view is disabled if the Debug Adapter does not support the `disassemble` capability.
- **Cache Policy**: Instructions are cached per address range. The cache is **preserved across thread switches** (since threads share memory) but is **invalidated on `module` events** to account for dynamic library loading.
- **Capacity**: Maintained via a spatial pruning watermark (15,000 instructions) and a hard limit (20,000 instructions) to optimize memory usage and virtual scroll performance.
