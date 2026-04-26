---
title: System Specification v1.0
scope: requirements, ui-layout, dap-scope, deployment, error-handling
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer, "Human Engineer"]
last_updated: 2026-03-29
related:
  - docs/architecture.md
  - docs/work-items.md
  - docs/test-plan.md
---

# DAP Debugger Frontend — System Specification (v1.0)

> [!IMPORTANT]
> - **Document Type**: Service/Architecture Doc
> - **Mandatory Sections Included**: Overview, Layer Responsibilities, API Contract, Constraints
> - **Exclusion Boundaries**:
>   - Do not include DAP Server implementation or backend logic.
>   - Do not document non-C/C++ language-specific DAP extensions.

## 1. Project Overview

This project provides a cross-platform debugger frontend interface based on Angular, supporting Electron desktop and Web debugging deployment modes. Core features include code editing, breakpoint configuration, variable inspection, and step execution via the Debug Adapter Protocol (DAP).

## 2. Tech Stack

```yaml
tech_stack:
  angular: ">=21"              # Constraint: Standalone Components only
  styling: "Angular Material"  # Constraint: TailwindCSS strictly excluded
  monaco_editor: "ngx-monaco-editor-v2"
  desktop_app: "Electron"      # contextBridge / IPC
  protocol: "DAP"              # transmitted via WebSocket/IPC
  routing: "Angular Router"    # Shared DI Services
```

## 3. View Navigation & Layout Specification

The system uses a Dual-View navigation architecture:

### 3.1 Initialization Setup View (`/setup`)

This view serves as the default landing page after system startup, dedicated to collecting environment parameters required to start the debugging session. To handle the unique capabilities of Web and Desktop modes, the `/setup` route uses an `ElectronRedirectGuard` to dynamically route users to the appropriate endpoint:

- **/setup-web**: Used in pure Web environments. Always uses WebSocket transport. Requires the user to enter the DAP Server Address (e.g., `localhost:4711`).
- **/setup-electron**: Used in Electron environments. Always uses internal IPC transport, hiding the Server Address field. Supports native OS file pickers for selecting paths.

- **Configuration Form**: Encapsulated in a `<mat-card>` form block, allowing users to input the following key parameters:
  - **DAP Server Connection Address**: The DAP Server's connection port or address (e.g., `localhost:4711`). Currently only supports C/C++ language debug adapters.
  - **Launch Mode**: Two mode options — **Launch** (start a new process) and **Attach** (attach to an existing process).
  - **Executable File Path**: The absolute or relative path to the target debug binary. In Web mode, this path points to the file system on the machine running the DAP Server.
  - **Source File Path**: The corresponding project source directory or main file path. In Web mode, this also points to the remote file system path.
  - **Program Arguments**: Optional, startup arguments passed to the target program.
- **Connection Trigger**: A primary button that displays text corresponding to the selected launch mode (Launch / Attach). When triggered, the system writes the parameters to the global configuration service and navigates to the core debug view via Angular Router.

### 3.2 Core Debugger View (`/debug`)

This view follows a three-panel IDE architecture using `<mat-sidenav-container>`.

#### 3.2.1 Top Toolbar

This section uses `<mat-toolbar>` as the system's global control hub.

- **Brand Area**: Dynamically displays the application name or the currently loaded project name.
- **Debug Control Module**: Uses `mat-button-toggle-group` to integrate core debug command operations:
  - **Run / Continue**: A multi-purpose "Play" button icon (`play_arrow`).
    - In `idle` or `terminated` state, it acts as **Run** (triggers `startSession()`).
    - In `stopped` state, it acts as **Continue** (triggers `continue()`).
  - **Stop**: Terminates the session. Performs hierarchical fallback: `terminate` request → `disconnect` request with termination flag.
  - **Restart**: Restarts the active session. Uses native `restart` if supported, otherwise performs a "soft restart" (stop → disconnect → startSession). **Restriction**: Button is disabled in `idle` and `terminated` states.
  - **Stepping**: Core operations (Step Over, Step Into, Step Out) are enabled only in `stopped` state.

