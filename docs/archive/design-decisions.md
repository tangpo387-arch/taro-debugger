---
title: Design Decisions (ADR)
scope: architecture, decisions, rationale, tradeoffs
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-14
related:
  - docs/architecture.md
  - docs/system-specification.md
  - docs/dap-integration-faq.md
---

# Design Decisions (ADR)

This document records key Architecture Decision Records (ADRs) for the `taro-debugger-frontend` project.
Each entry captures the **context**, **decision**, and **consequences** of a non-obvious implementation choice.
WI/TI IDs are provided for cross-referencing with the development history.

---

## ADR-01: DAP Request Timeout via `setTimeout` + `Promise.reject`

- **WI**: WI-07 (DAP Request Timeout Mechanism)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

`DapSessionService.sendRequest()` creates a `Promise` that resolves when the matching response arrives. If the DAP Server is unresponsive, the Promise would never settle, causing permanent resource leaks.

### Decision

Implement the timeout using a native `setTimeout` callback that rejects the Promise and removes the pending request entry after a configurable duration (default: 5 seconds). RxJS `timeout` operator was deliberately **not** used to avoid mixing Observable and Promise semantics inside a single request/response pair.

### Consequences

- All `sendRequest` callers must handle `TimeoutError` in their `try/catch` block.
- The `timeoutMs` parameter is exposed per-call to allow DAP commands with known long latencies (e.g., `launch`) to use a higher timeout.

---

## ADR-02: Surgical Breakpoint Update + Re-sync on Reconnect

- **WI**: WI-13 (Breakpoint DAP Synchronization)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

The DAP `setBreakpoints` request replaces **all** breakpoints for a given file in a single call. Naively re-sending all breakpoints on every toggle would clear server-side state unnecessarily and lose verification status.

### Decision

- **Surgical update**: On each glyph-margin toggle, send `setBreakpoints` **only for the affected file**, passing the full new set for that file. Other files are unaffected.
- **Verified vs. Unverified display**: Breakpoints returned with `verified: false` are rendered in gray; `verified: true` in red.
- **Re-sync on reconnect**: After `configurationDone`, re-send `setBreakpoints` for every file that has local breakpoints, ensuring the server and client are consistent after a session restart.

### Consequences

- The client maintains an authoritative local `Map<filename, Set<lineNumber>>` as the SSOT for breakpoint positions.
- Server-side relocations (lazy verification, line adjustment) are reconciled via `breakpoint` events using surgical `deltaDecorations` updates rather than a full re-render.

---

## ADR-03: Dedicated `DapVariablesService` (not embedded in `DapSessionService`)

- **WI**: WI-55 (Variables Data State Management)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

Variable state (`scopes`, `variables`, lazy-loading cache) is derived from the execution state and only valid when `executionState === 'stopped'`. Initially, this logic was a candidate for placement directly inside `DapSessionService`.

### Decision

Extract all variable-related derived state and caching into a dedicated **`DapVariablesService`**. `DapSessionService` remains the SSOT only for core session state (`executionState`, `connectionStatus`, `capabilities`).

### Consequences

- `DapVariablesService` subscribes to `DapSessionService.executionState$` and automatically clears its cache and resets `scopes$` to `[]` whenever the state transitions out of `stopped` (R_SM5 compliance).
- Lazy-loading (`variablesReference > 0`) is encapsulated entirely within `DapVariablesService`, making it independently testable (see TI-06).
- `VariablesComponent` injects `DapVariablesService` directly, not via `@Input()` from `DebuggerComponent` (R_SM4 compliance).

---

## ADR-04: Flat Tree + Virtual Scrolling for Variable Inspection

- **WI**: WI-56 (Variables Tree UI Component)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

The DAP `variables` response can be deeply nested (e.g., struct members, array elements with hundreds of items). Using `mat-tree` with `NestedTreeControl` requires the entire tree to be in the DOM simultaneously.

### Decision

