---
title: Work Items
scope: tasks, progress, dependencies, milestones, feature-groups
audience: [Product_Architect, Lead_Engineer]
last_updated: 2026-04-04
related:
  - docs/system-specification.md
  - docs/project-management.md
  - docs/project-roadmap.md
  - docs/design-decisions.md
  - docs/test-plan.md
---

# DAP Debugger Frontend — Work Items

## Backend Relay

### WI-09: Implement Node.js WebSocket Bridge
<!-- status: pending | size: M | depends: none -->
- **Size**: M
- **Description**: Implement a simple Node.js server that receives frontend WebSocket connections and forwards them to the local DAP executable (e.g., `lldb-dap`)
- **Details**:
  - Use the `ws` module to create a WebSocket Server (e.g., running on `:8080`)
  - On connection, launch `lldb-dap` or `gdb` as a child process based on the protocol
  - Bidirectional data forwarding: WebSocket → DAP `stdin`; DAP `stdout` → WebSocket back to frontend
  - Handle process termination and resource cleanup
- **Dependencies**: none
- **Status**: ⏳ Pending

## Low-Level Inspection

### WI-27: Integration of Tabbed Layout and Navigation
<!-- status: pending | size: S | depends: WI-07, WI-11 -->
- **Size**: S
- **Description**: Evolve the main content area into a tabbed interface and implement logic for dynamic switching between Source and Disassembly.
- **Details**:
  - Replace static Monaco Editor with a `mat-tab-group` containing Source and Disassembly tabs.
  - Implement active tab management in `DebuggerComponent`.
  - Add logic to automatically switch to Disassembly tab if a selected stack frame has no source but has an instruction pointer.
- **Dependencies**: WI-07, WI-11
- **Status**: ⏳ Pending

### WI-28: DapAssemblyService and Disassemble Request
<!-- status: pending | size: M | depends: WI-06 -->
- **Size**: M
- **Description**: Implement a dedicated service for assembly data retrieval and interaction with the DAP `disassemble` endpoint.
- **Details**:
  - Create `DapAssemblyService` with a component-scoped lifecycle.
  - Implement the `disassemble` request with configurable instruction count and offsets.
  - Handle symbol resolution and address mapping within the service.
  - Expose a reactive `instructions$` stream for the UI.
- **Dependencies**: WI-06
- **Status**: ⏳ Pending

### WI-29: AssemblyViewComponent and Instruction Rendering
<!-- status: pending | size: M | depends: WI-27, WI-28 -->
- **Size**: M
- **Description**: Build the high-density instruction list component with virtual scrolling and instruction pointer highlighting.
- **Details**:
  - Implement `AssemblyViewComponent` using `cdk-virtual-scroll-viewport`.
  - Design the high-density table layout (Address, Opcode, Mnemonic, Annotation).
  - Implement logic to synchronize the highlighted instruction with the current `instructionPointerReference`.
  - Integrate breakpoint markers in the assembly gutter.
- **Dependencies**: WI-27, WI-28
- **Status**: ⏳ Pending
