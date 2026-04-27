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

Provide a low-level memory inspection interface (Hex Dump) to allow users to view and optionally modify raw memory contents during a debug session. This is critical for C/C++ development where pointer manipulation and memory layouts are central.

## 2. Component Architecture

### 2.1 MemoryViewComponent (`app-memory-view`)

- **Type**: Standalone Component.
- **Location**: `/projects/taro-debugger-frontend/src/app/memory-view.component.ts`.
- **Primary Responsibility**: Render a virtualized hex dump table and handle user navigation/editing.

### 2.2 DapMemoryService

- **Type**: Component-scoped Service (provided in `DebuggerComponent`).
- **Responsibility**:
  - Manage memory inspection state (base address, range, data buffer).
  - Execute DAP `readMemory` and `writeMemory` requests.
  - Coordinate with the Variables view to resolve pointer addresses.

## 3. UI/UX Design

### 3.1 Main Content Integration

The `DebuggerComponent` main content area (center panel) features a tabbed interface. Memory View is added as the third tab:

1. **Source** (Monaco Editor)
2. **Disassembly** (Assembly View)
3. **Memory** (Memory View)

### 3.2 Visual Layout (Hex Dump)

The view uses a high-density table structure powered by `cdk-virtual-scroll-viewport`:

| Column | Content | Format / Style |
| :--- | :--- | :--- |
| **Address** | 64-bit Hex Address | `0x00007FFFFFFFDC00` (Monospace, Muted) |
| **Hex Data** | 16 bytes per row | `48 89 E5 ...` (Monospace, Interactive) |
| **ASCII** | Character representation | `H . . .` (Monospace, Muted) |

### 3.3 Entry Points & Interaction

- **Contextual**: Navigate to the **Left Sidenav -> Debug Tab**, right-click a pointer variable in the **Variables** expansion panel -> Select **"Open Memory View"**. This naturally guides the user's eye from the left navigation panel to the center Memory tab.
- **Manual**: Click the **Memory** tab and enter a hex address in the address bar.
- **Modification**: Clicking a hex byte enters "Edit Mode" (if supported). Pressing `Enter` triggers a `writeMemory` request.

## 4. DAP Protocol Integration

### 4.1 Capabilities Check

The UI must verify `capabilities.supportsReadMemoryRequest` before enabling the Memory tab. If `supportsWriteMemoryRequest` is false, data cells remain read-only.

### 4.2 Read Memory Flow

When an address is targeted:

```typescript
dapSession.request('readMemory', {
  memoryReference: '0x12345678', // Hex string
  offset: 0,
  count: 1024 // Bytes to read
});
```

### 4.3 Write Memory Flow

```typescript
dapSession.request('writeMemory', {
  memoryReference: '0x12345678',
  offset: 0,
  data: 'SGVsbG8=' // Base64 encoded data
});
```

## 5. Technical Constraints

- **Base64 Handling**: DAP `writeMemory` requires data to be Base64 encoded. The `DapMemoryService` must handle conversion from Hex/ASCII strings.
- **Unreadable Memory**: Handle `unreadableBytes` in the `readMemory` response by rendering `??` or `..` in the UI.
- **Viewport Performance**: Ensure smooth scrolling across large memory ranges using virtual scrolling.

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

- **Member Shading**: bytes belonging to a specific member are highlighted with a semi-transparent background color (semantic palette).
- **Floating Labels**: member names (e.g., `_age`, `*ptr`) are rendered as small, non-obtrusive labels above their starting byte.
- **Padding Indicators**: gaps between members (alignment padding) are rendered with a diagonal "hatch" pattern and labeled as `[padding]`.
- **Nesting Brackets**: for nested structures, vertical "brackets" in the address gutter indicate the span of the parent object.

### 7.2 Interactive Layout Inspector

A collapsible side-panel within the Memory tab provides a hierarchical view of the object:

- **Member Tree**: a list of members with `Offset`, `Type`, and `Size`.
- **Bidirectional Highlighting**: hovering over a member in the tree highlights its bytes in the hex grid; clicking a hex byte selects the corresponding member in the tree.

### 7.3 Data Acquisition Strategy

Since standard DAP `variables` responses may lack explicit memory offsets, the system employs a "Probing" strategy:

1. **Base Address**: obtain the memory address of the parent object (via `evaluate` or `variables` metadata).
2. **Member Offsets**: for each child variable, execute an `evaluate` request to get its absolute address (e.g., `&obj.member`).
3. **Layout Mapping**: calculate `Offset = MemberAddress - BaseAddress`.
4. **Padding Detection**: identify gaps between `(Offset[i] + Size[i])` and `Offset[i+1]`.

## 8. Acceptance Criteria

- [ ] Memory tab is visible in the center panel when connected to a supporting DA.
- [ ] Right-clicking a pointer in Variables correctly resolves the address and opens the Memory tab.
- [ ] Hex dump accurately represents memory bytes with ASCII preview.
- [ ] Manual address input successfully triggers a refresh of the memory buffer.
- [ ] (Optional) Inline editing of bytes sends a valid `writeMemory` request.
- [ ] (Layout Mode) Members of a struct are visually delineated with distinct colors and labels.
- [ ] (Layout Mode) Memory padding is clearly identified and visually distinguished from data.
