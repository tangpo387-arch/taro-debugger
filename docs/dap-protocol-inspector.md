---
title: DAP Protocol Inspector (3-Tab Support)
scope: Console & Status Bar
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# DAP Protocol Inspector (3-Tab Support) (WI-68)

> [!NOTE]
> **Source Work Item**: DAP Protocol Inspector (3-Tab Support)
> **Description**: Add a third tab to the console for raw DAP protocol traffic (requests, responses, and events) to isolate diagnostic data from user program output.

## Purpose

The DAP Protocol Inspector (WI-68) introduces a dedicated diagnostic view for raw Debug Adapter Protocol (DAP) traffic. By isolating protocol messages (Requests, Responses, and Events) from the program's stdout/stderr and the user-facing Debug Console, we provide a clean interface for:
- Debugging complex DAP handshake sequences.
- Verifying property values in large JSON payloads.
- Isolating frontend-driven logic errors from Debug Adapter behavior.

## Scope

### Included

- **ProtocolConsoleComponent**: A new standalone component in `@taro/ui-console` dedicated to rendering DAP messages.
- **Variable Height Scrolling**: Refactor the log viewer's virtual scroll strategy to support variable height JSON entries through `AutoSizeVirtualScrollStrategy` or a custom implementation.
- **JSON Payload Expansion**: Integration of an expandable tree view (using `mat-tree` or custom logic) to inspect nested DAP object properties.
- **Orchestration**: Updating `LogViewerComponent` to manage three tabs instead of two.
- **Data Pipeline**: Bridging `DapSessionService` traffic (requests/responses) into the `DapLogService` under a new 'dap' category.

### Excluded

- Real-time editing or re-sending of DAP packets (Read-only view).
- Integration with the main application's File Explorer (Internal to Console only).

## Behavior

### 1. Component Hierarchy

- `LogViewerComponent` (Orchestrator)
  - `mat-tab` (Label: "Debug Console")
  - `mat-tab` (Label: "Output")
  - `mat-tab` (Label: "DAP Protocol")
    - `app-protocol-console`
      - `cdk-virtual-scroll-viewport` (with AutoSize strategy)
        - `ProtocolEntryComponent` (renders single request/response pair or event)

### 2. Rendering Strategy

Each DAP message is rendered as a color-coded entry:
- **Requests**: Blue marker, showing command name and unique sequence ID.
- **Responses**: Green/Red marker (success/failure), linked to the request ID.
- **Events**: Purple marker, showing event type.

The payload (the `body` or `arguments` of the DAP message) must be collapsed by default but expandable to show full JSON details.

### 3. Virtual Scroll Optimization

Since JSON payloads can vary from a single line to hundreds of lines, the standard `FixedSizeVirtualScrollStrategy` is insufficient. The implementation MUST use `@angular/cdk-experimental`'s `AutoSizeVirtualScrollStrategy` or a custom `VirtualScrollStrategy` that calculates offsets based on content dimensions.

## Acceptance Criteria

- [ ] `ProtocolConsoleComponent` is implemented and integrated as the 3rd tab in `LogViewerComponent`.
- [ ] DAP Traffic (Requests, Responses, Events) is correctly routed to the 'dap' category in `DapLogService`.
- [ ] Protocol messages are color-coded and identifiable by type (Req/Res/Evt).
- [ ] JSON payloads support "Click to Expand" functionality within the virtual scroll list.
- [ ] Virtual scroll does not jitter or "jump" when expanding large JSON objects.
- [ ] [Test] Unit tests verify that `ProtocolConsole` limits its display to 'dap' category logs.
- [ ] [Test] Integration test confirms `DapLogService` correctly aggregates session traffic into the protocol stream.
