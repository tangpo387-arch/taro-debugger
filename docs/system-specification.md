---
title: System Specification v1.0
scope: requirements, ui-layout, dap-scope, deployment, error-handling
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-03-29
related:
  - docs/architecture.md
  - docs/work-items.md
  - docs/test-plan.md
---

# DAP Debugger Frontend — System Specification (v1.0)

## 1. Project Overview

The core purpose of this project is to build a general-purpose debugger frontend interface (DAP Frontend) based on the Angular framework, supporting both Electron desktop application and Web debugging application deployment modes. The design goal is to provide developers with a highly professional, VS Code-like Integrated Development Environment (IDE) experience. The system will fully support core debugging features including code editing, breakpoint configuration, variable inspection, and step execution, and can interface with any server implementation that follows the Debug Adapter Protocol (DAP).

## 2. Tech Stack

* **Core Framework**: Angular 21 or later, fully adopting the Standalone Components architecture for improved modularity and rendering performance.
* **Desktop Application Framework**: Electron as the underlying framework, responsible for bridging OS-level resources and DAP server communication in desktop mode.
* **Web Communication Layer**: In web browser mode, WebSocket serves as the communication channel with the DAP Server, without requiring Electron support.
* **UI Component Library**: Angular Material, for building modern and responsive user interface components.
* **Editor Core**: Monaco Editor (via the `ngx-monaco-editor-v2` module), providing syntax highlighting and advanced code editing capabilities.
* **State & Routing**: Angular Router for multi-view navigation, with Dependency Injection (DI) services for sharing debug initialization parameters across views.

## 3. View Navigation & Layout Specification

The system adopts a Dual-View navigation architecture to ensure that debugging environment initialization parameters are properly configured before entering the core workspace. The view structure is as follows:

### 3.1 Initialization Setup View (`/setup`)

This view serves as the default landing page after system startup, dedicated to collecting environment parameters required to start the debugging session.

* **Configuration Form**: Encapsulated in a `<mat-card>` form block, allowing users to input the following key parameters:
  * **DAP Server Connection Address**: The DAP Server's connection port or address (e.g., `localhost:4711`). Currently only supports C/C++ language debug adapters.
  * **Launch Mode**: Two mode options — **Launch** (start a new process) and **Attach** (attach to an existing process).
  * **Executable File Path**: The absolute or relative path to the target debug binary. In Web mode, this path points to the file system on the machine running the DAP Server.
  * **Source File Path**: The corresponding project source directory or main file path. In Web mode, this also points to the remote file system path.
  * **Program Arguments**: Optional, startup arguments passed to the target program.
* **Connection Trigger**: A primary button that displays text corresponding to the selected launch mode (Launch / Attach). When triggered, the system writes the parameters to the global configuration service and navigates to the core debug view via Angular Router.

### 3.2 Core Debugger View (`/debug`)

This view's layout follows the standard three-panel IDE architecture. To ensure smooth interaction and coordination between interface sections, the underlying layout container uses `<mat-sidenav-container>` uniformly.

#### 3.2.1 Top Toolbar

This section uses `<mat-toolbar>` as the system's global control hub.

* **Brand Area**: Dynamically displays the application name or the currently loaded project name.
* **Debug Control Module**: Uses `mat-button-toggle-group` to integrate core debug command operations (Continue, Step Over, Step Into, Step Out, Pause, Stop).

#### 3.2.2 Left Sidenav

This section uses `<mat-sidenav>` (set `position="start"`) for project resource and file management.

* **Component Display**: Uses `mat-nav-list` to display the project folder and file hierarchy. The DAP Session sends a `loadedSources` request to obtain the list of source files loaded by the DAP Server and constructs the file tree; file content is retrieved on-demand via the `source` request. The file tree data service lifecycle is created and destroyed alongside the debug session to ensure file data always corresponds to the current debug target.
* **Display Mode**: Defaults to `side` mode, allowing users to freely expand or collapse the panel.

#### 3.2.3 Main Content Area

This area is encapsulated within `<mat-sidenav-content>` and serves as the primary interaction space for code inspection and debugging.

