---
title: Stop at Main via DAP Function Breakpoints
scope: DAP Transport Layer
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-05-17
related:
  - architecture/core/dap-core.md
  - architecture/session-layer.md
---

# Stop at Main via DAP Function Breakpoints (WI-123)

> [!NOTE]
> **Source Work Item**: Stop at Main via DAP Function Breakpoints
> **Description**: Standardize 'stop at main' behavior across all DAP adapters using explicit function breakpoints during initialization.

## Purpose

Currently, the DAP session uses the `stopAtBeginningOfMainSubprogram` property in the `launch` request to halt execution at the program entry. However, this property is adapter-specific and not uniformly supported (e.g., `lldb-dap` vs `gdb`). This specification defines a standardized approach using explicit DAP function breakpoints to ensure reliable "stop on entry" behavior across all supported debuggers.

## Scope

- **`DapConfigService`**: Extend the configuration schema to include a user-facing `stopOnEntry` toggle.
- **`DapSessionService`**: 
    - Implement `setFunctionBreakpoints` request handling.
    - Remove hardcoded `stopAtBeginningOfMainSubprogram` from launch arguments.
    - Automatically inject a function breakpoint for `main` during the initialization handshake if enabled.
- **UI Components**: Add the toggle to `SetupWebComponent` and `SetupElectronComponent`.

## Behavior

### 1. Initialization Handshake
During the DAP handshake (`initialize` -> `launch`/`attach` -> `initialized` event -> `configurationDone`), the `DapSessionService` will:
1. Check the `stopOnEntry` flag in the active configuration.
2. If `true`, it will send a `setFunctionBreakpoints` request with `[{ "name": "main" }]` after `resyncAllBreakpointsInternal()` and before `configurationDone`.
3. This ensures the breakpoint is active before the program starts execution.

### 2. Launch Arguments
The `launch` request will no longer include `stopAtBeginningOfMainSubprogram: true`. This property is replaced by the explicit function breakpoint.

## Breakpoint Distinction

To ensure a clear user experience and avoid confusion between system-managed and user-managed stops, the system will distinguish between them through the following mechanisms:

1. **Protocol Separation**: System-initiated entry stops use `setFunctionBreakpoints` (symbolic), while user interactions in the editor gutter use `setBreakpoints` (source-based). The DAP adapter treats these as distinct entities.
2. **Internal ID Tracking**: `DapSessionService` will maintain a private registry of `systemBreakpointIds`. When the adapter returns a verified ID for the `main` function breakpoint, it is stored in this registry rather than the user-facing `breakpointsMap`.
3. **UI Stop Reasons**: When a `stopped` event is received:
    - If the `breakpointId` matches a value in the `systemBreakpointIds` registry, the UI will report the stop reason as "Paused at entry (main)".
    - If it matches a user breakpoint, it will report "Paused at breakpoint".
    - This prevents the "Stop at Main" breakpoint from appearing in the user's Breakpoint List, keeping the sidebar focused on user-defined intent.

## Future-Proofing & Persistence

As the system evolves to support persistent breakpoints across sessions, the "Stop at Main" logic must be integrated into the broader breakpoint synchronization flow:

1. **Merging Strategy**: `DapSessionService` must treat the `main` entry point as a system-managed function breakpoint. If the user eventually defines their own persistent function breakpoints, the "Stop at Main" logic should merge the `main` symbol into the list of requested function breakpoints rather than overwriting them.
2. **Conflict Resolution**: If a user sets a *source* breakpoint on the entry line of `main`, the debugger may report multiple hits for the same location. This is standard DAP behavior and should be handled gracefully by the UI (e.g., displaying the most relevant reason).
3. **UI Representation**: In a future iteration, the automatic `main` breakpoint should be visually distinguished in the "Breakpoints" panel as a "System" or "Entry" breakpoint to provide transparency to the user.

## Acceptance Criteria

- **DAP Compliance**: The session sends a valid `setFunctionBreakpoints` request during the configuration phase.
- **Compatibility**: The debugger successfully stops at the start of the `main` function when using both `gdb` and `lldb-dap`.
- **User Control**: Users can enable/disable this behavior via the "Stop at Main" toggle in the Setup View.
- **Persistence**: The `stopOnEntry` preference is saved in local storage via `DapConfigService`.
- **Test Coverage**: Unit tests for `DapSessionService` verify the protocol sequence.


