---
name: System Architecture
description: "Core system architecture, UI layout rules, and component hierarchies. Load this skill when designing a new feature or determining how components and services interact to avoid architectural violations."
---

# System Architecture & Specifications

> [!IMPORTANT]
> **Exclusion Boundaries:** This skill does NOT define DAP protocol payloads, state machine lifecycles, or exact CSS variable tokens. For those, consult `dap-implementation`, `state-management`, or `visual-design` skills.

## Core Architectural Axioms

1. **Three-Layer Pattern**: The system strictly separates concerns into:
   - **UI Layer** (Angular Components: pure UI rendering, logging, data-binding).
   - **Session Layer** (`DapSessionService`: DAP state machine, logical event handling).
   - **Transport Layer** (WebSocket/IPC/Serial: strict binary communication).
2. **No Cross-Layer Coupling**: UI Components must **NEVER** bypass the Session Layer to access Transport connections directly. Services must not store view-specific DOM states.
3. **Primary Layout Structure** (`/debug` view -> `mat-sidenav-container`):
   - **Left**: File tree logic (`loadedSources`, `mat-nav-list`).
   - **Center**: Monaco Editor (`app-editor`), occupying remaining space.
   - **Right**: Variable context and Call Stack (`mat-tree`, virtual scrolling).
   - **Bottom**: Status Bar and Console (`app-log-viewer`).
4. **Transport Fail-Fast Policy**: If the WebSocket layer detects an invalid DAP packet header, the entire message bus is permanently terminated to prevent misaligned streams.
5. **Source Content Memory Handling**: Source string contents (`source` requests) are cached in memory via LRU (20MB limit). Persistence to `localStorage` across sessions is prohibited.

## Detailed Source Documents

Consult these files via `view_file` **only** when deep context is strictly required:

- 👉 **`docs/system-specification.md`**: Component behavior, Web/Electron deployment modes, UI Layout boundaries, and supported DAP subsets.
- 👉 **`docs/architecture.md`**: Master architecture index (Mermaid diagrams) and routing to specific layer-behaviors (error-handling, command-serialization).
- 👉 **`docs/file-map.md`**: Source of truth for locating features, components, and module structures.
