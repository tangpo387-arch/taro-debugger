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

## Desktop UI Extensions

### WI-26: Setup Page Separation
<!-- status: completed | size: S | depends: none -->
- **Size**: S
- **Description**: Separate the Setup page into Web (`/setup-web`) and Electron (`/setup-electron`) versions via route guards.
- **Details**:
  - Implement `EnvironmentDetectService` and `ElectronRedirectGuard`.
  - Create `SetupWebComponent` (uses WebSocket) and `SetupElectronComponent` (uses IPC).
- **Dependencies**: none
- **Status**: ⏳ Pending

---

## Electron Desktop Mode

### WI-24: Electron IPC Transport Layer (`IpcTransportService`)
<!-- status: pending | size: M | depends: WI-04, WI-23, WI-26 -->
- **Size**: M
- **Description**: Implement IPC communication per spec [§4.1](system-specification.md#41-electron-desktop-mode)
- **Details**:
  - Implement `DapTransportService`'s IPC version (`IpcTransportService`)
  - `preload.ts` exposes `window.electronAPI` via `contextBridge` (native Electron API, no third-party wrapper)
  - Angular renderer side: `IpcTransportService` calls `window.electronAPI` for all DAP message I/O
  - Electron main process side: `ipcMain.handle` receives calls and forwards to the DAP Server via TCP socket
- **Dependencies**: WI-04, WI-23, WI-26
- **Status**: ⏳ Pending

### WI-25: Electron Local File System Access
<!-- status: pending | size: S | depends: WI-15, WI-23 -->
- **Size**: S
- **Description**: Implement local file reading per spec [§6.1](system-specification.md#61-electron-desktop-mode)
- **Details**:
  - Implement `FileTreeService`'s Electron version
  - Read file tree and file contents via IPC calling Node.js `fs` API
- **Dependencies**: WI-15, WI-23
- **Status**: ⏳ Pending
