---
title: Architecture - DAP Core Library (@taro/dap-core)
scope: dap-core, session-layer, transport-layer, protocol
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/session-layer.md
  - architecture/transport-layer.md
  - architecture/monorepo-standards.md
---

# DAP Core Library

The `@taro/dap-core` library is a framework-agnostic package containing the core Debug Adapter Protocol (DAP) serialization, transport abstractions, and session lifecycle logic.

## 1. Architectural Purpose

- **Reuse**: Enables DAP client logic to be used across different UI hosts (Electron, VS Code, CLI).
- **Decoupling**: Strictly separates the protocol state machine from the Angular UI layer.
- **Testability**: Facilitates isolated unit testing of the DAP message bus without DOM or Angular TestBed overhead.

## 2. Library Structure

The library is organized into three primary domains:

### 2.1 API & Types

- **`dap.types.ts`**: Canonical TypeScript definitions for the DAP protocol requests, responses, and events.
- **`dap-log.service.ts`**: Abstract logging interfaces for protocol telemetry.

### 2.2 Transport Layer

Provides the abstract interface and concrete implementations for the physical communication channel.
- **`DapTransportService`**: Abstract base class defining `send()`, `receive$`, and connection lifecycle.
- **Implementations**:
  - `WebSocketTransportService`: For browser-based or remote debugging.
  - `IpcTransportService`: For native Electron integration via `contextBridge`.
- **`TransportFactoryService`**: Manages the instantiation of the correct transport based on configuration.

### 2.3 Session Layer

Manages the high-level protocol handshake and execution state machine.
- **`DapSessionService`**: The primary coordinator. Responsible for:
  - Sequential DAP handshake (`initialize` → `launch`/`attach`).
  - Request/Response pairing and timeout management.
  - Broadcasting the `executionState$` (Inactive, Launching, Running, Paused).
- **`DapConfigService`**: Manages connection settings and adapter-specific configurations.

## 3. Interaction Model

### 3.1 Reactive State

The library exposes two primary streams for UI synchronization:
- **`executionState$`**: Reflects the current lifecycle of the debuggee process.
- **`connectionStatus$`**: Reflects the health of the transport channel.

### 3.2 Dependency Injection (Angular)

While the core logic is pure TypeScript, the library provides a `provideDapCore()` configuration function to integrate seamlessly with Angular 21+ Standalone applications.

---

## 4. Exclusion Boundary

The `@taro/dap-core` library is strictly forbidden from importing:
- Any Angular UI component or directive.
- Any DOM-specific APIs (except within specific transport implementations).
- Feature-level services that bridge DAP data to specific UI views (e.g., `FileTreeService`).
