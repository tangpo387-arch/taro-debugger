# TaroDAP

A universal debugger frontend built with Angular, supporting both **Electron desktop** and **Web browser** deployment modes. It provides a professional IDE-like debugging experience — comparable to Visual Studio Code — and works with any server that implements the [Debug Adapter Protocol (DAP)](https://microsoft.github.io/debug-adapter-protocol/).

## Features

- 🖥️ **Dual Deployment Modes** — Runs as an Electron desktop app or a pure web application
- 🔌 **DAP Compatible** — Connects to any DAP-compliant debug adapter (currently focused on C/C++)
- ✏️ **Monaco Editor** — Full-featured code editor with syntax highlighting, glyph margin breakpoints, and line highlighting
- 🎛️ **Full Debug Controls** — Continue, Step Over, Step Into, Step Out, Pause, and Stop
- 📂 **File Explorer** — Sidebar file tree (local via Electron / remote via backend API)
- 🔍 **Variable Inspector** — Nested variable tree with CDK Virtual Scroll for large datasets
- 📋 **Call Stack** — View the current thread's call stack during a debug session
- 💬 **Debug Console** — Scrollable output log with a custom command input

## Tech Stack

| Layer | Technology |
|---|---|
| Core Framework | Angular 21+ (Standalone Components) |
| Desktop App | Electron |
| Web Communication | WebSocket |
| UI Components | Angular Material |
| Code Editor | Monaco Editor (`ngx-monaco-editor-v2`) |
| State & Routing | Angular Router + DI Services |

## Views

### `/setup` — Initialization Setup View

The landing page, used to configure connection parameters before starting a debug session:

- **DAP Server Address** — e.g. `localhost:4711`
- **Launch Mode** — `Launch` (start a new process) or `Attach` (attach to a running process)
- **Executable Path** — Absolute or relative path to the debug target binary
- **Source Path** — Project source directory or main source file path
- **Program Arguments** — *(optional)* Arguments to pass to the target program

### `/debug` — Core Debugger View

A three-panel IDE layout:

- **Top Toolbar** — App name / project name + debug control buttons
- **Left Sidenav** — File explorer (local or remote)
- **Main Content** — Monaco Editor with breakpoint and execution highlighting
- **Right Sidenav** — Variable Inspector + Call Stack
- **Bottom Panel** — Connection status indicator + Debug Console

## Communication Architecture

### Electron (Desktop) Mode
```
Angular UI  →  contextBridge (IPC)  →  Electron Main Process  →  DAP Server
```

### Web Browser Mode
```
Angular UI  →  WebSocket  →  DAP Server (or Relay Proxy)
```

Both modes share the same Angular codebase. The communication layer is abstracted behind a `DapTransportService` so upper-level components remain mode-agnostic.

## Supported DAP Protocol

### Requests
`initialize` · `launch` · `attach` · `setBreakpoints` · `configurationDone` · `continue` · `next` · `stepIn` · `stepOut` · `pause` · `stackTrace` · `scopes` · `variables` · `threads` · `disconnect`

### Events
`initialized` · `stopped` · `continued` · `terminated` · `exited` · `output` · `breakpoint`

## Deployment Mode Comparison

| Capability | Electron (Desktop) | Web Browser |
|---|---|---|
| Local File Access | ✅ Direct | ❌ Requires backend API |
| DAP Server Launch | ❌ Must pre-start | ❌ Must pre-start |
| Communication | IPC (contextBridge) | WebSocket |
| Installation Required | Yes | Browser only |
| Remote Debugging | ✅ Supported | ✅ Supported |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Angular CLI](https://angular.dev/tools/cli)

```bash
npm install -g @angular/cli
```

### Install Dependencies

```bash
npm install
```

### Start DAP Server (GDB)

Use `websocketd` to wrap the local GDB DAP interface. For example:

```bash
websocketd --address 127.0.0.1 --port 4711 --binary --loglevel=debug /path/to/gdb -ex "set debug dap-log-file /path/to/dap.log"  -ex "set debug dap-log-level 2"  -i=dap
```

### Development Server

```bash
ng serve
```

Open your browser at `http://localhost:4200/`. The app will auto-reload on source file changes.

## Building

```bash
ng build
```

The compiled output is placed in the `dist/` directory, optimized for production.

## Running Unit Tests

```bash
ng test
```

Uses [Vitest](https://vitest.dev/) as the test runner.

## Running End-to-End Tests

```bash
ng e2e
```

Angular CLI does not bundle an e2e framework by default — choose one that fits your needs.

## Code Scaffolding

```bash
ng generate component component-name
```

For a full list of available schematics:

```bash
ng generate --help
```

## Additional Resources

- [Angular CLI Overview](https://angular.dev/tools/cli)
- [Debug Adapter Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- [Electron Documentation](https://www.electronjs.org/docs)
