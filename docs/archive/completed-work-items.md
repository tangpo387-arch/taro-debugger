---
title: Changelog Archive
scope: history, completed-phases, archived-tasks
audience: [Product_Architect, Lead_Engineer]
last_updated: 2026-03-29
related:
  - docs/work-items.md
---

# Changelog Archive

This document records the Phases and Work Items that have been successfully completed and delivered in the DAP Debugger Frontend project.
These items were moved out of the main work list (`work-items.md`) to keep the development list clean and focused.

---

## Phase 1: Setup View

### WI-01: Extend `GdbConfigService` Configuration Model

- **Size**: S
- **Description**: Extend the config object into a complete DAP connection configuration interface
- **Details**:
  - Define `DapConfig` interface (`serverAddress`, `launchMode: 'launch' | 'attach'`, `executablePath`, `sourcePath`, `programArgs`)
  - Update `GdbConfigService`'s `setConfig()` / `getConfig()` methods
  - Rename service to `DapConfigService` (aligning with the generic DAP concept in the spec)
- **Status**: ✅ Done

### WI-02: Setup Form Field Completion

- **Size**: M
- **Description**: Complete all Setup form fields per spec [§3.1](system-specification.md#31-initialization-setup-view-setup)
- **Details**:
  - Add **DAP Server Connection Address** field (e.g., `localhost:4711`)
  - Add **Launch Mode** selector (`mat-button-toggle` or `mat-radio`: Launch / Attach)
  - Add **Program Arguments** field (optional)
  - Button text dynamically switches based on Launch Mode ("Launch" / "Attach")
- **Dependencies**: WI-01
- **Status**: ✅ Done

### WI-03: Setup Form Validation

- **Size**: S
- **Description**: Implement real-time form validation per spec [§7.3](system-specification.md#73-user-configuration-validation)
- **Details**:
  - Switch to Reactive Forms (`FormGroup` + `Validators`)
  - Connection address format validation (`host:port`)
  - Required field validation + inline error messages
  - Launch/Attach button disabled when validation fails
- **Dependencies**: WI-02
- **Status**: ✅ Done

---

## Phase 2: DAP Transport Layer

### WI-04: Create `DapTransportService` Abstract Interface

- **Size**: S
- **Description**: Define a unified communication abstraction layer per spec [§4](system-specification.md#4-communication-architecture)
- **Details**:
  - Define abstract class / interface `DapTransportService`
  - Methods: `connect()`, `disconnect()`, `sendRequest()`, `onEvent()` (Observable)
  - Define DAP Message base types (`DapRequest`, `DapResponse`, `DapEvent`)
- **Status**: ✅ Done

### WI-05: Implement WebSocket Transport Layer (`WebSocketTransportService`)

- **Size**: M
- **Description**: Implement Web mode WebSocket communication per spec [§4.2](system-specification.md#42-web-browser-mode)
- **Details**:
  - Implement `DapTransportService`'s WebSocket version
  - WebSocket connection/disconnection management
  - DAP message serialization/deserialization (Content-Length header + JSON body)
  - Use RxJS Subject to emit received events
- **Dependencies**: WI-04
- **Status**: ✅ Done

### WI-06: DAP Session Management Service (`DapSessionService`)

- **Size**: M
- **Description**: Encapsulate the DAP protocol's request/response lifecycle
- **Details**:
  - `initialize()` → Exchange Capabilities
  - `launch()` / `attach()` → Start debugging based on configuration
  - `configurationDone()` → Notify DAP Server
  - `disconnect()` → Terminate session
  - Manage request sequence ID and pending response mapping
- **Dependencies**: WI-05
- **Status**: ✅ Done

### WI-07: DAP Request Timeout Mechanism

- **Size**: S
- **Description**: Implement timeout mechanism for `DapSessionService` requests, preventing permanent waits when the server is unresponsive
- **Details**:
  - Modify `sendRequest` method, add `setTimeout` wait limit (e.g., 5 seconds)
  - On timeout, clear pending handler and reject `Promise`
- **Dependencies**: WI-06
- **Status**: ✅ Done

### WI-08: Integrate DapSessionService in DebuggerComponent

- **Size**: S
- **Description**: Actually invoke DapSessionService in DebuggerComponent to start and terminate debug sessions
- **Details**:
  - Execute `initializeSession`, `launchOrAttach`, and `configurationDone` in `ngOnInit`
  - Call `disconnect` on `ngOnDestroy` and `goBack` to clear session and connection
  - Subscribe to `onEvent()` to log base events to UI in real-time
  - Use `try/catch` to capture timeout errors and display friendly notifications in UI (e.g., `MatSnackBar` or `dapLogs`)
- **Dependencies**: WI-06, WI-07
- **Status**: ✅ Done

---

## Phase 4: Debug Controls

### WI-10: Debug Control Button Functionality

- **Size**: M
- **Description**: Connect toolbar control buttons to DAP requests
- **Details**:
  - Continue → `continue` request
  - Step Over → `next` request
  - Step Into → `stepIn` request
  - Step Out → `stepOut` request (button was missing from template, added)
  - Pause → `pause` request
  - Stop → `disconnect` request
  - Button state management (Running: only Pause/Stop available; Stopped: Continue/Step available)
- **Dependencies**: WI-07
- **Status**: ✅ Done

### WI-11: DAP Event Handling & State Management

- **Size**: M
- **Description**: Handle DAP Server events and update frontend state
- **Details**:
  - `stopped` event → Update to paused state, trigger stackTrace/scopes/variables queries
  - `continued` event → Update to running state
  - `terminated` / `exited` events → Update to terminated state, notify user
  - `output` event → Write to console log
  - `initialized` event → Trigger `configurationDone`
  - `breakpoint` event → Update breakpoint display status
- **Dependencies**: WI-07
- **Status**: ✅ Done

---

## Phase 5: Editor Features

### WI-12: Monaco Editor Breakpoint Interaction

- **Size**: M
- **Description**: Implement Glyph Margin breakpoint operations per spec [§3.2.3](system-specification.md#323-main-content-area)
- **Details**:
  - Listen for Monaco `onMouseDown` events (glyph margin area clicks)
  - Click on line number → add/remove breakpoint (red dot decoration)
  - Maintain local breakpoint list (`Map<filename, Set<lineNumber>>`)
  - Provide `getBreakpoints()` method for DAP communication use
- **Status**: ✅ Done

### WI-13: Breakpoint DAP Synchronization

- **Size**: S
- **Description**: Synchronize local breakpoint changes to the DAP Server
- **Details**:
  - Send `setBreakpoints` request on any glyph margin toggle (supports multi-file sync)
  - Distinguish **Verified** (red) vs. **Unverified** (gray) breakpoints in Monaco UI
  - Surgical update logic for `breakpoint` events to handle server-side relocation/lazy-verification
  - Automatic **Re-sync** of all breakpoints upon session restart or reconnect
- **Dependencies**: WI-06, WI-12
- **Status**: ✅ Done

### WI-14: Current Line Highlight

- **Size**: S
- **Description**: Implement `deltaDecorations` current execution line marking per spec [§3.2.3](system-specification.md#323-main-content-area)
- **Details**:
  - On `stopped` event, get line number from stackTrace top frame
  - Use `deltaDecorations` to add background highlight on that line
  - Clear highlight on `continued` / `terminated`
  - Auto `revealLineInCenter` to scroll to current line
- **Dependencies**: WI-11
- **Status**: ✅ Done

---

## Phase 6: File Explorer

### WI-15: File Tree Service Abstraction (`FileTreeService`)

- **Size**: S
- **Description**: Define file tree data retrieval abstract interface per spec [§3.2.2](system-specification.md#322-left-sidenav)
- **Details**:
  - Define `FileNode` interface (`name`, `path`, `type: 'file' | 'directory'`, `children?`)
  - Define `FileTreeService` abstract (`getTree(rootPath)`, `readFile(path)`)
  - Web mode: Retrieve remote file tree via backend API / WebSocket
- **Dependencies**: None
- **Status**: ✅ Done

### WI-16: Left Sidenav File Tree UI

- **Size**: M
- **Description**: Replace left sidebar hardcoded content with dynamic file tree
- **Details**:
  - Use `mat-tree` (Flat or Nested) to display file/folder hierarchy
  - Folder expand/collapse functionality
  - Click file → Load source code into Monaco Editor
  - Currently opened file highlighted
- **Dependencies**: WI-15
- **Status**: ✅ Done

---

## Phase 7: Variables & Call Stack

### WI-17: Call Stack Panel

- **Size**: M
- **Description**: Implement call stack display per spec [§3.2.4](system-specification.md#324-right-sidenav)
- **Details**:
  - Send `threads` + `stackTrace` requests on `stopped` event
  - Display stack frames using `mat-list` (function name, filename:line)
  - Click frame → Switch Monaco Editor to corresponding file and line
  - Click frame → Trigger `scopes` + `variables` requests to update variable panel
- **Dependencies**: WI-11
- **Status**: ✅ Done

### WI-18.1: Variables Data State Management
<!-- status: done | size: M | phase: 7 | depends: WI-11, WI-17 -->
- **Size**: M
- **Description**: Manage derived variable state and DAP requests fetching dynamically.
- **Details**:
  - Implement a dedicated `DapVariablesService` to strictly handle derived runtime states.
  - Trigger `scopes` → `variables` requests automatically based on the current execution context and selected stack frame.
  - Provide a reactive `Observable` interface for lazy-loading expansion when a user interacts with nodes containing `variablesReference > 0`.
  - Cache fetched variables reference to avoid redundant DAP `variables` requests.
- **Dependencies**: WI-11, WI-17
- **Files to modify**: `src/app/dap-variables.service.ts`
- **Status**: ✅ Done

### WI-18.2: Variables Tree UI Component
<!-- status: done | size: M | phase: 7 | depends: WI-18.1 -->
- **Size**: M
- **Description**: Implement an independent Angular Standalone Component (`<app-variables>`) to render the nested variable/scope structure.
- **Details**:
  - Built `<app-variables>` standalone component with custom flat-tree virtual scrolling (`cdk-virtual-scroll-viewport` + `*cdkVirtualFor`)
  - Implemented hierarchical-to-flat data model (`VariableNode` → `FlatVariableNode`) for efficient rendering
  - Lazy-loads children on first expand via `DapVariablesService.getVariables()` for nodes with `variablesReference > 0`
  - Auto-expands the first scope (e.g., 'Locals') on load for immediate visibility
  - Displays variable `name`, `type`, and `value` with expand/collapse toggles and loading spinners
  - Integrated into `debugger.component.html` right sidenav, replacing placeholder content
- **Dependencies**: WI-18.1
- **Files modified**: `src/app/variables.component.ts`, `src/app/variables.component.html`, `src/app/variables.component.scss`, `src/app/debugger.component.html`
- **Status**: ✅ Done

---

## Phase 8: Console & Status Bar

### WI-19: Debug Console Functionality

- **Size**: M
- **Description**: Complete bottom console per spec [§3.2.5](system-specification.md#325-status-bar--console)
- **Details**:
  - Receive DAP `output` events, route by category to Debugger Console / Program Console
  - Add command input field, send `evaluate` request
  - Auto-scroll to latest log
  - Log timestamp display
- **Dependencies**: WI-11
- **Status**: ✅ Done

### WI-20: Connection Status Indicator Functionality

- **Size**: S
- **Description**: Make status bar dynamic per spec [§3.2.5](system-specification.md#325-status-bar--console)
- **Details**:
  - Bind `DapTransportService` connection status Observable
  - Green light = connected, gray light = disconnected, red light = connection error
  - Display connection address information
  - Display current debug state (Running / Stopped / Terminated)
- **Dependencies**: WI-05
- **Status**: ✅ Done

---

## Phase 11: Automation Tests

### TI-04: `DapFileTreeService` File Tree Unit Tests

- **Size**: M
- **Description**: Verify `DapFileTreeService` file tree construction and file content reading logic via DAP requests
- **Details**:
  - **getTree - Happy path**: Simulate `loadedSources` returning multiple sources, verify `buildTreeFromSources` correctly builds nested directory/file tree structure
  - **getTree - Path logic**: Verify different path formats (absolute path `/`, Windows path `C:\`) are correctly split and recombined
  - **getTree - Sorting**: Verify directories-first and alphabetical name sorting
  - **getTree - Failure fallback**: Simulate `loadedSources` request failure, verify fallback node is returned
  - **readFile - Happy path**: Simulate `source` request returning content, verify `content` field is correctly extracted
  - **readFile - Failure fallback**: Simulate `source` request failure, verify fallback string is returned
- **Dependencies**: WI-15
- **Status**: ✅ Done

### TI-02: `DapSessionService` Session Management Unit Tests

- **Size**: M
- **Description**: Verify session lifecycle and pairing mechanism
- **Details**:
  - **Sequence ID management**: Verify `seq` increments correctly when sending requests
  - **Promise Mapping**: Verify `sendRequest` Promise correctly resolves or rejects when response is received
  - **Timeout mechanism**: Simulate server non-response, verify `sendRequest` triggers timeout error after configured time
- **Dependencies**: WI-06, WI-07
- **Status**: ✅ Done

### TI-03: `WebSocketTransportService` Transport Layer Unit Tests

- **Size**: M
- **Description**: Verify low-level fail-safe mechanism and data buffering logic
- **Details**:
  - **Header parsing verification**: Ensured packets are correctly split by `Content-Length` and trigger message events
  - **Sticky/half packet handling**: Simulated TCP fragmented packets (split header/body) and verified buffer concatenation assembles complete JSON
  - **Fail-Fast & Error Isolation**: Verified service emits error and terminates Subject on malformed packets (invalid prefix, long header, bad JSON)
  - **Buffer Auto-expansion**: Verified buffer correctly doubles capacity when receiving payloads larger than 4KB
- **Dependencies**: WI-05
- **Status**: ✅ Done

### TI-06: Variables State Management Unit Tests

- **Size**: S
- **Description**: Verify the caching, state clearing, and reactive behavior of the DapVariablesService.
- **Details**:
  - **Scopes Fetching**: Verified that fetching scopes updates the `scopes$` observable correctly with various response scenarios.
  - **Caching Logic**: Verified that `getVariables` utilizes the local cache to prevent redundant DAP requests.
  - **Implicit Clear (R_SM5)**: Verified that cache and scopes are cleared automatically when the execution state transitions out of 'stopped' (e.g., to 'running', 'terminated').
  - **Edge-case Memory Safety**: Verified that stopped-to-stopped transitions do not trigger redundant clears, and that the service clears state on instantiation if starting in a non-stopped state.
- **Dependencies**: WI-18.1
- **Status**: ✅ Done

### TI-01: `DapConfigService` Unit Tests

- **Size**: S
- **Description**: Verify global config access mechanism per [test-plan.md](test-plan.md)
- **Details**:
  - Verify `setConfig()` and `getConfig()` correctly store and return complete `DapConfig` data
- **Status**: ✅ Done

### TI-05: Connection Error & Intent Detection Integration Tests
<!-- status: done | size: M | phase: 11 | depends: WI-21, WI-22 -->
- **Size**: M
- **Description**: Verify error propagation, connection timeout, and user-initiated disconnect interception between Session and Transport
- **Details**:
  - **Normal stop intent interception**: Verify `isDisconnecting` flag correctly suppresses redundant error feedback
  - **Connection timeout auto-catch**: Simulate WebSocket connection timeout, trigger `ErrorDialog`
  - **Disconnect auto-reaction**: Simulate server crash, verify cascading state transition
- **Dependencies**: WI-21, WI-22
- **Status**: ✅ Done — `src/app/connection-error-integration.spec.ts` (12 tests)

---

## Phase 9: Error Handling

### WI-21: Connection Error Handling

- **Size**: M
- **Description**: Implement connection error handling mechanism per spec [§7.1](system-specification.md#71-connection-error-handling)
- **Details**:
  - Connection timeout → `MatDialog` error dialog + retry button
  - Connection lost → Status indicator update + console output of reason
  - When in error state, restart button transforms into reconnect button
  - Disconnect detection optimization → Fix WebSocket `onerror` / `onclose` signal routing to `DapSessionService` data flow lifecycle, ensuring UI automatically reacts to server crashes
- **Dependencies**: WI-05, WI-20
- **Status**: ✅ Done

### WI-22: DAP Server Error Handling

- **Size**: S
- **Description**: Handle DAP Server errors per spec [§7.2](system-specification.md#72-dap-server-error-handling)
- **Details**:
  - Unexpected process termination → Console log
  - Invalid DAP response → Log to console, ignore the message
  - DAP error response → Display error message to user
- **Dependencies**: WI-06
- **Status**: ✅ Done

---

## Phase 10: Electron Desktop Mode

### WI-23: Electron Main Process Architecture

- **Size**: M
- **Description**: Establish Electron main process per spec [§6.1](system-specification.md#61-electron-desktop-mode)
- **Details**:
  - Created `electron/main.ts`: `BrowserWindow` with mandatory security config (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`). Environment-aware loading — dev mode loads `http://localhost:4200`, production loads built `dist/` assets via `loadFile()`. Uses `app.whenReady()` modern async pattern.
  - Created `electron/preload.ts`: Exposes `window.electronAPI` via `contextBridge.exposeInMainWorld`. All three IPC methods (`send`, `on`, `invoke`) use strict channel whitelists and `unknown` typing (no `any`). `on()` has explicit `() => void` return type for safe cleanup.
  - Created `tsconfig.electron.json`: Targeted `CommonJS` / `ES2022` for Node.js; overrides `angularCompilerOptions: {}` to prevent Angular template-checking options from propagating to the Electron build.
  - Added `"main": "dist/electron/main.js"` and `electron:build` / `electron:run` / `electron:dev` / `electron:start` / `electron:package` scripts to `package.json`.
  - Added `electron-builder` configuration for Linux (`AppImage`, `deb`) and Windows (`nsis`) packaging targets.
  - Adopted `HashLocationStrategy` (`withHashLocation()` in `app.config.ts`) to resolve `file://` protocol routing incompatibility, replacing the temporary `<base href="./">` workaround.
- **Files created/modified**:
  - `electron/main.ts` *(new)*
  - `electron/preload.ts` *(new)*
  - `tsconfig.electron.json` *(new)*
  - `src/app/app.config.ts` *(modified — added `withHashLocation()`)*
  - `src/index.html` *(restored `base href="/"` — `HashLocationStrategy` makes workaround unnecessary)*
  - `package.json` *(modified — added `"main"`, Electron scripts, and `electron-builder` config)*
- **Status**: ✅ Done — QA reviewed, all issues resolved

### WI-26: Setup Page Separation
<!-- status: completed | size: S | depends: none -->
- **Size**: S
- **Description**: Separate the Setup page into Web (`/setup-web`) and Electron (`/setup-electron`) versions via route guards.
- **Details**:
  - Implement `EnvironmentDetectService` and `ElectronRedirectGuard`.
  - Create `SetupWebComponent` (uses WebSocket) and `SetupElectronComponent` (uses IPC).
- **Dependencies**: none
- **Status**: ✅ Done

### WI-24: Electron IPC Transport Layer (`IpcTransportService`)
<!-- status: done | size: M | depends: WI-04, WI-23, WI-26 -->
- **Size**: M
- **Description**: Implement IPC communication per spec [§4.1](system-specification.md#41-electron-desktop-mode)
- **Details**:
  - Implement `DapTransportService`'s IPC version (`IpcTransportService`)
  - `preload.ts` exposes `window.electronAPI` via `contextBridge` (native Electron API, no third-party wrapper)
  - Angular renderer side: `IpcTransportService` calls `window.electronAPI` for all DAP message I/O
  - Electron main process side: `ipcMain.handle` receives calls and forwards to the DAP Server via **WebSocket relay** (same relay as Web Browser Mode, WI-09); no direct TCP socket connection
- **Dependencies**: WI-04, WI-23, WI-26
- **Status**: ✅ Done
