---
title: Architecture - Assembly View (Disassembly)
scope: ui-assembly, disassembly, dap-integration
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
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

## 2. UI/UX Standards

### 2.1 Layout (Material Design 3 High Density)

| Element | Description | Styling |
| :--- | :--- | :--- |
| **Gutter** | Leftmost column for breakpoint indicators. | Standard `mat-icon` circle. |
| **Address** | 16-character hex memory address. | Monospaced, muted. |
| **Opcode** | Raw machine bytes. | Monospaced, hidden by default. |
| **Instruction** | Human-readable assembly operation. | Monospaced, syntax colored. |
| **Annotation** | Associated symbol or source line comments. | Italic, very muted. |

### 2.2 Context Switching

- **Manual Focus**: Hosted as a primary tab in the center tab group.
- **Auto-Switch**: The UI automatically switches to the Disassembly tab if a stack frame has no `source` property but contains an `instructionPointerReference`.

## 3. Protocol & Data Flow

### 3.1 Disassembly Request

The system dispatches `disassemble` requests with a standard window size (e.g., -50 to +50 instructions from the target address) to provide sufficient context for scrolling.

### 3.2 GDB-Style Function Grouping

The application applies post-processing to normalize the display of function blocks:
- **Base Address Tracking**: Detects symbol boundaries to calculate relative offsets (e.g., `<+16>`).
- **Sticky Headers**: A floating `div.function-header` displays the active symbol name for the top-most visible instruction, decoupled from the scroll list to maintain performance.

---

## 4. Technical Constraints

- **Capability Guard**: The view is disabled if the Debug Adapter does not support the `disassemble` capability.
- **Cache Policy**: Instructions are cached per address range. Changing threads or frames clears the local buffer to ensure fresh data.
