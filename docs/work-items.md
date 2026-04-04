---
title: Work Items
scope: tasks, progress, dependencies, milestones, feature-groups
audience: [Product_Architect, Lead_Engineer]
last_updated: 2026-03-29
related:
  - docs/system-specification.md
  - docs/design-decisions.md
  - docs/test-plan.md
---

# DAP Debugger Frontend — Work Items

> [!NOTE]
> Generated from a gap analysis between [system-specification.md v1.0](system-specification.md) and the existing codebase. Each item is moderately sized for incremental delivery.
> Items use `WI-##` (e.g., `WI-01`, `WI-18.2`) and test items use `TI-##` (e.g., `TI-05`). For the full lifecycle process, see [project-management.md](project-management.md).

---

## Backend Relay (Web Mode)

### WI-09: Implement Node.js WebSocket Bridge
<!-- status: pending | size: M | depends: none -->
- **Size**: M
- **Description**: Implement a simple Node.js server that receives frontend WebSocket connections and forwards them to the local DAP executable (e.g., `lldb-dap`)
- **Details**:
  - Use the `ws` module to create a WebSocket Server (e.g., running on `:8080`)
  - On connection, launch `lldb-dap` or `gdb` as a child process based on the protocol
  - Bidirectional data forwarding: WebSocket → DAP `stdin`; DAP `stdout` → WebSocket back to frontend
  - Handle process termination and resource cleanup
- **Status**: ⏳ Pending

---

## Electron Desktop Mode (Optional)

### WI-24: Electron IPC Transport Layer (`IpcTransportService`)
<!-- status: pending | size: M | depends: WI-04, WI-23 -->
- **Size**: M
- **Description**: Implement IPC communication per spec [§4.1](system-specification.md#41-electron-desktop-mode)
- **Details**:
  - Implement `DapTransportService`'s IPC version (`IpcTransportService`)
  - `preload.ts` exposes `window.electronAPI` via `contextBridge` (native Electron API, no third-party wrapper)
  - Angular renderer side: `IpcTransportService` calls `window.electronAPI` for all DAP message I/O
  - Electron main process side: `ipcMain.handle` receives calls and forwards to the DAP Server via TCP socket
- **Dependencies**: WI-04, WI-23
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

---

## Recommended Development Order

### Chart Color Legend

| Color | Meaning | Item Status |
| --- | --- | --- |
| Solid background | Category feature (to implement) | Solid background color represents the category |
| Black border | Item completed | Solid category background + **thick black border** = completed |
| 🟢 **Green** | Core Infrastructure | WI-01 ~ WI-08, WI-10, WI-11 |
| 🔵 **Blue** | Backend Relay (Bridge) | WI-09 |
| 🟠 **Orange** | Debug Control UI (Controls) | |
| 🟣 **Purple** | Editor Advanced Interaction | WI-12 ~ WI-14 |
| 🟡 **Yellow** | File Resource Management (Explorer) | WI-15 ~ WI-16 |
| 🩷 **Pink** | Debug Info Panel (Inspector) | WI-17 ~ WI-18 |
| 🔵 **Cyan** | Status & Console (UI) | WI-19 ~ WI-20 |
| 🟠 **Deep Orange** | Error Handling | WI-21 ~ WI-22 |
| ⬜ **Gray** | Electron Desktop (Bridge) | WI-23 ~ WI-25 |
| ⬜ **White** | Automation Tests (Testing) | TI-01 ~ TI-05 |

```mermaid
graph LR
    WI01[WI-01 Config Model] --> WI02[WI-02 Form Fields]
    WI02 --> WI03[WI-03 Form Validation]

    WI04[WI-04 Transport Abstract] --> WI05[WI-05 WebSocket Impl]
    WI05 --> WI06[WI-06 DAP Session Mgmt]

    WI06 --> WI07[WI-07 Debugger Integration]
    WI06 --> WI08[WI-08 DAP Timeout]

    WI06 -.-> WI09[WI-09 Node.js WS Bridge]

    WI07 --> WI10[WI-10 Control Buttons]
    WI07 --> WI11[WI-11 Event State Mgmt]

    WI12[WI-12 Breakpoint UI] --> WI13[WI-13 Breakpoint DAP Sync]
    WI06 --> WI13
    WI11 --> WI14[WI-14 Current Line Highlight]

    WI15[WI-15 FileTree Abstract] --> WI16[WI-16 File Tree UI]

    WI11 --> WI17[WI-17 Call Stack]
    WI11 --> WI18_1[WI-18.1 Variables State]
    WI17 --> WI18_1
    WI18_1 --> WI18_2[WI-18.2 Variables UI]

    WI11 --> WI19[WI-19 Console]
    WI05 --> WI20[WI-20 Connection Indicator]

    WI05 --> WI21[WI-21 Connection Error Handling]
    WI20 --> WI21
    WI06 --> WI22[WI-22 DAP Error Handling]

    WI21 -.-> TI05[TI-05 Error Integration Tests]
    WI22 -.-> TI05
    WI18_1 -.-> TI06[TI-06 Variables Unit Tests]

    WI23[WI-23 Electron Main Process] --> WI24[WI-24 IPC Transport]
    WI04 --> WI24
    WI23 --> WI25[WI-25 Electron File System]
    WI15 --> WI25

    WI01 -.-> TI01[TI-01 Config Unit Tests]
    WI06 -.-> TI02[TI-02 Session Unit Tests]
    WI05 -.-> TI03[TI-03 Transport Unit Tests]
    WI15 -.-> TI04[TI-04 FileTree Unit Tests]

    style WI01 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI02 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI03 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI04 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI05 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI06 fill:#4ade80,stroke:#000,stroke-width:2.5px

    style WI07 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI08 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI09 fill:#60a5fa,stroke:#2563eb

    style WI10 fill:#f97316,stroke:#000,stroke-width:2.5px
    style WI11 fill:#f97316,stroke:#000,stroke-width:2.5px

    style WI12 fill:#a78bfa,stroke:#000,stroke-width:2.5px
    style WI13 fill:#a78bfa,stroke:#000,stroke-width:2.5px
    style WI14 fill:#a78bfa,stroke:#000,stroke-width:2.5px

    style WI15 fill:#facc15,stroke:#000,stroke-width:2.5px
    style WI16 fill:#facc15,stroke:#000,stroke-width:2.5px

    style WI17 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI18_1 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI18_2 fill:#f472b6,stroke:#000,stroke-width:2.5px

    style WI19 fill:#2dd4bf,stroke:#000,stroke-width:2.5px
    style WI20 fill:#2dd4bf,stroke:#000,stroke-width:2.5px

    style WI21 fill:#fb923c,stroke:#000,stroke-width:2.5px
    style WI22 fill:#fb923c,stroke:#000,stroke-width:2.5px

    style WI23 fill:#94a3b8,stroke:#000,stroke-width:2.5px
    style WI24 fill:#94a3b8,stroke:#64748b
    style WI25 fill:#94a3b8,stroke:#64748b

    style TI01 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI02 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI03 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI04 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI05 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI06 fill:#ffffff,stroke:#000,stroke-width:2.5px
```
