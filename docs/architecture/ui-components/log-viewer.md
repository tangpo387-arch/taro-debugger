---
title: Architecture - Log Viewer & Consoles (@taro/ui-console)
scope: ui-console, debug-console, output-console, protocol-inspector, logging
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/ui-shared.md
  - architecture/visual-design.md
---

# Log Viewer & Consoles

The `@taro/ui-console` library provides the multi-tabbed interface for system logs, program output, and protocol diagnostics.

## 1. Responsibilities

- **Unified Log Interface**: Orchestrates the display of multiple log categories in a tabbed format.
- **Evaluation Surface**: Provides the "Debug Console" input for evaluating expressions via DAP.
- **Protocol Inspection**: Visualizes raw DAP traffic for diagnostic purposes.
- **High-Performance Rendering**: Uses virtual scrolling to handle thousands of log entries without UI lag.

## 2. Component Hierarchy

- **`LogViewerComponent` (Orchestrator)**: Manages the `mat-tab-group` and visibility of sub-consoles.
  - **`DebugConsoleComponent`**: Displays system logs and the evaluation input.
  - **`OutputConsoleComponent`**: Displays the program's `stdout` and `stderr`.
  - **`ProtocolConsoleComponent`**: Displays raw DAP traffic (Requests, Responses, Events).

## 3. Console Types

| Console | Category | Features |
| :--- | :--- | :--- |
| **Debug Console** | `system`, `console` | Evaluate input with auto-timeout and cancellation. |
| **Output** | `stdout`, `stderr` | Auto-scrolling, distinct color coding for stderr (Red). |
| **DAP Protocol** | `dap` | Color-coded markers (Blue/Green/Purple), JSON expansion tree. |

## 4. Performance & Rendering

- **Virtual Scrolling**: All consoles use `cdk-virtual-scroll-viewport`.
- **Dynamic Height**: The Protocol Console implements an "Auto-size" strategy to handle variable-height JSON payloads.
- **Memory Management**: Old logs are automatically evicted when the total memory exceeds **1 MB** (managed by `DapLogService`).

## 5. Visual Design (Flush IDE)

- **Surface Fusion**: The console area blends into the main application background with 1px borders.
- **Tab Headers**: Fixed 32px height following the standard panel title typography.
- **Input Field**: Pinned to the bottom of the "Debug Console" tab with a flush design.

---

## 6. Logic Isolation

- **`DapLogService`**: Acts as the SSOT for all log streams. Consoles subscribe directly to their relevant categories.
- **`onTraffic$` Integration**: Raw protocol traffic is bridged from `DapSessionService` to the `dap` category in `DapLogService` to isolate diagnostic data from business events.
