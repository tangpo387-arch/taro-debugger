# Taro Debugger

> Professional Remote C/C++ Debugging, Reimagined for the Web.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/nobra/gdb-frontend/actions)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21%2B-DD0031.svg)](https://angular.io/)
[![DAP](https://img.shields.io/badge/Protocol-DAP-blue.svg)](https://microsoft.github.io/debug-adapter-protocol/)

Taro Debugger is a professional, cross-platform debugger frontend that delivers an IDE-grade experience. Whether you're working on a remote server or a local desktop, Taro provides the tools you need to debug C/C++ applications with precision and ease.

![Taro Debugger Hero Screenshot](https://via.placeholder.com/1200x600?text=Taro+Debugger+Professional+UI+Screenshot)

## Why Taro?

- **Remote-First Architecture**: Connect to debug adapters over WebSockets, enabling real-time debugging of remote systems from any browser.
- **Professional IDE Experience**: Powered by the **Monaco Editor**, featuring syntax highlighting, breakpoint management, and live execution tracking.
- **Universal Deployment**: Run as a standalone **Electron** desktop app for local files or deploy as a **Web Application** for centralized access.
- **DAP-Native**: Built from the ground up on the Debug Adapter Protocol, ensuring compatibility with GDB, LLDB, and other standard engines.

## Key Features

- 🖥️ **Dual Modes** — Seamlessly switch between Electron desktop and Web browser environments.
- ✏️ **Advanced Editor** — Glyph margin breakpoints, line highlighting, and integrated terminal.
- 📂 **Smart File Explorer** — Navigate local or remote source trees efficiently.
- 🔍 **Variable Inspector** — Inspect complex nested objects with high-performance CDK Virtual Scroll.
- 💬 **Integrated Console** — Separate streams for system diagnostics and program output.

## Tech Stack

| Layer | Technology |
|---|---|
| Core Framework | Angular 21+ (Standalone Components) |
| Desktop App | Electron (native `contextBridge` IPC) |
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

```text
Angular UI  →  contextBridge (IPC)  →  Electron Main Process  →  DAP Server
```

### Web Browser Mode

```text
Angular UI  →  WebSocket  →  DAP Server (or Relay Proxy)
```

Both modes share the same Angular codebase. The communication layer is abstracted behind a `DapTransportService` so upper-level components remain mode-agnostic.

## Protocol Support

Taro is fully compatible with the standard **Debug Adapter Protocol (DAP)**. It supports core debugging operations including:

- **Execution Control**: Initialize, Launch/Attach, Continue, Step Over/In/Out, Pause, Disconnect.
- **State Inspection**: Stack Trace, Variable Scopes, Thread management.
- **Breakpoints**: Dynamic breakpoint setting and status updates.

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [GDB](https://www.sourceware.org/gdb/) or [LLDB](https://lldb.llvm.org/) with DAP support
- [websocketd](http://websocketd.com/) (to bridge GDB to the Web)

### 2. Launch the DAP Server

Taro communicates with GDB/LLDB via WebSockets. Use `websocketd` to bridge the gap:

```bash
websocketd --port 4711 --binary /usr/bin/gdb -i=dap
```

### 3. Start the Frontend

Clone the repo and launch the development server:

```bash
git clone https://github.com/nobra/gdb-frontend.git
cd gdb-frontend
npm install
npm start
```

Visit `http://localhost:4200` to start debugging!

## Development

### Project Commands

| Operation | Command |
|---|---|
| **Start Dev Server** | `npm start` |
| **Build Production** | `npm run build` |
| **Run Unit Tests** | `npm test` |
| **Scaffold Component** | `ng generate component name` |

### Environment Setup

Taro uses [Vitest](https://vitest.dev/) for unit testing and follows a strict [DAP Implementation Policy](docs/dap-integration-faq.md). For detailed architectural insights, see [Architecture Overview](docs/architecture.md).

## Resources & Links

- [Debug Adapter Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [Electron JS](https://www.electronjs.org/)
- [Angular CLI Guide](https://angular.dev/tools/cli)

---

Developed with ❤️ by the Taro Team. Licensed under [Apache-2.0](LICENSE).
