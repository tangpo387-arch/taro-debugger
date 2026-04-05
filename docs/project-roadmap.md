---
title: Project Roadmap & Dependency Map
scope: milestones, dependencies, architecture-tracking
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-05
related:
  - docs/project-management.md
  - docs/work-items.md
  - docs/test-plan.md
---

# Project Roadmap & Dependency Map

This document acts as the **Single Source of Truth (SSOT)** for the project's strategic roadmap and granular work item dependencies. It illustrates the sequence of implementation and the architectural relationships between all modules.

> [!NOTE]
> - **Lead Engineer**: Use this map to determine implementation order and spot architectural dependencies before starting a WI.
> - **QA Reviewer**: Use this map to identify regression testing paths and verify TI/WI coverage.
> - **Product Architect**: Maintain this map whenever a Feature Group is created, completed, or retired.

---

## Technical Dependency Map (Atomic View)

### Chart Color & Style Legend

| Color | Feature Group | Item Status | Style Representation |
| :--- | :--- | :--- | :--- |
| **All Colors** | (Varies by Fill Color) | **Pending / Proposed** | Solid background, standard border |
| **All Colors** | (Varies by Fill Color) | **Done** | Solid background + **Thick Black Border** (`stroke-width: 2.5px`) |
| **Any** | Retired Feature Group | **Archived** | No fill + **Dashed Border** (`stroke-dasharray: 5`) |
| 🟢 **Green** | Core Infrastructure | WI-01 ~ WI-08, WI-10, WI-11 | `#4ade80` |
| 🔵 **Blue** | Backend Relay | WI-09 | `#60a5fa` |
| 🟠 **Orange** | Debug Control UI | — | (Reserved) |
| 🟣 **Purple** | Editor Advanced Interaction | WI-12 ~ WI-14 | `#a78bfa` |
| 🟡 **Yellow** | File Resource Management | WI-15 ~ WI-16 | `#facc15` |
| 🩷 **Pink** | Debug Info Panel | WI-17 ~ WI-18 | `#f472b6` |
| 🔵 **Cyan** | Status & Console UI | WI-19 ~ WI-20 | `#2dd4bf` |
| 🟠 **Deep Orange** | Error Handling | WI-21 ~ WI-22 | `#fb923c` |
| ⬜ **Gray** | Electron Desktop Mode | WI-23 ~ WI-26 | `#94a3b8` |
| ⬜ **White** | Automation Tests | TI-01 ~ TI-06 | `#ffffff` |

### Full Map

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

    WI26[WI-26 Setup Page Split] --> WI24[WI-24 IPC Transport]
    WI23[WI-23 Electron Main Process] --> WI24
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
    style WI26 fill:#94a3b8,stroke:#64748b

    style TI01 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI02 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI03 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI04 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI05 fill:#ffffff,stroke:#000,stroke-width:2.5px
    style TI06 fill:#ffffff,stroke:#000,stroke-width:2.5px
```
