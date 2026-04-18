---
title: Specification - Assembly View (Disassembly)
scope: architecture, ui-layer, dap-integration, disassembly
audience: [Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-12
related:
  - ../ui-layer.md
  - ../../system-specification.md
---

# Specification: Assembly View (Disassembly)

## 1. Objective

Provide a low-level view of machine instructions (Assembly) to support debugging when source code is unavailable or when precise instruction-level inspection is required.

## 2. Component Architecture

### 2.1 AssemblyViewComponent (`app-assembly-view`)

- **Type**: Standalone Component.
- **Location**: `/projects/taro-debugger-frontend/src/app/assembly-view.component.ts`.
- **Primary Responsibility**: Render the disassembled instruction list and synchronized Instruction Pointer (IP) highlight.

### 2.2 DapAssemblyService

- **Type**: Component-scoped Service (provided in `AssemblyViewComponent`).
- **Responsibility**:
  - Manage the lifecycle of instruction data.
  - Execute DAP `disassemble` requests.
  - Synchronize with the global `executionState$` to update the current address highlight.

## 3. UI/UX Design

### 3.1 Visual Layout (Material Design 3 High Density)

The view consists of a scrollable list (using `cdk-virtual-scroll-viewport` for large ranges) with the following structure:

| Element | Description | Styling |
| :--- | :--- | :--- |
| **Gutter** | Leftmost column for breakpoint indicators (`mat-icon` / circle). | Same as Editor gutter. |
| **Address** | 16-character hex memory address (e.g., `0x0000555555555149`). | Monospaced, muted color. |
| **Opcode** | Raw machine bytes (e.g., `48 89 e5`). | Monospaced, hidden by default. |
| **Instruction** | The human-readable assembly operation (e.g., `mov %rsp,%rbp`). | Monospaced, syntax colored. |
| **Annotation** | Associated symbol or source line inline comments. | Italic, very muted. |

### 3.2 Main Content Integration

The `DebuggerComponent` main content area will evolve from a single editor to a **tabbed interface**:

- **Tab 1: Source** (Monaco Editor)
- **Tab 2: Disassembly** (Assembly View)

### 3.3 Dynamic Switching Logic

- **Manual**: User clicks the "Disassembly" tab.
- **Automatic**: If a user selects a stack frame in `CallStackComponent` that has no `source` property but has an `instructionPointerReference`, the UI automatically switches focus to the Disassembly tab and requests instructions for that address.

## 4. DAP Protocol Integration

### 4.1 Disassemble Request

When a frame or address is targeted:

```typescript
dapSession.request('disassemble', {
  memoryReference: frame.instructionPointerReference,
  offset: -50,
  instructionCount: 100,
  resolveSymbols: true
});
```

### 4.2 Instruction Mapping

Instructions returned from `disassemble` may contain `location: Source` and `line` information. The UI should use this to:

- Show line numbers in the Annotation column.
- Allow clicking a "Jump to Source" button if available.

### 4.3 Breakpoint Synchronization

Setting a breakpoint in the Assembly gutter should send a `setBreakpoints` request (if supported by DA for memory addresses) or use the instruction's `location` if it maps back to a source file.

## 5. State Management

- **SSOT**: `DapAssemblyService` holds the current buffer of instructions.
- **Cache Policy**: Instructions are cached per address range. Changing threads or frames clears the local buffer.
- **Reactive Stream**: `instructions$: Observable<DisassembledInstruction[]>` used with `async` pipe in template.

## 6. Technical Constraints

- **Recursive Virtual Scroll**: Ensure the IP highlight remains visible even when instructions are lazy-loaded.
- **Protocol Fail-soft**: If the DA does not support the `disassemble` capability (`capabilities.supportsDisassembleRequest === false`), the Disassembly tab should be hidden or disabled with a clear tooltip.

## 7. Function-Level Assembly Rendering (GDB Style)

To emulate terminal-based CLI debuggers (like GDB/LLDB) which group disassembled instructions by function blocks and provide relative offsets, the application applies post-processing to the DAP payload.

### 7.1 Data Layer: Offset & Boundary Normalization

Adapter responses often lack reliable relative offsets in standard properties. `DapAssemblyService` handles this by:
- **Interface Extension**: Emitting a custom `TaroDisassembledInstruction` type that extends `DapDisassembledInstruction` with `normalizedSymbol`, `byteOffset`, and `isFunctionStart`.
- **Base Address Tracking**: Scanning the incoming `instructions[]` array, detecting the first appearance of a new `symbol`, and storing its absolute `address` (parsed from hex) as the Base Address.
- **Offset Calculation**: For subsequent instructions within the same symbol block, computing `Address - BaseAddress` to reconstruct the `byteOffset` (e.g., `+16`).

### 7.2 Structuring the UI (Sticky Function Header)

To maintain CDK Virtual Scroll performance without breaking uniform `itemSize` assumptions, grouping is decoupled from the scroll list flow:
- **Offset Column**: A new dedicated `div.offset` element is added between the Address and Machine Code, rendering `<+X>` styled in `var(--mat-sys-tertiary)`.
- **Viewport State Listener**: The component tracks `viewport.scrolledIndexChange` to identify the instruction currently pinned at the top of the view.
- **Sticky Header Rendering**: A floating header (`div.function-header`) sits completely outside the `cdk-virtual-scroll-viewport` but within its flex container. It dynamically displays the `normalizedSymbol` of the top-most visible instruction (e.g., `[ Assembly for function: print ]`). This achieves visually seamless visual grouping without introducing recursive DOM restructuring.
