---
title: Manual Verification — Spec Plan
scope: manual
audience: [Lead_Engineer, Quality_Control_Reviewer]
target-file: ~
related-wi: ~
last_updated: 2026-04-13
---

# Manual Verification — Spec Plan

## Overview

Feature points that are difficult to automate or require human sensory verification.

---

## Debug Control Button Visual Feedback (UI/UX)

* **Tooltip display**: When hovering over each control button (Continue, Pause, Step Over, etc.), verify expected human-readable tooltip text appears.
* **Ripple Effect**: When clicking an enabled button, confirm the Material Design ripple visual press feedback appears.
* **Color & grayscale rendering**: Confirm the Stop button displays a warning color (warn), and buttons in disabled state have appearance (opacity/color) that clearly indicates they are non-clickable.

---

## Connection & DAP Error Handling (Error Handling UI)

* **Manual Reconnect (Reconnect UI)**: After simulating `error` state, verify that the original "Restart" button on the interface has automatically switched to a "Reconnect" button with a `sync` icon, and hover tooltip content is correct.

---

## FileExplorerComponent — Visual & Interaction Verification

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Open `/debug`, session enters `stopped` state | Left sidenav shows file tree with correct content; "Files" heading, source path, and "Collapse All" button render with 16px inset padding on all sides |
| 2 | Hover over a long file path that exceeds panel width | Single horizontal scrollbar appears **at the sidenav level only** (not a double scrollbar); scrollbar is inside the sidenav container |
| 3 | Click a file node | The clicked node gets the `active-file` highlight (primary color background); editor loads the file's source code |
| 4 | Click a call-stack frame that references a different file | The file tree automatically highlights the corresponding file node (driven by `activeFilePath` @Input binding) |
| 5 | Click "Collapse All" (`unfold_less` icon) | All expanded directory nodes collapse |
| 6 | Click "Collapse All" when `fileTreeSupported = false` | Button is disabled (grayed out), no error |
| 7 | Connect to a DAP server that does NOT support `loadedSources` | File tree area renders the unsupported-message block with the `info` icon and descriptive text; no tree nodes shown |
| 8 | Click the minimize button (`chevron_left`) | Left sidenav collapses; click the header menu button to reopen; tree content reappears without data loss |

---

## Breakpoint DAP Synchronization — Live Integration Test

> Requires a live DAP adapter (e.g., `lldb-dap` or `gdb`) connected to a compiled C/C++ binary.

| Step | Action | Expected Result |
| --- | --- | --- |
| 1 | Open `/debug` with a valid C++ binary | Session starts; console logs `Session started in launch mode`; editor shows `// Editor is ready.` |
| 2 | Click a source file in the file tree | Source code loads in the Monaco Editor |
| 3 | Click the glyph margin on a source line **while state is `running`** | Gray dot (`.breakpoint-glyph-unverified`) appears immediately; no DAP request sent yet (session guard) |
| 4 | Pause execution via the Pause button | State transitions to `stopped` |
| 5 | Click the glyph margin on a source line **while state is `stopped`** | Gray dot appears instantly; within ~5 s the dot turns red (`.breakpoint-glyph`) once the adapter confirms `verified: true`; console logs `Breakpoints synced: 1/1 verified` |
| 6 | Click an **invalid line** (blank line or comment) | Gray dot appears and stays gray — adapter returns `verified: false` |
| 7 | Click the same **verified** breakpoint line again to remove it | Red dot disappears; console logs `Breakpoints synced: 0/0 verified` |
| 8 | Switch to a different source file via the file tree | Previous file's breakpoint dots are preserved in internal state; new file shows no dots |
| 9 | Click **Restart** | Session reconnects; all previously toggled breakpoints are re-sent; console logs `Re-syncing N file(s) of breakpoints to new session...`; dots reflect updated verified state |
| 10 | Simulate adapter relocating a breakpoint (via `breakpoint` DAP event with a different `line`) | Glyph moves to the new line without triggering an extra `setBreakpoints` round-trip (verify in browser Network / WebSocket frame inspector) |
