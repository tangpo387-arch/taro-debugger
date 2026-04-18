---
title: Project Roadmap & Dependency Map
scope: milestones, dependencies, architecture-tracking
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-18
---

# Project Roadmap & Dependency Map

```mermaid
graph LR
    WI_19["WI-19 Debug Console Functionality"]
    WI_20["WI-20 Connection Status Indicator Functionality"]
    WI_38["WI-38 Command Serialization: Evaluate Cancel & Timeout"]
    WI_04["WI-04 Create `DapTransportService` Abstract Interface"]
    WI_05["WI-05 Implement WebSocket Transport Layer (`WebSocketTransportService`)"]
    WI_06["WI-06 DAP Session Management Service (`DapSessionService`)"]
    WI_07["WI-07 DAP Request Timeout Mechanism"]
    WI_08["WI-08 Integrate DapSessionService in DebuggerComponent"]
    WI_09["WI-09 Implement Node.js WebSocket Bridge"]
    WI_21["WI-21 Connection Error Handling"]
    WI_22["WI-22 DAP Server Error Handling"]
    WI_31["WI-31 DAP 'terminated' Event _restart Payload Passing"]
    WI_10["WI-10 Debug Control Button Functionality"]
    WI_11["WI-11 DAP Event Handling & State Management"]
    WI_39["WI-39 Command Serialization: Control Button In-Flight Guard"]
    WI_40["WI-40 Command Serialization: disconnect/terminate One-Shot Guard"]
    WI_43["WI-43 VS Code Compatible Keyboard Shortcuts"]
    WI_12["WI-12 Monaco Editor Breakpoint Interaction"]
    WI_13["WI-13 Breakpoint DAP Synchronization"]
    WI_14["WI-14 Current Line Highlight"]
    WI_41["WI-41 Command Serialization: setBreakpoints Debounce + Per-File Serialization"]
    WI_49["WI-49 Editor View State Persistence"]
    WI_23["WI-23 Electron Main Process Architecture"]
    WI_26["WI-26 Setup Page Separation"]
    WI_24["WI-24 Electron IPC Transport Layer (`IpcTransportService`)"]
    WI_25["WI-25 Electron Local File System Access"]
    WI_15["WI-15 File Tree Service Abstraction (`FileTreeService`)"]
    WI_16["WI-16 Left Sidenav File Tree UI"]
    WI_33["WI-33 Implement Source Content LRU Cache"]
    WI_34["WI-34 Manage Source Cache Lifecycle and Verification"]
    WI_35["WI-35 Migrate Work-Item Data Files to Group-Definition Schema"]
    WI_36["WI-36 Update Scripts for Group-Definition Schema"]
    WI_37["WI-37 Update Documentation for Group-Definition Schema"]
    WI_44["WI-44 Enrich manage-wi.js show & Update Governance Doc"]
    WI_45["WI-45 Spec: Extended WI Lifecycle"]
    WI_46["WI-46 Logic: update-wi.js Lifecycle Update"]
    WI_47["WI-47 Logic: generate-docs.js Rendering Engine"]
    WI_48["WI-48 Spec: work-item-management Skill Update"]
    WI_50["WI-50 Enhanced Work Item Querying"]
    WI_51["WI-51 Documentation Workflow Automation (Doc-Guard)"]
    WI_52["WI-52 Workflow Integration: Doc-Guard Protocol"]
    WI_27["WI-27 Integration of Tabbed Layout and Navigation"]
    WI_28["WI-28 DapAssemblyService and Disassemble Request"]
    WI_29["WI-29 AssemblyViewComponent and Instruction Rendering"]
    WI_32["WI-32 Implement Instruction-Level Stepping (stepi/nexti)"]
    WI_01["WI-01 Extend `GdbConfigService` Configuration Model"]
    WI_02["WI-02 Setup Form Field Completion"]
    WI_03["WI-03 Setup Form Validation"]
    WI_17["WI-17 Call Stack Panel"]
    WI_18_1["WI-18.1 Variables Data State Management"]
    WI_18_2["WI-18.2 Variables Tree UI Component"]
    WI_30["WI-30 Local Variable Modification"]
    WI_42["WI-42 Command Serialization: Frame Switch Cancel-and-Replace"]
    WI_11 --> WI_19
    WI_05 --> WI_20
    WI_39 --> WI_38
    WI_04 --> WI_05
    WI_05 --> WI_06
    WI_06 --> WI_07
    WI_06 --> WI_08
    WI_07 --> WI_08
    WI_05 --> WI_21
    WI_20 --> WI_21
    WI_06 --> WI_22
    WI_06 --> WI_31
    WI_07 --> WI_10
    WI_07 --> WI_11
    WI_10 --> WI_39
    WI_10 --> WI_40
    WI_06 --> WI_13
    WI_12 --> WI_13
    WI_11 --> WI_14
    WI_13 --> WI_41
    WI_04 --> WI_24
    WI_23 --> WI_24
    WI_26 --> WI_24
    WI_15 --> WI_25
    WI_23 --> WI_25
    WI_15 --> WI_16
    WI_15 --> WI_33
    WI_33 --> WI_34
    WI_35 --> WI_36
    WI_35 --> WI_37
    WI_36 --> WI_37
    WI_45 --> WI_46
    WI_46 --> WI_47
    WI_45 --> WI_48
    WI_51 --> WI_52
    WI_07 --> WI_27
    WI_11 --> WI_27
    WI_06 --> WI_28
    WI_27 --> WI_29
    WI_28 --> WI_29
    WI_29 --> WI_32
    WI_01 --> WI_02
    WI_02 --> WI_03
    WI_11 --> WI_17
    WI_11 --> WI_18_1
    WI_17 --> WI_18_1
    WI_18_1 --> WI_18_2
    WI_18_1 --> WI_30
    WI_18_2 --> WI_30
    WI_17 --> WI_42

    style WI_19 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_20 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_38 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_04 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_05 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_06 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_07 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_08 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_09 fill:#4ade80,stroke:#22c55e
    style WI_21 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_22 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_31 fill:#4ade80,stroke:#22c55e
    style WI_10 fill:#f97316,stroke:#000,stroke-width:2.5px
    style WI_11 fill:#f97316,stroke:#000,stroke-width:2.5px
    style WI_39 fill:#f97316,stroke:#000,stroke-width:2.5px
    style WI_40 fill:#f97316,stroke:#ea580c
    style WI_43 fill:#f97316,stroke:#000,stroke-width:2.5px
    style WI_12 fill:#a78bfa,stroke:#000,stroke-width:2.5px
    style WI_13 fill:#a78bfa,stroke:#000,stroke-width:2.5px
    style WI_14 fill:#a78bfa,stroke:#000,stroke-width:2.5px
    style WI_41 fill:#a78bfa,stroke:#7c3aed
    style WI_49 fill:#a78bfa,stroke:#7c3aed
    style WI_23 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_26 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_24 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_25 fill:none,stroke-dasharray:5
    style WI_15 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_16 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_33 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_34 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_35 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_36 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_37 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_44 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_45 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_46 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_47 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_48 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_50 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_51 fill:#f1f5f9,stroke:#000,stroke-width:2.5px
    style WI_52 fill:#f1f5f9,stroke:#64748b
    style WI_27 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_28 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_29 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_32 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_01 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_02 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_03 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_17 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_18_1 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_18_2 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_30 fill:#f472b6,stroke:#db2777
    style WI_42 fill:#f472b6,stroke:#db2777
```

## Feature Groups

| Group | Color | Status |
| :--- | :--- | :--- |
| Setup View | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 💎 Stabilized |
| DAP Transport Layer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 🔵 Active |
| Debug Controls | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f97316'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f97316"/> `#f97316` | 🔵 Active |
| Editor Features | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23a78bfa'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#a78bfa"/> `#a78bfa` | 🔵 Active |
| File Explorer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23facc15'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#facc15"/> `#facc15` | 💎 Stabilized |
| Variables & Call Stack | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f472b6'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f472b6"/> `#f472b6` | 🔵 Active |
| Console & Status Bar | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%232dd4bf'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#2dd4bf"/> `#2dd4bf` | 💎 Stabilized |
| Electron Desktop Mode | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%2394a3b8'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#94a3b8"/> `#94a3b8` | 💎 Stabilized |
| Low-Level Inspection | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%236366f1'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#6366f1"/> `#6366f1` | 💎 Stabilized |
| General | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f1f5f9'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f1f5f9"/> `#f1f5f9` | 🔵 Active |
