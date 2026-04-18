---
title: Extract DAP Core Library
scope: DAP Transport Layer
audience: [Lead_Engineer, Quality_Control_Reviewer, Product_Architect]
related:
  - work-items.md
  - file-map.md
---

# Extract DAP Core Library (WI-59 - WI-62)

> [!NOTE]
> **Source Work Items**: WI-59 through WI-62
> **Description**: Granular refactoring of DAP session, transport, and API types into a standalone Angular library.

## Purpose

The primary goal of this architectural refactor is to extract the core Debug Adapter Protocol (DAP) logic into a standalone Angular library (`@taro/dap-core`). This will:
- **Promote Reuse**: Enable the DAP client logic to be used in other interfaces (e.g., VS Code extensions, CLI tools).
- **Enforce Separation of Concerns**: Strictly decouple the protocol/session logic from the UI layer.
- **Improve Testability**: Allow for independent testing of the DAP message bus and state machine without UI dependencies.

## Scope

### Included in `@taro/dap-core`

- **API & Types**: `dap.types.ts` (DAP protocol definitions).
- **Transport Layer**: `dap-transport.service.ts`, `websocket-transport.service.ts`, `ipc-transport.service.ts`, `transport-factory.service.ts`.
- **Session Layer**: `dap-session.service.ts` (Core state machine), `dap-config.service.ts` (Connection settings management).
- **Logging Interface**: `dap-log.service.ts` (Abstract log streams).

### Excluded (Remains in App)

- **UI Logic**: All `*.component.ts` files, `layout.config.ts`, and DOM-manipulating services.
- **Feature Layer**: `dap-file-tree.service.ts`, `dap-variables.service.ts`, `dap-assembly.service.ts` (These are "features" that bridge DAP data to specific UI views, though we may consider moving them if they remain pure-data).

## Behavior

- **Dependency Injection**: The library will provide a `provideDapCore()` configuration function (following Angular 21+ patterns) to initialize transports and session providers.
- **Cross-Platform Bridge**: The `ipc-transport` will continue to use the `contextBridge` interface, which must be provided to the library via injection tokens to avoid direct dependencies on a specific global object.
- **Reactive State**: The `executionState$` and `connectionStatus$` observables will be the primary entry points for the UI to observe the session.

## Acceptance Criteria

1. **Build Integrity**: The library build command (`npx ng build dap-core`) completes with zero errors.
2. **Protocol Parity**: The DAP handshake (initialize, launch/attach) works exactly as it did before the extraction.
3. **Unit Test Migration**: All existing `.spec.ts` files for the migrated services pass within the new library workspace.
4. [Test] **UI Integration**: The main application loads, connects, and displays variables/stack-frames using the extracted library.
5. **No Layer Violations**: A dependency check confirms the library does not import any files from `projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/`.
