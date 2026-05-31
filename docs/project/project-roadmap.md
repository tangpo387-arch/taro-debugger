---
title: Project Roadmap & Dependency Map
scope: milestones, dependencies, architecture-tracking
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, Human Engineer]
last_updated: 2026-05-31
---

# Project Roadmap & Dependency Map

```mermaid
graph LR
    WI_19["WI-19 Debug Console Functionality"]
    WI_20["WI-20 Connection Status Indicator Functionality"]
    WI_38["WI-38 Command Serialization: Evaluate Cancel & Timeout"]
    WI_67["WI-67 Library Extraction: LogViewerComponent"]
    WI_68["WI-68 DAP Protocol Inspector (3-Tab Support)"]
    WI_92["WI-92 Debug Console Input Integration & Output Redirection"]
    WI_04["WI-04 Create `DapTransportService` Abstract Interface"]
    WI_05["WI-05 Implement WebSocket Transport Layer (`WebSocketTransportService`)"]
    WI_06["WI-06 DAP Session Management Service (`DapSessionService`)"]
    WI_07["WI-07 DAP Request Timeout Mechanism"]
    WI_08["WI-08 Integrate DapSessionService in DebuggerComponent"]
    WI_09["WI-09 Implement taro-session Core & Client"]
    WI_21["WI-21 Connection Error Handling"]
    WI_22["WI-22 DAP Server Error Handling"]
    WI_31["WI-31 DAP 'terminated' Event _restart Payload Passing"]
    WI_53["WI-53 Extract DAP Core Library"]
    WI_59["WI-59 Lib: Initialize & Extract API Types"]
    WI_60["WI-60 Lib: Extract Transport Layer"]
    WI_61["WI-61 Lib: Extract Session Manager"]
    WI_62["WI-62 Lib: Final Integration & Cleanup"]
    WI_86["WI-86 Standardize Capability-Aware Stop and Restart Logic"]
    WI_87["WI-87 Merge terminated and idle execution states"]
    WI_89["WI-89 Refactor DapSessionService Encapsulation"]
    WI_90["WI-90 Encapsulate DapSessionService Reset Logic"]
    WI_94["WI-94 DapSessionManager Core Implementation"]
    WI_123["WI-123 Stop at Main via DAP Function Breakpoints"]
    WI_126["WI-126 Implement execution-scoped stackTrace cache and request coalescing in DapSessionService"]
    WI_132["WI-132 Implement taro-session Chat Routing & Log Persistence"]
    WI_133["WI-133 Implement taro-session Agent Memory & MCP Host"]
    WI_134["WI-134 Implement AI Companion Integration & Cognitive Loop"]
    WI_136["WI-136 Implement taro-session Connection State Machine & Setup Handshake"]
    WI_138["WI-138 Implement taro-session Unit Testing Suite"]
    WI_139["WI-139 Validate Session Directory Existence in setup open-session Handshake"]
    WI_140["WI-140 DapSessionService Quick Wins: Deduplication, Guards & Typing"]
    WI_141["WI-141 Extract DapBreakpointManager & DapThreadManager"]
    WI_142["WI-142 Extract DapRequestBroker & DapRequestSender Interface"]
    WI_143["WI-143 Extract DapExecutionController & DapSessionLifecycle Facade"]
    WI_10["WI-10 Debug Control Button Functionality"]
    WI_11["WI-11 DAP Event Handling & State Management"]
    WI_39["WI-39 Command Serialization: Control Button In-Flight Guard"]
    WI_40["WI-40 Command Serialization: disconnect/terminate One-Shot Guard"]
    WI_43["WI-43 VS Code Compatible Keyboard Shortcuts"]
    WI_97["WI-97 Context-Aware Debug Toolbar"]
    WI_98["WI-98 Global Debug Lifecycle Actions (Stop All)"]
    WI_101["WI-101 Fix Execution State Toggle Delay & Stepping Thread Context"]
    WI_144["WI-144 bug: Handle Active Thread Stepping and Play/Pause Controls under Multi-Threaded Non-Stop Stepping"]
    WI_12["WI-12 Monaco Editor Breakpoint Interaction"]
    WI_13["WI-13 Breakpoint DAP Synchronization"]
    WI_14["WI-14 Current Line Highlight"]
    WI_41["WI-41 Command Serialization: setBreakpoints Debounce + Per-File Serialization"]
    WI_49["WI-49 Editor View State Persistence"]
    WI_65["WI-65 Library Extraction: EditorComponent"]
    WI_71["WI-71 Breakpoints Panel: Interactive Management UI"]
    WI_23["WI-23 Electron Main Process Architecture"]
    WI_26["WI-26 Setup Page Separation"]
    WI_24["WI-24 Electron IPC Transport Layer (`IpcTransportService`)"]
    WI_25["WI-25 Electron Local File System Access"]
    WI_135["WI-135 Restructure Electron Desktop Workspace & Runtime Separation"]
    WI_17["WI-17 Call Stack Panel"]
    WI_55["WI-55 Variables Data State Management"]
    WI_56["WI-56 Variables Tree UI Component"]
    WI_30["WI-30 Local Variable Modification"]
    WI_42["WI-42 Command Serialization: Frame Switch Cancel-and-Replace"]
    WI_69["WI-69 UI Layout: Thread & Breakpoint Panels"]
    WI_70["WI-70 Data Binding: Thread List Integration"]
    WI_73["WI-73 UI Library: Extract @taro/ui-inspection"]
    WI_79["WI-79 Non-Stop Mode UI Integration"]
    WI_83["WI-83 Fix Call Stack persistence during execution"]
    WI_91["WI-91 Reactive Idle State UI Reset"]
    WI_93["WI-93 Unified Call Stack Tree"]
    WI_95["WI-95 Reactive Active-Session Context Binding"]
    WI_96["WI-96 Unified Tree: Multi-Session Hierarchy Support"]
    WI_100["WI-100 Improve No-Source Frame UX"]
    WI_102["WI-102 Refine Thread Interaction & Auto-Expansion"]
    WI_103["WI-103 Refactor: Centralize Breakpoint State Management"]
    WI_124["WI-124 Refine Variables Tree UX: Hover-to-Reveal Memory Inspection"]
    WI_125["WI-125 Refine Variables Panel UX: Tooltips, Filtering, and Layout"]
    WI_15["WI-15 File Tree Service Abstraction (`FileTreeService`)"]
    WI_16["WI-16 Left Sidenav File Tree UI"]
    WI_33["WI-33 Implement Source Content LRU Cache"]
    WI_34["WI-34 Manage Source Cache Lifecycle and Verification"]
    WI_82["WI-82 Optimize File Explorer and Implement Virtual Root"]
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
    WI_54["WI-54 Convert to Angular Workspace"]
    WI_57["WI-57 Monorepo: Relocate Application Source"]
    WI_58["WI-58 Monorepo: Adapt Build & Electron Scripts"]
    WI_63["WI-63 System-wide ID Flattening and Script Hardening"]
    WI_64["WI-64 Monorepo: Comprehensive Documentation Audit"]
    WI_72["WI-72 Refactor doc-guard.js"]
    WI_99["WI-99 Author Multi-Process Debug Architecture Document"]
    WI_122["WI-122 Fix Disconnected State Display Inconsistency"]
    WI_131["WI-131 Remove LLDB Support and References"]
    WI_27["WI-27 Integration of Tabbed Layout and Navigation"]
    WI_28["WI-28 DapAssemblyService and Disassemble Request"]
    WI_29["WI-29 AssemblyViewComponent and Instruction Rendering"]
    WI_32["WI-32 Implement Instruction-Level Stepping (stepi/nexti)"]
    WI_66["WI-66 Library Extraction: AssemblyViewComponent"]
    WI_84["WI-84 Implement Memory View (Hex Dump)"]
    WI_104["WI-104 DAP Memory Protocol & Service"]
    WI_105["WI-105 Memory Hex Dump Component"]
    WI_106["WI-106 Memory View Host Integration"]
    WI_107["WI-107 DapRegisterService Implementation"]
    WI_108["WI-108 AssemblyRegisterPanelComponent"]
    WI_109["WI-109 Assembly Dashboard Integration"]
    WI_110["WI-110 Assembly Instruction Cache Implementation"]
    WI_111["WI-111 Decouple Disassembly Cache to Core"]
    WI_112["WI-112 Centralize Assembly PC & Window Logic"]
    WI_113["WI-113 Assembly View: Address-Based Navigation"]
    WI_114["WI-114 Decouple viewport from execution PC in Assembly View"]
    WI_116["WI-116 Assembly View: Fix Opcode and Mnemonic Column Truncation"]
    WI_117["WI-117 Remove sortedAddresses from DapAssemblyCacheService"]
    WI_118["WI-118 Fix Assembly View Icon Flashing during Stepping"]
    WI_119["WI-119 Fix Assembly Header Symbol Overflow"]
    WI_120["WI-120 Memory Layout Visualization & Probing"]
    WI_121["WI-121 Inline Memory Editing Support"]
    WI_127["WI-127 Assembly View: Optimize Cache Hits & DAP Communication Efficiency"]
    WI_129["WI-129 Redefine Assembly View Header & Symbol Extraction"]
    WI_130["WI-130 Infinite Memory View Scroll & Anchoring"]
    WI_145["WI-145 Memory Segment Minimap"]
    WI_01["WI-01 Extend `GdbConfigService` Configuration Model"]
    WI_02["WI-02 Setup Form Field Completion"]
    WI_03["WI-03 Setup Form Validation"]
    WI_137["WI-137 Integrate Frontend Setup Handshake with Dynamic sessionPath and Connection States"]
    WI_75["WI-75 Refactor: Extract @taro/ui-shared Foundation"]
    WI_74["WI-74 Standardization of UI Patterns"]
    WI_76["WI-76 Design Tokens & Dark Mode Support"]
    WI_77["WI-77 Generic Dialog & Notification Framework"]
    WI_78["WI-78 A11y Audit & Interaction Hardening"]
    WI_80["WI-80 Standardize Empty States"]
    WI_81["WI-81 Application Frame & Global Controls Integration"]
    WI_85["WI-85 Consolidate Debug Panels to Left Sidenav"]
    WI_88["WI-88 Extract panel group layout component"]
    WI_115["WI-115 Implement Dual-Layer Fatal Error Handling"]
    WI_128["WI-128 Unify Tree Node Expansion Behavior"]
    WI_11 --> WI_19
    WI_05 --> WI_20
    WI_39 --> WI_38
    WI_62 --> WI_67
    WI_67 --> WI_68
    WI_19 --> WI_92
    WI_38 --> WI_92
    WI_04 --> WI_05
    WI_05 --> WI_06
    WI_06 --> WI_07
    WI_06 --> WI_08
    WI_07 --> WI_08
    WI_05 --> WI_21
    WI_20 --> WI_21
    WI_06 --> WI_22
    WI_06 --> WI_31
    WI_54 --> WI_53
    WI_58 --> WI_59
    WI_59 --> WI_60
    WI_60 --> WI_61
    WI_61 --> WI_62
    WI_06 --> WI_126
    WI_09 --> WI_132
    WI_132 --> WI_133
    WI_133 --> WI_134
    WI_136 --> WI_139
    WI_137 --> WI_139
    WI_140 --> WI_141
    WI_141 --> WI_142
    WI_142 --> WI_143
    WI_07 --> WI_10
    WI_07 --> WI_11
    WI_10 --> WI_39
    WI_10 --> WI_40
    WI_95 --> WI_97
    WI_94 --> WI_98
    WI_06 --> WI_13
    WI_12 --> WI_13
    WI_11 --> WI_14
    WI_13 --> WI_41
    WI_62 --> WI_65
    WI_69 --> WI_71
    WI_41 --> WI_71
    WI_04 --> WI_24
    WI_23 --> WI_24
    WI_26 --> WI_24
    WI_15 --> WI_25
    WI_23 --> WI_25
    WI_11 --> WI_17
    WI_11 --> WI_55
    WI_17 --> WI_55
    WI_55 --> WI_56
    WI_55 --> WI_30
    WI_56 --> WI_30
    WI_17 --> WI_42
    WI_73 --> WI_42
    WI_62 --> WI_69
    WI_41 --> WI_69
    WI_73 --> WI_69
    WI_69 --> WI_70
    WI_70 --> WI_79
    WI_94 --> WI_95
    WI_93 --> WI_96
    WI_95 --> WI_96
    WI_56 --> WI_124
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
    WI_57 --> WI_58
    WI_62 --> WI_64
    WI_94 --> WI_99
    WI_95 --> WI_99
    WI_96 --> WI_99
    WI_97 --> WI_99
    WI_98 --> WI_99
    WI_07 --> WI_27
    WI_11 --> WI_27
    WI_06 --> WI_28
    WI_27 --> WI_29
    WI_28 --> WI_29
    WI_29 --> WI_32
    WI_62 --> WI_66
    WI_104 --> WI_105
    WI_105 --> WI_106
    WI_107 --> WI_108
    WI_108 --> WI_109
    WI_28 --> WI_110
    WI_29 --> WI_110
    WI_112 --> WI_113
    WI_130 --> WI_120
    WI_130 --> WI_121
    WI_106 --> WI_130
    WI_130 --> WI_145
    WI_01 --> WI_02
    WI_02 --> WI_03
    WI_136 --> WI_137
    WI_75 --> WI_74
    WI_75 --> WI_76
    WI_75 --> WI_77
    WI_75 --> WI_78

    style WI_19 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_20 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_38 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_67 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_68 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_92 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_04 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_05 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_06 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_07 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_08 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_09 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_21 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_22 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_31 fill:#4ade80,stroke:#22c55e
    style WI_53 fill:none,stroke-dasharray:5
    style WI_59 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_60 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_61 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_62 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_86 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_87 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_89 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_90 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_94 fill:none,stroke-dasharray:5
    style WI_123 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_126 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_132 fill:none,stroke-dasharray:5
    style WI_133 fill:#4ade80,stroke:#22c55e
    style WI_134 fill:#4ade80,stroke:#22c55e
    style WI_136 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_138 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_139 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_140 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_141 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_142 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_143 fill:#4ade80,stroke:#000,stroke-width:2.5px
    style WI_10 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_11 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_39 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_40 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_43 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_97 fill:none,stroke-dasharray:5
    style WI_98 fill:none,stroke-dasharray:5
    style WI_101 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_144 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_12 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_13 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_14 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_41 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_49 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_65 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_71 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_23 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_26 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_24 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_25 fill:none,stroke-dasharray:5
    style WI_135 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_17 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_55 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_56 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_30 fill:#f472b6,stroke:#db2777
    style WI_42 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_69 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_70 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_73 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_79 fill:#f472b6,stroke:#db2777
    style WI_83 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_91 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_93 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_95 fill:none,stroke-dasharray:5
    style WI_96 fill:none,stroke-dasharray:5
    style WI_100 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_102 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_103 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_124 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_125 fill:#f472b6,stroke:#000,stroke-width:2.5px
    style WI_15 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_16 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_33 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_34 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_82 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_35 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_36 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_37 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_44 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_45 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_46 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_47 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_48 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_50 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_51 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_52 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_54 fill:none,stroke-dasharray:5
    style WI_57 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_58 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_63 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_64 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_72 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_99 fill:none,stroke-dasharray:5
    style WI_122 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_131 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_27 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_28 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_29 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_32 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_66 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_84 fill:none,stroke-dasharray:5
    style WI_104 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_105 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_106 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_107 fill:#6366f1,stroke:#4f46e5
    style WI_108 fill:#6366f1,stroke:#4f46e5
    style WI_109 fill:#6366f1,stroke:#4f46e5
    style WI_110 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_111 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_112 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_113 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_114 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_116 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_117 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_118 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_119 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_120 fill:#6366f1,stroke:#4f46e5
    style WI_121 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_127 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_129 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_130 fill:#6366f1,stroke:#000,stroke-width:2.5px
    style WI_145 fill:#6366f1,stroke:#4f46e5
    style WI_01 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_02 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_03 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_137 fill:#f1f5f9,stroke:#94a3b8,stroke-width:1px,stroke-dasharray:2
    style WI_75 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_74 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_76 fill:#cbd5e1,stroke:#475569
    style WI_77 fill:#cbd5e1,stroke:#475569
    style WI_78 fill:#cbd5e1,stroke:#475569
    style WI_80 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_81 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_85 fill:none,stroke-dasharray:5
    style WI_88 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_115 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
    style WI_128 fill:#cbd5e1,stroke:#000,stroke-width:2.5px
```