#### 3.2.2 Left Sidenav

This section uses `<mat-sidenav>` (set `position="start"`) for project resource and file management.

- **Component Display**: Uses `mat-nav-list` to display the project folder and file hierarchy. The DAP Session sends a `loadedSources` request to obtain the list of source files loaded by the DAP Server and constructs the file tree; file content is retrieved on-demand via the `source` request. The file tree data service lifecycle is created and destroyed alongside the debug session to ensure file data always corresponds to the current debug target.
- **Display Mode**: Defaults to `side` mode, allowing users to expand or collapse the panel.

#### 3.2.3 Main Content Area

This area is encapsulated within `<mat-sidenav-content>` and serves as the primary interaction space for code inspection and debugging.

- **Editor Body (`app-editor`)**:
  - **Height Constraint**: The editor area should adaptively fill the remaining available space.
  - **Editor Features**: Enables Monaco Editor's Glyph Margin for breakpoint setting, and integrates `deltaDecorations` for current execution line highlighting.

#### 3.2.4 Right Sidenav

A second `<mat-sidenav>` (set `position="end"`) dedicated to visualizing runtime data during debugging.

- **Variable Inspector**: Uses `mat-tree` to display nested variable objects, with CDK Virtual Scroll integration for large data volumes.
- **Call Stack**: Uses `mat-list` or `mat-table` to display the current thread's call context.

#### 3.2.5 Status Bar & Console

Deployed at the bottom of the layout, responsible for feedback on system runtime status and communication logs. This section is encapsulated in the standalone `<app-log-viewer>` component (`LogViewerComponent`).

- **Connection Status Indicator**: Dynamically bound to the `connectionStatus$` stream from `DapSessionService`, using green/gray/red indicators to represent connected, disconnected, or error states, shown in the `DebuggerComponent` footer.
- **Debug Console (`app-log-viewer`)**: The `LogViewerComponent` manages all console rendering independently. It subscribes directly to `DapLogService` (SSOT) without receiving any `@Input()` from the parent `DebuggerComponent`.
  - Uses `mat-tab-group` with two tabs: **Console** (DAP protocol events, system messages) and **Program Console** (debuggee stdout/stderr).
  - Uses `cdk-virtual-scroll-viewport` for virtualized rendering of large log volumes.
  - Includes a command input field at the bottom of the Console tab for sending `evaluate` DAP requests.
  - Supports auto-scroll to the latest log entry on new output.

#### 3.2.6 Log Entry Structured Payload Inspection

Certain log entries (e.g., DAP events logged with category `dap`) may carry a structured data payload alongside the text message. The UI must support interactive inspection of this payload directly within the console panel.

- **Expandable Disclosure**: When a log entry carries a structured payload, an expand/collapse toggle button is displayed inline after the message text.
- **Payload Rendering**: On expand, the raw payload is rendered below the log entry's header row in a scrollable, monospaced code block (using `json` pipe formatting).
- **Height Constraint**: The expanded payload block must be capped at `200px` with an internal vertical scrollbar, preventing the payload from disrupting the virtual scroll viewport's row-height calculation.
- **UI State Isolation**: The expanded/collapsed state of each log entry is managed exclusively by the `LogViewerComponent`'s local state (a `Set<string>` keyed by timestamp), never stored in the `LogEntry` data model or any shared service.

## 4. Layer Responsibilities & Communication Architecture

The system provides two communication paths abstracted through `DapTransportService`.

### 4.1 Electron Desktop Mode

Applicable to desktop applications packaged with Electron. Communication path:

