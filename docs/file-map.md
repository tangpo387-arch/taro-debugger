---
title: Source File Responsibility Map
scope: file-map, navigation, ownership, layers
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-04
related:
  - docs/architecture.md
  - .agents/project-context.md
---

# Source File Responsibility Map

This is the **quick-reference cheat sheet** for locating which file to read or modify for a given feature area. All source files are under `src/app/`.

## Application Bootstrap & Routing

| File | Responsibility | Key Exports |
| --- | --- | --- |
| `app.ts` | Root application component | `AppComponent` |
| `app.config.ts` | Application-level providers | `appConfig` |
| `app.routes.ts` | Route definitions (`/setup` → `/debug`) | `routes` |

## UI Layer (Components)

| File | Responsibility | Key Interfaces | Related Template/Style |
| --- | --- | --- | --- |
| `setup.component.ts` | Configuration form, DAP connection setup, navigation to `/debug` | `onConnect()`, `form: FormGroup` | `setup.component.html`, `setup.component.scss` |
| `debugger.component.ts` | Main debug view: toolbar, three-panel layout, event subscriptions, file source loading | subscribes `executionState$`, `connectionStatus$`, `onEvent()`; handles `onFileSelected()` | `debugger.component.html`, `debugger.component.scss` |
| `file-explorer.component.ts` | Left sidenav file explorer: fetches `loadedSources` tree, highlights active file, emits `fileSelected` | `@Input() activeFilePath`, `@Input() reloadTrigger`, `@Output() fileSelected` | `file-explorer.component.html`, `file-explorer.component.scss` |
| `editor.component.ts` | Monaco Editor wrapper: source display, line highlight, breakpoint glyph margin | `openFile()`, `highlightLine()`, `clearHighlight()` | `editor.component.html`, `editor.component.scss` |
| `log-viewer.component.ts` | Bottom panel log viewer: console/program streams, auto-scroll, expression evaluation | subscribes `consoleLogs$`, `programLogs$`; `evaluateCommand()` | `log-viewer.component.html`, `log-viewer.component.scss` |
| `variables.component.ts` | Right sidebar variables view: tree display for DAP scopes and local variables | subscribes `scopes$`; `toggleNode()` | `variables.component.html`, `variables.component.scss` |
| `error-dialog/error-dialog.ts` | Dialog for showing connection and session errors | `ErrorDialogData`, `onRetry()`, `onGoBack()` | `error-dialog.html`, `error-dialog.css` |

## Electron Desktop Structural Files

| File | Responsibility |
| --- | --- |
| `electron/main.ts` | Electron main process: window management, environment-aware loading, security config |
| `electron/preload.ts` | Electron preload script: secure IPC exposure via `contextBridge` |
| `tsconfig.electron.json` | TypeScript configuration for the Electron main/preload processes |

## Session Layer (Services)

| File | Responsibility | Key Interfaces |
| --- | --- | --- |
| `dap-session.service.ts` | DAP session lifecycle, state machine, request/response pairing, event processing | `startSession()`, `disconnect()`, `reset()`, `executionState$`, `connectionStatus$`, `onEvent()`, `sendRequest()` |
| `dap-config.service.ts` | Configuration persistence (localStorage), SSOT for DAP connection parameters | `setConfig()`, `getConfig()` |
| `dap-file-tree.service.ts` | File tree construction from `loadedSources`, source file reading via `source` request | `getTree()`, `readFile()` |
| `dap-variables.service.ts` | Derived state management for DAP scopes and variables, caching variable references | `fetchScopes()`, `getVariables()`, `scopes$` |

## Transport Layer (Services)

| File | Responsibility | Key Interfaces |
| --- | --- | --- |
| `dap-transport.service.ts` | Abstract base class defining the transport layer contract | `connect()`, `disconnect()`, `sendRequest()`, `onMessage()`, `onEvent()`, `connectionStatus$` |
| `websocket-transport.service.ts` | WebSocket implementation with Content-Length header parsing and binary buffer management | Implements all `DapTransportService` abstract methods |
| `transport-factory.service.ts` | Factory service creating Transport instances based on `TransportType` | `createTransport(type, address)` |

## Shared / Cross-Cutting

| File | Responsibility | Key Exports |
| --- | --- | --- |
| `dap.types.ts` | DAP protocol type definitions | `DapRequest`, `DapResponse`, `DapEvent`, `DapMessage`, `ExecutionState` |
| `file-tree.service.ts` | Abstract file tree interface (implemented by `DapFileTreeService`) | `FileTreeService`, `FileNode` |
| `dap-log.service.ts` | Dual console log stream management. Written to by `DebuggerComponent`; consumed by `LogViewerComponent`. Classified as Shared: no Session-layer service injects it after this refactor. | `consoleLogs$`, `programLogs$`, `consoleLog()`, `appendProgramLog()`, `clear()` |

## Layer Dependency Rules

```text
UI Layer (Components)
  │  Can inject: Session Layer services
  │  Cannot inject: Transport Layer services
  ▼
Session Layer (Services)
  │  Can inject: Transport Layer services (via factory)
  │  Cannot inject: UI components, MatSnackBar, Router
  ▼
Transport Layer (Services)
  │  No Angular DI dependencies on upper layers
  ▼
Shared (Types & Interfaces)
     Used by all layers
```
