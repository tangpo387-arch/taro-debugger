---
title: Architecture - Transport Layer
scope: architecture, transport-layer, websockets, ipc
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-06
related:
  - ../architecture.md
  - ../../.agents/skills/dap-implementation/dap-protocol-specs.md
---

# Transport Layer Architecture

## 1. Responsibilities

- Manage **low-level connections** to the DAP Server (establish, disconnect)
- **Serialize/deserialize** DAP protocol messages (including `Content-Length` header handling)
- Provide raw **message streams** (`onMessage()`)
- Publish **connection status** (`connectionStatus$`)

## 2. Class Structure

| Class | File | Description |
| --- | --- | --- |
| `DapTransportService` | `dap-transport.service.ts` | **Abstract base class**, defines the transport layer interface |
| `WebSocketTransportService` | `websocket-transport.service.ts` | WebSocket implementation, includes DAP binary stream parser with Content-Length header parsing. **Robustness**: Handles sticky/half packets via manual buffering; implements fail-fast error isolation for malformed packets; supports buffer auto-expansion (e.g., doubling capacity from 4KB). |
| `IpcTransportService` | `ipc-transport.service.ts` | Electron IPC implementation: the Angular renderer-side service calls `window.electronAPI` (exposed via `electron/preload.ts` `contextBridge`) for all DAP message I/O. The main process side (`electron/main.ts`) forwards IPC calls to the DAP server via a WebSocket Relay. **Strict Relay Contract**: The Relay Server must send all binary frames as `Blob` type; no client-side fallback is implemented. |
| `TransportFactoryService` | `transport-factory.service.ts` | Transport factory service, creates instances by `TransportType` |

## 3. Extension Guide

To add a new transport type:

1. **Create a new Service**: Extend `DapTransportService`, implement all abstract methods
2. **Register the type**: Add a new option to the `TransportType` union type in `DapConfig`
3. **Register with factory**: Add the corresponding `case` in `TransportFactoryService.createTransport()`

> **Note**: The Session layer and UI layer require no modifications whatsoever, adhering to the Open/Closed Principle (OCP).

## 4. Key Interface

```typescript
abstract class DapTransportService {
  abstract connect(address: string): Observable<void>;
  abstract disconnect(): void;
  abstract sendRequest(request: DapRequest): void;
  abstract onMessage(): Observable<DapMessage>;  // All message stream
  abstract get connectionStatus$(): Observable<boolean>;
}
```
