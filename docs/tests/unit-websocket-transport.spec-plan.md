---
title: WebSocketTransportService — Unit Spec Plan
scope: unit-test
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/dap-core/src/lib/transport/websocket-transport.service.ts
related-wi: WI-61
last_updated: 2026-04-18
---

# WebSocketTransportService — Unit Spec Plan

## Overview

Fully isolated tests for `WebSocketTransportService`. Focuses on DAP transport-layer framing (header parsing, packet concatenation) and service reusability across multiple debugger sessions (Subject lifecycle management).

---

## Test Cases

* **Header parsing verification**
  * Feed valid `Content-Length: ...\r\n\r\n` format data, ensure packets are correctly split and trigger message events.

* **Packet concatenation (sticky/half packets)**
  * Simulate TCP fragmented packets (received in multiple chunks), verify the buffer concatenation logic correctly assembles complete JSON.

* **Fail-Fast & Error Isolation**
  * Feed malformed packets (e.g., missing header, first character not `C`, or non-Blob data types), verify the service permanently terminates the current `Subject` to prevent stream misalignment.

* **Session Lifecycle & Reuse (Fix for WI-61)**
  * **Relaunch Success**: Connect, receive a packet, call `disconnect()`. Connect a second time and verify that a new packet is successfully received (ensures `messageSubject` is fresh).
  * **Error Recovery**: Trigger a transport error on the first connection. `disconnect()` and re-connect. Verify that the second session can receive messages (ensures terminal error states don't leak to subsequent sessions).
