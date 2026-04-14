---
title: Taro Debugger
scope: project overview, quick start, architecture
audience: beginner
last_updated: 2026-04-14
---

# Taro Debugger

> Cross-platform web frontend for C/C++ debugging over the Debug Adapter Protocol (DAP).

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/nobra/gdb-frontend/actions)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Angular](https://img.shields.io/badge/Angular-21%2B-DD0031.svg)](https://angular.io/)
[![DAP](https://img.shields.io/badge/Protocol-DAP-blue.svg)](https://microsoft.github.io/debug-adapter-protocol/)

Taro Debugger is a cross-platform frontend for debugging C/C++ applications over WebSocket-connected GDB/LLDB instances. It runs in any browser or as an Electron desktop app, requiring no IDE installation.

> [!NOTE]
> **Scope**: C/C++ debugging only. Windows path variants (`\`) are handled internally — no extra configuration required. LLDB setup follows the same steps as GDB. Authentication and multi-user deployment are out of v1.0 scope.

## Why Taro?

- **Remote-First Architecture**: Connect to debug adapters over WebSockets, enabling real-time debugging of remote systems from any browser.
- **Monaco Editor**: Syntax highlighting, breakpoint glyph margin, and live execution tracking — no IDE installation required.
- **Universal Deployment**: Run as a standalone **Electron** desktop app for local files or deploy as a **Web Application** for centralized access.
- **DAP-Native**: Built on DAP, ensuring compatibility with GDB, LLDB, and other standard debug engines.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Core Framework | Angular 21+ (Standalone Components) |
| Desktop App | Electron (native `contextBridge` IPC — Inter-Process Communication) |
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

> [Diagram: Electron mode — the Angular UI sends DAP commands through Electron's `contextBridge` (IPC) to the main process, which relays them to the DAP Server via stdin/stdout.]

### Web Browser Mode

```text
Angular UI  →  WebSocket  →  DAP Server (or Relay Proxy)
```

> [Diagram: Web mode — the Angular UI sends DAP JSON messages over a WebSocket connection directly to the DAP Server, or through an intermediary relay proxy.]

Both modes share the same Angular codebase. The communication layer is abstracted behind a `DapTransportService` so upper-level components remain mode-agnostic.

## Protocol Support

Taro is fully compatible with the **DAP** standard. It supports core debugging operations including:

- **Execution Control**: Initialize, Launch/Attach, Continue, Step Over/In/Out, Pause, Disconnect.
- **State Inspection**: Stack Trace, Variable Scopes, Thread management.
- **Breakpoints**: Dynamic breakpoint setting and status updates.

## Quick Start

### 1. Prerequisites

- [Node.js](https://nodejs.org/) LTS (Long-Term Support) — v20 or later
- [GDB](https://www.sourceware.org/gdb/) v13+ or [LLDB](https://lldb.llvm.org/) with DAP support
- [websocketd](http://websocketd.com/) (bridges GDB/LLDB to WebSocket)

### 2. Launch the DAP Server

Taro communicates with GDB/LLDB via WebSockets. Use `websocketd` to bridge the gap:

```bash
websocketd --port 4711 --binary /usr/bin/gdb -i=dap
```

### 3. Start the Frontend

Clone the repo and launch the development server:

```bash
git clone https://github.com/tangpo387-arch/taro-debugger.git
cd taro-debugger
npm install
npm start
```

### 4. Verify the Setup

Open `http://localhost:4200` in your browser. You should see the **Setup View** with connection fields (DAP Server Address, Launch Mode, Executable Path). Enter your DAP Server address (e.g., `localhost:4711`) and click **Connect**. If the status indicator turns green, the session is active and ready.

## Development

### Project Commands

| Operation | Command |
| --- | --- |
| **Start Dev Server** | `npm start` |
| **Build Production** | `npm run build` |
| **Run Unit Tests** | `npm test` |
| **Scaffold Component** | `ng generate component name` |

### Environment Setup

Taro uses [Vitest](https://vitest.dev/) for unit testing and follows a strict [DAP Implementation Policy](docs/dap-integration-faq.md). For detailed architectural insights, see [Architecture Overview](docs/architecture.md).

## AI Coding Assistance

This project is actively developed with the assistance of AI coding agents, including **Gemini** and **Claude**. To maintain code quality and architectural integrity, we use an autonomous development team framework defined in `.agents/AGENTS.md`.

When working with AI assistants on this codebase:
- Ensure the AI reads [`.agents/project-context.md`](.agents/project-context.md) before making changes.
- Ensure the AI adheres to the established project style guide and documented DAP implementation rules.

## Resources & Links

- [Debug Adapter Protocol Specification](https://microsoft.github.io/debug-adapter-protocol/)
- [Monaco Editor Documentation](https://microsoft.github.io/monaco-editor/)
- [Electron JS](https://www.electronjs.org/)
- [Angular CLI Guide](https://angular.dev/tools/cli)

---

Developed with ❤️ by the Taro Team. Licensed under [Apache-2.0](LICENSE).
