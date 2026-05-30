---
title: Implement taro-session Unit Testing Suite
scope: DAP Transport Layer
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Implement taro-session Unit Testing Suite (WI-138)

> [!NOTE]
> **Source Work Item**: Implement taro-session Unit Testing Suite
> **Description**: Establish the unit testing framework for taro-session and implement tests to verify WebSocket server routing, GDB event broadcasting, and logger file persistence

## Purpose

The purpose of this specification is to define the testing strategy and unit test suite for the **`taro-session`** server utility. Because the debugger bridge handles core logic such as DAP framing, concurrent packet broadcasting, and session log persistence, establishing continuous automated test coverage is critical to prevent regression in backend transport flows.

## Scope

### In Scope

- Setup of a Vitest configuration specific to the Node.js context of the `projects/taro-session` package.
- Creation of mock GDB target processes and WebSocket connections to facilitate fast, isolated tests.
- Unit and integration tests for `SessionLogger` verifying real-time file creation and writes.
- WebSocket server routing tests verifying `/session/client` and `/session/agent` handshake lifecycle, connection state gating, and concurrent DAP event broadcasting.
- Chat protocol routing tests verifying pass-through between client and agent.

### Out of Scope

- Tests involving hardware targets or real GDB installations.
- Visual inspection of logs in the Angular frontend UI.
- Secure transport wrapping (SSL/TLS).

## Behavior

### 1. Test Harness and Environment

- The `taro-session` tests will be run using **Vitest** configured for the `Node.js` environment (in contrast to the Angular browser-based `jsdom` testing environment).
- A workspace test command will be introduced in the root `package.json`:

  ```bash
  npm run test:session
  ```

### 2. SessionLogger Test Mechanics

- The logger tests will dynamically spin up temporary session directories within the workspace (e.g., using `os.tmpdir()`).
- Tests will invoke `logStdout()`, `logStderr()`, and `logDap()`, verifying that files (`stdout.log`, `stderr.log`, `dap.log`) are correctly appended on disk with ISO-8601 timestamps.
- Tests will verify stream closure behaves cleanly, releasing file descriptors upon session end.

### 3. WebSocketServer Test Mechanics

- The server will be instantiated on an ephemeral port (e.g., `:0` or a free port) to avoid resource conflicts.
- **Mock GDB**: The `GdbProcessManager` will be stubbed/mocked to simulate DAP responses and target process exits without spawning a physical GDB instance.
- **Connection Gating (AC-1)**: Tests will attempt to connect to `/session/agent` under `UNINITIALIZED` state and verify the server immediately rejects the connection with code `4005`.
- **Concurrent Event Broadcasting**: Tests will simulate a GDB event and assert that both the connected client WebSocket and the agent WebSocket receive the payload concurrently.
- **Chat Routing**: Tests will transmit chat envelopes across `/session/client` and verify they are correctly intercepted, recorded in `chat.json` by `SessionManager`, and delivered to `/session/agent` (and vice-versa).

## Acceptance Criteria

### Automated Verification

- **AC-1**: `package.json` contains a `test:session` script mapping to `vitest run projects/taro-session`.
- **AC-2**: Running `npm run test:session` successfully discovers and passes all tests with a 100% pass rate.
- **AC-3**: `SessionLogger` tests confirm that `stdout.log`, `stderr.log`, and `dap.log` are correctly created, formatted, and appended under the session path.
- **AC-4**: `WebSocketServer` connection gating tests confirm `/session/agent` is rejected (code `4005`) if the server is not `READY`.
- **AC-5**: `WebSocketServer` broadcast tests confirm GDB events are successfully dispatched to both client and agent sockets concurrently.
- **AC-6**: `WebSocketServer` chat tests confirm client/agent chat envelopes route bidirectionally and persist correctly in the `chat.json` database.