1. **UI Layer (Angular)**: Captures and sends user operation commands.
2. **IPC Layer (Electron)**: The Angular application calls Inter-Process Communication (IPC) methods via `contextBridge`.
3. **WebSocket Relay Layer**: The Electron main process translates IPC commands into standard DAP messages and forwards them to the DAP Server via a **WebSocket connection** (e.g., to a local WebSocket relay running on `ws://localhost:8080`). This relay is responsible for bridging WebSocket traffic to the underlying DAP process.
4. **DAP Layer**: The DAP Server receives the WebSocket-relayed DAP messages, performs debug operations, and streams results back through the relay to the frontend.

### 4.2 Web Browser Mode

Applicable to pure web debugging applications. Communication path:

1. **UI Layer (Angular)**: Shares the same Angular components and services as desktop mode.
2. **WebSocket Communication Layer**: The Angular application connects to the remote DAP Server or relay proxy server via WebSocket, directly transmitting DAP protocol messages.
3. **DAP Layer**: The DAP Server receives WebSocket messages, performs debug operations, and streams results back to the frontend in real-time.

#### 4.2.1 WebSocket Transport Layer Specifications & Safety Requirements

Due to the nature of WebSocket data streams, the frontend buffer implementation must comply with the following specifications to ensure correctness and robustness:

- **Strict Header Validation**: Incoming DAP data streams must be strictly led by a `Content-Length: <length>\r\n\r\n` header. The system must not attempt to parse the data stream without this valid header (e.g., blindly searching for `{}` braces to parse JSON is prohibited), and the first character must be `'C'`.
- **Error Isolation & Fail-Fast Mechanism**: If the WebSocket transport layer detects any packet format anomaly (including: unsupported binary types, missing header fields, or failure to find a valid header terminator within 1KB), the system must **permanently terminate the current message bus** (the Message Subject is errored). This means: as soon as one packet is corrupted, the entire WebSocket message reception mechanism actively enters a failed state, no longer accepting subsequent packets of uncertain state, preventing the system from reading misaligned streams that could cause unpredictable errors in the user interface. Users must re-establish the connection (`connect()`) to resume debugging operations.

## 5. API Contract (DAP Protocol Support Scope)

This system implements the following DAP requests and events. Currently supports C/C++ adapters.

### 5.1 Supported DAP Requests

| Request Type | Description |
| --- | --- |
| `initialize` | Initialize the DAP session, exchange frontend/backend Capabilities |
| `launch` | Launch the target program for debugging |
| `attach` | Attach to an already running process |
| `setBreakpoints` | Set or update breakpoints for a specified file |
| `configurationDone` | Notify the DAP Server that frontend configuration is complete, execution may begin |
| `continue` | Continue program execution |
| `next` | Step Over |
| `stepIn` | Step Into a function |
| `stepOut` | Step Out of a function |
| `pause` | Pause the running program |
| `stackTrace` | Get the current thread's call stack |
| `scopes` | Get the variable scopes for a specified stack frame |
| `variables` | Get the variable list and values within a specified scope |
| `threads` | Get all thread information |
| `loadedSources` | Get the list of all source files loaded by the DAP Server, used to build the project file tree |
| `source` | Get the source code content for a specified path or reference |
| `disconnect` | Terminate the debug session and disconnect |

### 5.2 Supported DAP Events

| Event Type | Description |
| --- | --- |
| `initialized` | DAP Server initialization complete, frontend may send configuration requests |
| `stopped` | Program paused at a breakpoint, exception, or user action |
| `continued` | Program resumed execution |
| `terminated` | Debug target program has terminated |
| `exited` | Debug target program has exited, includes exit code |
| `output` | DAP Server output message (console, stdout, etc.) |
| `breakpoint` | Breakpoint status change notification |

## 6. Deployment Modes

The system supports two deployment modes sharing the core Angular codebase.

### 6.1 Electron Desktop Mode

- **Use case**: Desktop standalone environments or scenarios interfacing directly with local DAP processes.
- **File access**: Unified through the DAP communication channel (`loadedSources` and `source` requests) to retrieve project or source code data from the DAP Server.
- **DAP Server lifecycle**: User-managed; Electron only connects to an already-running DAP Server.
- **Limitation**: Requires desktop application installation.