* **Editor Body (`app-editor`)**:
  * **Height Constraint**: The editor area should adaptively fill the remaining available space.
  * **Advanced Interaction**: Enables Monaco Editor's Glyph Margin for breakpoint setting, and integrates `deltaDecorations` for current execution line highlighting.

#### 3.2.4 Right Sidenav

A second `<mat-sidenav>` (set `position="end"`) dedicated to visualizing runtime data during debugging.

* **Variable Inspector**: Uses `mat-tree` to display nested variable objects, with CDK Virtual Scroll integration for large data volumes.
* **Call Stack**: Uses `mat-list` or `mat-table` to display the current thread's call context.

#### 3.2.5 Status Bar & Console

Deployed at the bottom of the layout, responsible for feedback on system runtime status and communication logs. This section is encapsulated in the standalone `<app-log-viewer>` component (`LogViewerComponent`).

* **Connection Status Indicator**: Dynamically bound to the `connectionStatus$` stream from `DapSessionService`, using green/gray/red indicators to represent connected, disconnected, or error states, shown in the `DebuggerComponent` footer.
* **Debug Console (`app-log-viewer`)**: The `LogViewerComponent` manages all console rendering independently. It subscribes directly to `DapLogService` (SSOT) without receiving any `@Input()` from the parent `DebuggerComponent`.
  * Uses `mat-tab-group` with two tabs: **Console** (DAP protocol events, system messages) and **Program Console** (debuggee stdout/stderr).
  * Uses `cdk-virtual-scroll-viewport` for performant rendering of large log volumes.
  * Includes a command input field at the bottom of the Console tab for sending `evaluate` DAP requests.
  * Supports auto-scroll to the latest log entry on new output.

#### 3.2.6 Log Entry Structured Payload Inspection

Certain log entries (e.g., DAP events logged with category `dap`) may carry a structured data payload alongside the text message. The UI must support interactive inspection of this payload directly within the console panel.

* **Expandable Disclosure**: When a log entry carries a structured payload, an expand/collapse toggle button is displayed inline after the message text.
* **Payload Rendering**: On expand, the raw payload is rendered below the log entry's header row in a scrollable, monospaced code block (using `json` pipe formatting).
* **Height Constraint**: The expanded payload block must be capped at `200px` with an internal vertical scrollbar, preventing the payload from disrupting the virtual scroll viewport's row-height calculation.
* **UI State Isolation**: The expanded/collapsed state of each log entry is managed exclusively by the `LogViewerComponent`'s local state (a `Set<string>` keyed by timestamp), never stored in the `LogEntry` data model or any shared service.

## 4. Communication Architecture

To ensure effective interaction and data synchronization between the frontend interface and the underlying Debug Adapter, the system provides two communication paths depending on the deployment mode. The frontend application layer encapsulates underlying differences through a unified abstract service interface (`DapTransportService`), so upper-layer components don't need to be aware of the current runtime mode.

### 4.1 Electron Desktop Mode

Applicable to desktop applications packaged with Electron. Communication path:

1. **UI Layer (Angular)**: Captures and sends user operation commands.
2. **IPC Layer (Electron)**: The Angular application calls Inter-Process Communication (IPC) methods via `contextBridge`.
3. **DAP Layer**: The Electron main process translates IPC commands into standard DAP messages, communicates with the language-specific DAP Server, and returns results to the frontend.

### 4.2 Web Browser Mode

Applicable to pure web debugging applications. Communication path:

1. **UI Layer (Angular)**: Shares the same Angular components and services as desktop mode.
2. **WebSocket Communication Layer**: The Angular application connects to the remote DAP Server or relay proxy server via WebSocket, directly transmitting DAP protocol messages.
3. **DAP Layer**: The DAP Server receives WebSocket messages, performs debug operations, and streams results back to the frontend in real-time.

#### 4.2.1 WebSocket Transport Layer Specifications & Safety Requirements

