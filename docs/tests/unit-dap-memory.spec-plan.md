---
title: Spec-Plan - DapMemoryService Unit Tests
scope: unit-test, dap-core, memory-inspection
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-15
related:
  - ../archive/specs/memory-view-spec.md
  - ../../projects/dap-core/src/lib/session/dap-memory.service.ts
---

# Spec-Plan: DapMemoryService Unit Tests

## 1. Objective

Verifies the `DapMemoryService` in `@taro/dap-core`. Focuses on Base64/Uint8Array conversion, protocol request orchestration, and reactive update notification.

## 2. Test Suite: DapMemoryService

### read()

- **Successful read (Base64 to Uint8Array)**
  - **Description**: Verifies that Base64 data returned by the DAP adapter is correctly converted to a `Uint8Array`.
  - **Arrange**: Mock `dapSession.readMemory` to return success with body `{ data: 'SGVsbG8=' }` (ASCII for "Hello").
  - **Act**: Call `service.read('0x100', 0, 5)`.
  - **Assert**: Should return `Uint8Array` matching `[72, 101, 108, 108, 111]`.

- **Empty/Failed read**
  - **Description**: Verifies that a failed DAP request or empty body returns an empty array.
  - **Arrange**: Mock `dapSession.readMemory` to return `success: false` or empty body.
  - **Act**: Call `service.read('0x100', 0, 5)`.
  - **Assert**: Should return empty `Uint8Array`.

- **Decoding error handling**
  - **Description**: Verifies that malformed Base64 data from the adapter does not crash the service.
  - **Arrange**: Mock `dapSession.readMemory` to return an invalid Base64 string (e.g., symbols like `!!!`).
  - **Act**: Call `service.read('0x100', 0, 5)`.
  - **Assert**: Should return an empty `Uint8Array` and log an error.

### write()

- **Successful write (Uint8Array to Base64)**
  - **Description**: Verifies that binary data is correctly encoded to Base64 before being sent to the DAP adapter.
  - **Arrange**: Mock `dapSession.writeMemory` to return success with `bytesWritten: 5`.
  - **Act**: Call `service.write('0x100', 0, new Uint8Array([72, 101, 108, 108, 111]))`.
  - **Assert**:
    - `dapSession.writeMemory` must be called with `data: 'SGVsbG8='`.
    - Should return `5`.

- **Failed write**
  - **Description**: Verifies that a failed write request returns 0 bytes written.
  - **Arrange**: Mock `dapSession.writeMemory` to return `success: false`.
  - **Act**: Call `service.write('0x100', 0, data)`.
  - **Assert**: Should return `0`.

### Reactive Updates

- **onMemoryUpdated$ notification**
  - **Description**: Verifies that a successful write triggers the reactive update stream.
  - **Arrange**: Mock `dapSession.writeMemory` to return success.
  - **Act**: Call `service.write('0x100', 10, data)`.
  - **Assert**: `onMemoryUpdated$` should emit an event matching `{ memoryReference: '0x100', offset: 10, length: data.length }`.
