---
title: Project Roadmap & Dependency Map
scope: milestones, dependencies, architecture-tracking
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-11
---

# Project Roadmap & Dependency Map

```mermaid
graph LR
    WI_09["WI-09 Implement Node.js WebSocket Bridge"]
    WI_19["WI-19 Debug Console Functionality"]
    WI_20["WI-20 Connection Status Indicator Functionality"]
    WI_04["WI-04 Create `DapTransportService` Abstract Interface"]
    WI_05["WI-05 Implement WebSocket Transport Layer (`WebSocketTransportService`)"]
    WI_06["WI-06 DAP Session Management Service (`DapSessionService`)"]
    WI_07["WI-07 DAP Request Timeout Mechanism"]
    WI_08["WI-08 Integrate DapSessionService in DebuggerComponent"]
    WI_31["WI-31 DAP 'terminated' Event _restart Payload Passing"]
    WI_10["WI-10 Debug Control Button Functionality"]
    WI_11["WI-11 DAP Event Handling & State Management"]
    WI_12["WI-12 Monaco Editor Breakpoint Interaction"]
    WI_13["WI-13 Breakpoint DAP Synchronization"]
    WI_14["WI-14 Current Line Highlight"]
    WI_23["WI-23 Electron Main Process Architecture"]
    WI_26["WI-26 Setup Page Separation"]
    WI_24["WI-24 Electron IPC Transport Layer (`IpcTransportService`)"]
    WI_25["WI-25 Electron Local File System Access"]
    WI_21["WI-21 Connection Error Handling"]
    WI_22["WI-22 DAP Server Error Handling"]
    WI_15["WI-15 File Tree Service Abstraction (`FileTreeService`)"]
    WI_16["WI-16 Left Sidenav File Tree UI"]
    WI_27["WI-27 Integration of Tabbed Layout and Navigation"]
    WI_28["WI-28 DapAssemblyService and Disassemble Request"]
    WI_29["WI-29 AssemblyViewComponent and Instruction Rendering"]
    WI_01["WI-01 Extend `GdbConfigService` Configuration Model"]
    WI_02["WI-02 Setup Form Field Completion"]
    WI_03["WI-03 Setup Form Validation"]
    WI_17["WI-17 Call Stack Panel"]
    WI_18_1["WI-18.1 Variables Data State Management"]
    WI_18_2["WI-18.2 Variables Tree UI Component"]
    WI_30["WI-30 Local Variable Modification"]
    WI_11 --> WI_19
    WI_05 --> WI_20
    WI_04 --> WI_05
    WI_05 --> WI_06
    WI_06 --> WI_07
    WI_06 --> WI_08
    WI_07 --> WI_08
    WI_07 --> WI_10
    WI_07 --> WI_11
    WI_06 --> WI_13
    WI_12 --> WI_13
    WI_11 --> WI_14
    WI_04 --> WI_24
    WI_23 --> WI_24
    WI_26 --> WI_24
    WI_15 --> WI_25
    WI_23 --> WI_25
    WI_05 --> WI_21
    WI_20 --> WI_21
    WI_06 --> WI_22
    WI_15 --> WI_16
    WI_07 --> WI_27
    WI_11 --> WI_27
    WI_06 --> WI_28
    WI_27 --> WI_29
    WI_28 --> WI_29
    WI_01 --> WI_02
    WI_02 --> WI_03
    WI_11 --> WI_17
    WI_11 --> WI_18_1
    WI_17 --> WI_18_1
    WI_18_1 --> WI_18_2
    WI_18_1 --> WI_30
    WI_18_2 --> WI_30

    style WI_09 fill:#60a5fa,stroke:#2563eb
    style WI_19 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_20 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_04 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_05 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_06 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_07 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_08 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_31 fill:#4ade80,stroke:#22c55e
    style WI_10 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_11 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_12 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_13 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_14 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_23 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_26 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_24 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_25 fill:none,stroke-dasharray:5
    style WI_21 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_22 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_15 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_16 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_27 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_28 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_29 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_01 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_02 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_03 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_17 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_18_1 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_18_2 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_30 fill:#f472b6,stroke:#db2777
```

## Feature Groups

| Group | Color | Status |
| :--- | :--- | :--- |
| Setup View | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 💎 Stabilized |
| DAP Transport Layer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 🔵 Active |
| Backend Relay | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%2360a5fa'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#60a5fa"/> `#60a5fa` | 🔵 Active |
| Debug Controls | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f1f5f9'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f1f5f9"/> `#f1f5f9` | 💎 Stabilized |
| Editor Features | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23a78bfa'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#a78bfa"/> `#a78bfa` | 💎 Stabilized |
| File Explorer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23facc15'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#facc15"/> `#facc15` | 💎 Stabilized |
| Variables & Call Stack | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f472b6'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f472b6"/> `#f472b6` | 🔵 Active |
| Console & Status Bar | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%232dd4bf'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#2dd4bf"/> `#2dd4bf` | 💎 Stabilized |
| Error Handling | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23fb923c'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#fb923c"/> `#fb923c` | 💎 Stabilized |
| Electron Desktop Mode | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%2394a3b8'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#94a3b8"/> `#94a3b8` | 💎 Stabilized |
| Low-Level Inspection | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%236366f1'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#6366f1"/> `#6366f1` | 💎 Stabilized |