Implement `VariablesComponent` using a **hierarchical-to-flat transformation**:
1. The component maintains a `FlatVariableNode[]` array derived from the nested `VariableNode` tree.
2. This flat array is rendered via `cdk-virtual-scroll-viewport` + `*cdkVirtualFor` for DOM recycling.
3. `mat-tree` with `NestedTreeControl` was explicitly **rejected** as it is deprecated since Angular Material v17+ (see code-style-guide §Angular Material Tree API).

### Consequences

- Node expansion/collapse requires recalculating the flat array (splice/filter operations), but only the visible window is in the DOM.
- Performance is acceptable for large variable trees (e.g., 500+ nodes) because virtual scrolling limits DOM nodes to ~20 at a time.
- First scope (e.g., `Locals`) is auto-expanded on load for immediate usability.

---

## ADR-05: `HashLocationStrategy` for Electron `file://` Compatibility

- **WI**: WI-23 (Electron Main Process Architecture)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

Angular's default `PathLocationStrategy` relies on the HTML5 History API (`pushState`). When Electron loads the app via `loadFile()` using the `file://` protocol, route navigation (e.g., `/debug`) produces a "file not found" error because `file:///path/to/dist/debug` does not exist on disk.

A temporary workaround using `<base href="./">` was applied earlier but caused route-resolution issues in web mode.

### Decision

Adopt **`HashLocationStrategy`** (`withHashLocation()` in `app.config.ts`) globally. Routes become `file:///.../#/debug` in Electron and `http://localhost:4200/#/debug` in web mode — both environments resolve correctly without path-relative workarounds.

### Consequences

- `<base href="/">` is restored in `src/index.html` (the `./` workaround is reverted).
- All internal `Router.navigate()` calls and `[routerLink]` directives are unaffected — Angular handles the hash prefix transparently.
- Deep-link URLs shared externally will contain `#`, which is a minor but acceptable UX tradeoff given the desktop-app context.

---

## ADR-06: Electron Security Model (`contextIsolation` + `sandbox`)

- **WI**: WI-23 (Electron Main Process Architecture)
- **Status**: Accepted
- **Date**: 2026-04-04T00:00:00+08:00

### Context

Electron's default settings (`nodeIntegration: true`) allow renderer-process code to call Node.js APIs directly, creating a significant XSS-to-RCE attack surface if the app loads untrusted content.

### Decision

Enforce strict isolation in `BrowserWindow`:

```typescript
webPreferences: {
  contextIsolation: true,  // Isolates renderer JS from preload context
  nodeIntegration: false,  // No direct Node.js access in renderer
  sandbox: true,           // OS-level sandboxing for renderer process
  preload: path.join(__dirname, 'preload.js'),
}
```

All communication between the renderer (Angular) and the main process (Node.js) must go through the `contextBridge` whitelist in `electron/preload.ts`. Channel names are validated against a hardcoded whitelist; `unknown` typing is used throughout (no `any`).

### Consequences

- `IpcTransportService` (WI-24, Pending) must use `window.electronAPI` (exposed via `contextBridge`) for all DAP I/O, not `ipcRenderer` directly.
- A separate `tsconfig.electron.json` is required (targeting `CommonJS` / `ES2022`) to compile the main process and preload scripts without Angular template-checking options interfering.
- `electron-builder` is configured for Linux (`AppImage`, `deb`) and Windows (`nsis`) packaging targets.

---

## ADR-07: Electron Main Process Uses WebSocket Relay (Not Direct TCP) for DAP Communication

- **WI**: WI-24 (Electron IPC Transport Layer)
- **Status**: Accepted
- **Date**: 2026-04-06T02:39:00+08:00

### Context

The initial WI-24 specification described the Electron main process forwarding DAP messages to the DAP Server via a **raw TCP socket** (`net.createConnection`). However, most modern DAP Servers (such as the Node.js WebSocket bridge from WI-09) expose a **WebSocket endpoint** rather than a bare TCP port.

Attempting to open a raw TCP connection to a WebSocket server results in `400 Bad Request`, because the server performs an HTTP Upgrade handshake that a plain TCP client cannot satisfy.

