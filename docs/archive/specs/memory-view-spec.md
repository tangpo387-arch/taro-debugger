---
title: Specification - Memory View (Hex Dump)
scope: architecture, ui-layer, dap-integration, memory-inspection
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-26
related:
  - ../ui-layer.md
  - ../../system-specification.md
  - assembly-view-spec.md
---

# Specification: Memory View (Hex Dump)

## 1. Objective

Provide a low-level memory inspection interface (Hex Dump) to allow users to view and optionally modify raw memory contents during a debug session. This feature is implemented across three coordinated work items to ensure separation of concerns between protocol handling, UI rendering, and host integration.

## 2. Work Item Mapping & Monorepo Boundaries

| WI ID | Responsibility | Library / Project |
| :--- | :--- | :--- |
| **WI-104** | Protocol Layer & Data Services | `projects/dap-core` |
| **WI-105** | Standalone UI Component | `projects/ui-inspection` |
| **WI-106** | UI Integration & UX Orchestration | `projects/taro-debugger-frontend` |

## 3. Component Architecture

### 3.1 MemoryViewComponent (`app-memory-view`)

- **Type**: Standalone Component.
- **Project**: `@taro/ui-inspection`.
- **Primary Responsibility**: Render a high-performance hex dump grid with ASCII preview and virtual scrolling.
- **Inputs**:
  - `data: Uint8Array`: The memory buffer to display.
  - `baseAddress: string`: The starting address for rendering.
  - `highlightedRange?: { start: number, length: number }`: For object layout shading.

### 3.2 DapMemoryService

- **Type**: Framework-agnostic Service.
- **Project**: `@taro/dap-core`.
- **Responsibility**:
  - Encapsulate DAP `readMemory` and `writeMemory` request logic.
  - Handle Base64 encoding/decoding for memory data payloads.
  - Provide reactive streams for memory buffer updates.

## 4. UI/UX Design

### 4.1 Main Content Integration

The `DebuggerComponent` in the host application features a tabbed interface. Memory View is integrated as a primary tab:

1. **Source** (Monaco Editor)
2. **Disassembly** (Assembly View)
3. **Memory** (Memory View - WI-106)

### 4.2 Visual Layout (Hex Dump)

The view uses a high-density table structure powered by `cdk-virtual-scroll-viewport`:

| Column | Content | Format / Style |
| :--- | :--- | :--- |
| **Address** | 64-bit Hex Address | `0x00007FFFFFFFDC00` (Monospace, Muted) |
| **Hex Data** | 16 bytes per row | `48 89 E5 ...` (Monospace, Interactive) |
| **ASCII** | Character representation | `H . . .` (Monospace, Muted) |

### 4.3 Entry Points & Interaction (WI-106)

- **Contextual**: Right-click a pointer variable in the **Variables** panel -> Select **"Open Memory View"**.
- **Manual**: Direct address input in the Memory View toolbar.
- **Modification**: Inline byte editing (sends `writeMemory` via `DapMemoryService`).

## 5. DAP Protocol Integration (WI-104)

### 5.1 Capabilities Check

The UI must verify `capabilities.supportsReadMemoryRequest` before enabling the Memory tab. If `supportsWriteMemoryRequest` is false, editing is disabled.

### 5.2 Read Memory Flow

```typescript
// WI-104: DapMemoryService.read()
dapSession.request('readMemory', {
  memoryReference: '0x12345678', 
  offset: 0,
  count: 1024 
});
```

### 5.3 Write Memory Flow

```typescript
// WI-104: DapMemoryService.write()
dapSession.request('writeMemory', {
  memoryReference: '0x12345678',
  offset: 0,
  data: 'SGVsbG8=' // Base64 encoded
});
```

## 6. Technical Constraints

- **Monorepo Strictness**: `MemoryViewComponent` (in `ui-inspection`) MUST NOT depend on `DapSessionService`. It should receive data via Inputs or a specialized interface to remain testable in isolation.
- **Performance**: Virtual scrolling is mandatory for handling large memory blocks without DOM bloat.

## 7. Object Layout Visualization (Advanced UX)

To support complex C++ debugging, the Memory View provides an optional "Layout Overlay" mode that maps high-level object structures (structs/classes) onto the raw hex dump.

### 7.1 Triggering Layout Mode

Users can initiate the Object Layout Visualization through two primary methods:

1. **Contextual (Variables Panel)**:
   - In the **Left Sidenav -> Debug Tab**, open the **Variables** expansion panel.
   - Right-click a `struct`, `class`, or a pointer to an object.
   - Select the new context menu option: **"Inspect Memory Layout"**.
   - This automatically switches the center panel to the Memory tab, navigates to the object's base address, and enables the Layout Overlay.
2. **Manual Cast (Memory Tab)**:
   - While in the Memory tab viewing raw hex data, the user can use a **"Cast Layout"** input field (located in the Layout Inspector panel or toolbar).
   - The user types a valid C/C++ expression or type cast (e.g., `(MyStruct*)0x12345678` or simply a variable name `player`).
   - The system evaluates the type and address to generate the overlay.

### 7.2 Visual Overlay Design

When an object layout is being inspected, the Hex Dump is enhanced with the following visual cues:

- **Member Shading**: Bytes belonging to a specific member are highlighted with a semi-transparent background color.
- **Floating Labels**: Member names (e.g., `_age`, `*ptr`) are rendered as small labels above their starting byte.
- **Padding Indicators**: Alignment gaps are rendered with a diagonal "hatch" pattern and labeled as `[padding]`.
- **Nesting Brackets**: Vertical brackets in the address gutter indicate the span of nested parent objects.

### 7.3 Data Acquisition Strategy

Since standard DAP `variables` responses may lack explicit memory offsets, the system employs a "Probing" strategy:

1. **Base Address**: Obtain the memory address of the parent object.
2. **Member Offsets**: Execute `evaluate` requests for child absolute addresses (e.g., `&obj.member`).
3. **Layout Mapping**: Calculate `Offset = MemberAddress - BaseAddress`.
4. **Padding Detection**: Identify gaps between `(Offset[i] + Size[i])` and `Offset[i+1]`.

## 8. Acceptance Criteria

- [ ] **WI-104**: `DapMemoryService` successfully converts DAP Base64 responses to `Uint8Array`.
- [ ] **WI-105**: `MemoryViewComponent` renders 1KB of memory with zero layout shift during virtual scrolling.
- [ ] **WI-106**: Right-clicking a pointer in the Variables tree correctly switches the tab and populates the Memory View.
- [ ] **Layout Mode**: Members of a struct are visually delineated with distinct colors and labels per Section 7.2.
- [ ] **Padding Detection**: Alignment gaps are correctly identified and labeled as `[padding]`.