Due to the nature of WebSocket data streams, the frontend buffer implementation must comply with the following strict specifications to ensure correctness and robustness:
* **Strict Header Validation**: Incoming DAP data streams must be strictly led by a `Content-Length: <length>\r\n\r\n` header. The system must not attempt to parse the data stream without this valid header (e.g., blindly searching for `{}` braces to parse JSON is prohibited), and the first character must be `'C'`.
* **Error Isolation & Fail-Fast Mechanism**: If the WebSocket transport layer detects any packet format anomaly (including: unsupported binary types, missing header fields, or failure to find a valid header terminator within 1KB), the system must **permanently terminate the current message bus** (the Message Subject is errored). This means: as soon as one packet is corrupted, the entire WebSocket message reception mechanism actively enters a failed state, no longer accepting subsequent packets of uncertain state, preventing the system from reading misaligned streams that could cause unpredictable errors in the user interface. Users must re-establish the connection (`connect()`) to resume debugging operations.

## 5. DAP Protocol Support Scope

This system implements the following core requests and events based on the Debug Adapter Protocol specification. Currently only supports C/C++ language debug adapters; future expansion to other languages is possible.

### 5.1 Supported DAP Requests

| Request Type | Description |
|---|---|
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
|---|---|
| `initialized` | DAP Server initialization complete, frontend may send configuration requests |
| `stopped` | Program paused at a breakpoint, exception, or user action |
| `continued` | Program resumed execution |
| `terminated` | Debug target program has terminated |
| `exited` | Debug target program has exited, includes exit code |
| `output` | DAP Server output message (console, stdout, etc.) |
| `breakpoint` | Breakpoint status change notification |

## 6. Deployment Modes

The system supports two deployment modes, sharing the same Angular frontend codebase, with differences only in the communication layer and system access layer.

### 6.1 Electron Desktop Mode

* **Use case**: Desktop standalone environments or scenarios interfacing directly with local DAP processes.
* **File access**: Unified through the DAP communication channel (`loadedSources` and `source` requests) to retrieve project or source code data from the DAP Server.
* **DAP Server lifecycle**: User-managed; Electron only connects to an already-running DAP Server.
* **Limitation**: Requires desktop application installation.

### 6.2 Web Browser Mode

* **Use case**: Remote debugging, cloud development environments, or scenarios where desktop application installation is not possible.
* **File access**: Unified through the DAP communication channel (`loadedSources` and `source` requests) to retrieve project or source code data from the remote DAP Server.
* **DAP Server lifecycle**: Managed by backend services or the user; the frontend only connects to an already-running DAP Server.
* **Limitation**: Subject to browser security policies, cannot directly access the local file system or launch local processes.

### 6.3 Mode Comparison Table

| Capability | Electron Desktop Mode | Web Browser Mode |
|---|---|---|
| Source file access | ✅ DAP (`loadedSources` / `source`) | ✅ DAP (`loadedSources` / `source`) |
| DAP Server startup | ❌ Must be pre-started | ❌ Must be pre-started |
| Communication channel | IPC (`contextBridge`) | WebSocket |
| Installation requirement | Desktop app required | Browser only |
| Remote debugging | ✅ Supported | ✅ Supported |

## 7. Error Handling & User Feedback

To ensure the system provides clear user feedback under abnormal conditions, the following error handling strategies are defined:

### 7.1 Connection Error Handling

* **Connection Timeout**: If unable to connect to the DAP Server within the configured time limit, the system should display an error dialog with a retry option.
* **Connection Lost**: When the connection drops unexpectedly during debugging, the system should immediately update the status indicator to disconnected state and output the disconnection reason to the console.
* **Reconnection**: Provide a manual reconnect button, allowing users to re-establish the connection after resolving the issue.

### 7.2 DAP Server Error Handling

* **Unexpected Process Termination**: If the DAP Server terminates unexpectedly, the system should capture the event and notify users via a notification component (e.g., `MatSnackBar`).
* **Invalid Response**: When receiving a response that doesn't conform to the DAP protocol, the system should log the raw message to the console log and ignore the invalid message.

### 7.3 User Configuration Validation

* **Form Validation**: The setup view form fields should validate input format in real-time (e.g., connection address format, required field checks) and display inline error messages when validation fails.
* **Pre-launch Check**: Before clicking the Launch/Attach button, the system should verify that all required parameters are filled in and correctly formatted; otherwise, block the operation and indicate missing items.