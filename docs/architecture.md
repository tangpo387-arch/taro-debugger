---
title: System Architecture (Session / Transport / UI Layers)
scope: architecture, layers, state-machine, data-flow, error-handling
audience: [Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-06
related:
  - docs/system-specification.md
  - docs/dap-integration-faq.md
  - .agents/skills/dap-implementation/dap-protocol-specs.md
  - .agents/skills/state-management/state-management.md
---

# System Architecture (Master Index)

## 1. Architecture Overview

The system adopts a three-layer architecture to separate concerns. From top to bottom:

```mermaid
graph TD
    UI["<b>UI Layer</b><br/>DebuggerComponent (Angular)<br/>Pure UI logic: log, snackbar, binding"]
    Session["<b>Session Layer</b><br/>DapSessionService<br/>DAP session management, state machine, event handling"]
    Transport["<b>Transport Layer</b><br/>DapTransportService (abstract)<br/>Low-level connection, binary parsing, message I/O"]

    UI --> Session
    Session --> Transport

    subgraph Implementations ["Transport Implementations"]
        direction LR
        WSS["WebSocketTransportService<br/>"]
        IPC["IpcTransportService<br/>"]
        STS["(Future) SerialTransportService"]
    end

    Transport --> WSS
    Transport --> IPC
    Transport -.-> STS

    style UI fill:#f9f9f9,stroke:#333,stroke-width:2px
    style Session fill:#f9f9f9,stroke:#333,stroke-width:2px
    style Transport fill:#f9f9f9,stroke:#333,stroke-width:2px
```

**Design Principle**: Each layer depends only on the abstract interface of the layer below it. Cross-layer access or direct coupling to concrete implementations is prohibited.

---

## 2. Detailed Sub-Systems

The architectural documentation has been modularized. Please see the specific sub-documents below for detailed rules, lifecycles, and architectures of each area.

| Sub-System | Documentation Document | Description |
| :--- | :--- | :--- |
| **Transport Layer** | [architecture/transport-layer.md](architecture/transport-layer.md) | Low-level connection management, binary stream parsing, and extension interface. |
| **Session Layer** | [architecture/session-layer.md](architecture/session-layer.md) | Execution State Machine, configuration flows, request pairing, and transport lifecycle. |
| **UI Layer** | [architecture/ui-layer.md](architecture/ui-layer.md) | Dependency Injection constraints, UI rendering, logging architecture, and variable display caching. |
| **Visual Design** | [architecture/visual-design.md](architecture/visual-design.md) | Design Tokens, typography, density scaling, and strict layout spacing rules. |
| **Error Handling** | [architecture/error-handling.md](architecture/error-handling.md) | Synthetic Event handling (`_transportError`, `_dapError`), failure detection, and recovery sequences. |
| **Command Serialization** | [architecture/command-serialization.md](architecture/command-serialization.md) | Sync/cancel contract for control buttons, evaluate command, and call stack frame switch. |

---

## 3. Component & Feature Specifications

Granular specifications for complex UI components and specific DAP feature implementations.

| Feature / Component | Documentation Document | Description |
| :--- | :--- | :--- |
| **Assembly View** | [architecture/ui-components/assembly-view-spec.md](architecture/ui-components/assembly-view-spec.md) | Low-level instruction inspection, address-to-source mapping, and tabbed editor integration. |

---

## 4. File Reference Table

> **Note:** For a complete and up-to-date mapping of source files to their architectural layers and responsibilities, please refer to the **[Source File Responsibility Map](file-map.md)**.
