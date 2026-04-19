---
title: End-to-End Tests — Spec Plan
scope: e2e
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
target-file: ~
related-wi: ~
last_updated: 2026-04-13
---

# End-to-End Tests — Spec Plan

## Overview

Launch the complete application (browser mode) from the user's perspective. To avoid depending on a real C/C++ compilation environment, use a **Mock DAP Server** approach.

**Recommended toolchain**: Playwright — native and powerful support for WebSocket communication interception and Electron desktop application testing.

---

## Happy Path

1. Navigate to the `/setup` page, fill in Mock Server address and parameters.
2. Click Launch to enter `/debug` page, display green indicator (connection status).
3. Mock Server sends `stopped` event, UI left panel loads file tree (if applicable), right panel call stack updates, Continue button unlocks.
4. Click Continue button, UI state returns to Running.

---

## Error Path

* Enter an unreachable address, verify UI displays a Timeout error dialog (or Error SnackBar).
* Close Mock Server connection mid-debug, verify status bar turns gray/red and a disconnect notification appears.
