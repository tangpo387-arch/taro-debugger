---
title: WebSocketTransportService — Unit Spec Plan
scope: unit-test
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: projects/taro-debugger-frontend/projects/taro-debugger-frontend/src/app/websocket-transport.service.ts
related-wi: ~
last_updated: 2026-04-13
---

# WebSocketTransportService — Unit Spec Plan

## Overview

Fully isolated tests for `WebSocketTransportService`. Focuses on DAP transport-layer framing: header parsing, packet concatenation, and fail-fast error isolation.

---

## Test Cases

* **Header parsing verification**
  * Feed valid `Content-Length: ...\r\n\r\n` format data, ensure packets are correctly split and trigger message events.

* **Packet concatenation (sticky/half packets)**
  * Simulate TCP fragmented packets (received in multiple chunks), verify the buffer concatenation logic correctly assembles complete JSON.

* **Fail-Fast & Error Isolation**
  * Feed malformed packets (e.g., missing header, first character not `C`, or non-Blob data types), verify the service permanently terminates the `Subject` and rejects subsequent messages.
