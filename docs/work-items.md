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

---

## Electron Desktop Mode

### WI-25: Electron Local File System Access
<!-- status: pending | size: S | depends: WI-15, WI-23 -->
- **Size**: S
- **Description**: Implement local file reading per spec [§6.1](system-specification.md#61-electron-desktop-mode)
- **Details**:
  - Implement `FileTreeService`'s Electron version
  - Read file tree and file contents via IPC calling Node.js `fs` API
- **Dependencies**: WI-15, WI-23
- **Status**: ⏳ Pending