### 6.2 Web Browser Mode

- **Use case**: Remote debugging, cloud development environments, or scenarios where desktop application installation is not possible.
- **File access**: Unified through the DAP communication channel (`loadedSources` and `source` requests) to retrieve project or source code data from the remote DAP Server.
- **DAP Server lifecycle**: Managed by backend services or the user; the frontend only connects to an already-running DAP Server.
- **Limitation**: Subject to browser security policies, cannot directly access the local file system or launch local processes.

### 6.3 Mode Comparison Table

| Capability | Electron Desktop Mode | Web Browser Mode |
| --- | --- | --- |
| Source file access | ✅ DAP (`loadedSources` / `source`) | ✅ DAP (`loadedSources` / `source`) |
| DAP Server startup | ❌ Must be pre-started | ❌ Must be pre-started |
| Communication channel | IPC (`contextBridge`) | WebSocket |
| Installation requirement | Desktop app required | Browser only |
| Remote debugging | ✅ Supported | ✅ Supported |

## 7. Error Handling & User Feedback

### 7.1 Connection Error Handling

- **Connection Timeout**: If unable to connect to the DAP Server within the configured time limit, the system should display an error dialog with a retry option.
- **Connection Lost**: When the connection drops unexpectedly during debugging, the system should immediately update the status indicator to disconnected state and output the disconnection reason to the console.
- **Reconnection**: Provide a manual reconnect button, allowing users to re-establish the connection after resolving the issue.

### 7.2 DAP Server Error Handling

- **Unexpected Process Termination**: If the DAP Server terminates unexpectedly, the system should capture the event and notify users via a notification component (e.g., `MatSnackBar`).
- **Invalid Response**: When receiving a response that doesn't conform to the DAP protocol, the system should log the raw message to the console log and ignore the invalid message.

### 7.3 User Configuration Validation

- **Form Validation**: The setup view form fields should validate input format in real-time (e.g., connection address format, required field checks) and display inline error messages when validation fails.
- **Pre-launch Check**: Before clicking the Launch/Attach button, the system should verify that all required parameters are filled in and correctly formatted; otherwise, block the operation and indicate missing items.

## 8. Source Content Caching Mechanism

### 8.1 Storage Strategy (Memory-First)

Source content is cached exclusively in application memory (RAM), avoiding the storage limitations of `localStorage`. Since source code is session-dependent, cross-session persistence is not required.

### 8.2 Cache Management (LRU)

The system uses a **Least Recently Used (LRU)** eviction policy to maintain a balanced memory footprint:

- **Capacity Limit**: The cache is capped at **20MB** (estimated by string length).
- **Eviction Logic**: When the limit is reached, the least recently accessed file content is removed to make room for new entries.
- **Keying**: Cache keys are derived from the DAP source path or the `sourceReference` to handle both physical and virtual files.

### 8.3 Lifecycle & Consistency

- **Session-Bound**: The cache is automatically invalidated and cleared whenever a DAP session is initialized or disconnected.
- **Immutability Assumption**: The system assumes source files do not change on disk during an active debugging session, as GDB/LLDB typically do not provide file-watch events via DAP.

## 9. Constraints

- **Cache Storage Restrictions**: `localStorage` is prohibited for source code content storage to avoid size limits and cross-session data staleness. Use memory-first LRU caching only.
- **WebSocket Resilience**: The transport layer must fail-fast and terminate on any packet format anomaly. Blind JSON parsing without header validation is prohibited.
- **UI Rendering Limits**: Log entry structured payload rendering must not exceed `200px` in height to prevent breaking virtual scrolling layouts.
- **Natural Termination Handling**: The transport layer must exempt the `terminated` state from triggering an "unexpected disconnect" error. This ensures a clean UI transition when the DAP server closes the connection after a debuggee finishes execution.
