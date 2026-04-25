---
title: System Architecture (Session / Transport / UI Layers)
scope: architecture, layers, state-machine, data-flow, error-handling
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
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
    subgraph App ["<b>taro-debugger-frontend</b>"]
        UI["<b>UI Layer</b><br/>DebuggerComponent (Angular)<br/>Pure UI logic: log, snackbar, binding"]
    end

    subgraph Libs ["<b>Internal Libraries</b>"]
        direction TB
        Shared["<b>UI Shared Layer</b><br/>@taro/ui-shared<br/>Generic components, tokens, dialogs"]
        Session["<b>Session Layer</b><br/>DapSessionService<br/>DAP session management, state machine"]
        Transport["<b>Transport Layer</b><br/>DapTransportService (abstract)<br/>Low-level connection, binary parsing"]
    end

    UI --> Shared
    UI --> Session
    Shared --> Session
    Session --> Transport

    subgraph Implementations ["Transport Implementations"]
        direction LR
        WSS["WebSocketTransportService"]
        IPC["IpcTransportService"]
    end

    Transport --> WSS
    Transport --> IPC

    style UI fill:#f9f9f9,stroke:#333,stroke-width:2px
    style Shared fill:#f0f4c3,stroke:#827717,stroke-width:2px
    style Session fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style Transport fill:#e1f5fe,stroke:#01579b,stroke-width:2px
    style Libs fill:#fff,stroke:#ccc,stroke-dasharray: 5 5
```

**Design Principle**: Each layer depends only on the abstract interface of the layer below it. Cross-layer access or direct coupling to concrete implementations is prohibited.

---

## 2. Detailed Sub-Systems

The architectural documentation has been modularized. Please see the specific sub-documents below for detailed rules, lifecycles, and architectures of each area.

| Sub-System | Documentation Document | Description |
| :--- | :--- | :--- |
| **Transport Layer** | [architecture/transport-layer.md](architecture/transport-layer.md) | Low-level connection management, binary stream parsing, and extension interface. |
| **Session Layer** | [architecture/session-layer.md](architecture/session-layer.md) | Execution State Machine, configuration flows, request pairing, and transport lifecycle. |
| **UI Shared** | [ui-shared-architecture-spec.md](ui-shared-architecture-spec.md) | Centralized UI foundation (PanelComponent, ErrorDialog, Layout tokens). |
| **UI Layer** | [architecture/ui-layer.md](architecture/ui-layer.md) | Dependency Injection constraints, UI rendering, logging architecture, and functional feature groups. |
| **Visual Design** | [architecture/visual-design.md](architecture/visual-design.md) | Design Tokens, typography, density scaling, and strict layout spacing rules. |
| **Error Handling** | [architecture/error-handling.md](architecture/error-handling.md) | Synthetic Event handling (`_transportError`, `_dapError`), failure detection, and recovery sequences. |
| **Command Serialization** | [architecture/command-serialization.md](architecture/command-serialization.md) | Sync/cancel contract for control buttons, evaluate command, and call stack frame switch. |
| **Monorepo Standards** | [architecture/monorepo-standards.md](architecture/monorepo-standards.md) | Workspace resolution strategy, build-time constraints, and dependency hierarchy rules. |

---

## 3. Component & Feature Specifications

Granular specifications for complex UI components and specific DAP feature implementations.

| Feature / Component | Documentation Document | Description |
| :--- | :--- | :--- |
| **Assembly View** | [architecture/ui-components/assembly-view-spec.md](architecture/ui-components/assembly-view-spec.md) | Low-level instruction inspection, address-to-source mapping, and tabbed editor integration. |
| **Keyboard Shortcuts** | [architecture/ui-components/keyboard-shortcuts-spec.md](architecture/ui-components/keyboard-shortcuts-spec.md) | VS Code compatible Action ID mapping, global event performance optimization, and focus guard design. |

---

## 4. File Reference Table

> **Note:** For a complete and up-to-date mapping of source files to their architectural layers and responsibilities, please refer to the **[Source File Responsibility Map](file-map.md)**.