### Decision

The Electron main process (`electron/main.ts`) connects to the DAP Server via a **WebSocket connection** using the globally available `WebSocket` class (native to Electron's bundled Chromium/Node.js runtime). The address passed from `IpcTransportService` is automatically normalized: if no `ws://` prefix is present, it is prepended automatically.

This means both Electron Desktop Mode and Web Browser Mode share the same WebSocket relay infrastructure (WI-09), with the distinction being **who opens the WebSocket connection**:
- **Web Browser Mode**: The Angular renderer opens the WebSocket directly.
- **Electron Desktop Mode**: The Electron main process opens the WebSocket on behalf of the renderer, bridged via IPC.

### Consequences

- The `net` module is no longer imported in `electron/main.ts`.
- The `§4.1` communication path in `system-specification.md` is updated to reflect a 4-layer flow including the WebSocket Relay Layer.
- WI-09 (Node.js WebSocket Bridge) is a **shared dependency** for both deployment modes, not Electron-exclusive.

---

## ADR-08: SemVer Pre-Release Suffix for Active Development (`-dev`, `-rc.N`)

- **WI**: N/A (project management decision)
- **Status**: Accepted
- **Date**: 2026-04-14T00:46:00+08:00

### Context

`package.json` carried `"version": "1.0.0"` while 3 work items (WI-09, WI-33, WI-34) remained in `⏳ Pending` state. Publishing or distributing a build labelled `1.0.0` before the milestone is complete would misrepresent the software's readiness.

### Decision

Adopt a **SemVer pre-release suffix** convention for `package.json` throughout the v1.0 development cycle:

| Stage | Version string | Condition to advance |
| :--- | :--- | :--- |
| Active development | `1.0.0-dev` | Any WI still pending |
| Feature-complete, in QA | `1.0.0-rc.1` | All WIs done; regression testing ongoing |
| Formal release | `1.0.0` | All WIs done + QA sign-off |

`-dev` was preferred over `-develop` to align with SemVer community convention and keep the string concise. RC increments (`-rc.1`, `-rc.2`) are used if stabilization requires multiple passes.

### Consequences

- `package.json` is immediately updated to `1.0.0-dev` (done: 2026-04-14).
- `Product_Architect` is responsible for bumping the suffix at each stage transition.
- `electron-builder` output filenames will reflect the suffix (e.g., `taro-debugger-1.0.0-dev.AppImage`), making pre-release artifacts unambiguously distinguishable from the stable release.

---

## ADR-09: System-wide ID Flattening

- **WI**: WI-63 (System-wide ID Flattening and Script Hardening)
- **Status**: Accepted
- **Date**: 2026-04-18T21:14:00+08:00

### Context

In the early stages of the project, Fractional IDs (e.g., `WI-18.1`, `54.1`) were permitted to express parent-child relationships between tasks. However, this introduced significant technical debt in practice:
1. **Toolchain Fragility**: Inconsistent regex validation for IDs between `manage-wi.js` and `update-wi.js` caused dots to be incorrectly parsed or intercepted.
2. **Visualization Breakage**: `generate-docs.js`, when converting IDs to Mermaid node names (transforming `.` to `_`), would produce orphaned or duplicate nodes if the `WI-` prefix was missing or inconsistently formatted, breaking the dependency tracking in the Roadmap.

### Decision

Completely abolish the fractional sub-item notation and implement hard validation checks within the management scripts:
1. **Flattened IDs**: All work items must strictly follow the `WI-####` format (e.g., `WI-55`, `WI-57`).
2. **Decoupled Grouping**: Parent-child logic between tasks is expressed via the `dependencies` field and `Feature Group` categorization, rather than ID numbering.
3. **Mandatory Validation**: `manage-wi.js` will terminate with an error if an non-compliant ID is manually entered.

### Consequences

- Resolved the bug causing Roadmap rendering breakage.
- Simplified the processing logic across all automation tools, improving system scalability.
- Reduced the risk of data contamination by AI agents when creating new Work Items.