## Feature Groups

| Group | Color | Status |
| :--- | :--- | :--- |
| Setup View | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 💎 Stabilized |
| DAP Transport Layer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%234ade80'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#4ade80"/> `#4ade80` | 🔵 Active |
| Debug Controls | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f97316'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f97316"/> `#f97316` | 💎 Stabilized |
| Editor Features | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23a78bfa'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#a78bfa"/> `#a78bfa` | 💎 Stabilized |
| File Explorer | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23facc15'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#facc15"/> `#facc15` | 💎 Stabilized |
| Execution Context Inspection | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f472b6'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f472b6"/> `#f472b6` | 🔵 Active |
| Console & Status Bar | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%232dd4bf'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#2dd4bf"/> `#2dd4bf` | 💎 Stabilized |
| Electron Desktop Mode | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%2394a3b8'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#94a3b8"/> `#94a3b8` | 💎 Stabilized |
| Low-Level Inspection | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%236366f1'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#6366f1"/> `#6366f1` | 🔵 Active |
| General | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23f1f5f9'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#f1f5f9"/> `#f1f5f9` | 💎 Stabilized |
| UI System Design | <img src="data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20width%3D'14'%20height%3D'14'%3E%3Crect%20width%3D'14'%20height%3D'14'%20fill%3D'%23cbd5e1'%20rx%3D'3'%2F%3E%3C%2Fsvg%3E" width="14" height="14" alt="#cbd5e1"/> `#cbd5e1` | 🔵 Active |
