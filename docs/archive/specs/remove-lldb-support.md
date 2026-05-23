---
title: Remove LLDB Support and References
scope: General
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Remove LLDB Support and References (WI-131)

> [!NOTE]
> **Source Work Item**: Remove LLDB Support and References
> **Description**: Remove all source code references, documentations, specifications, and work item definitions related to LLDB integration, ensuring Taro Debugger solely supports GDB DAP.

## Purpose

Taro Debugger has finalized its product scope to exclusively support GDB DAP integration. This decision simplifies the protocol translation layer, eliminates multi-debugger compatibility testing, and optimizes project maintenance. This specification outlines the removal of active references to LLDB (and `lldb-dap`) from the active codebase, user guides, manual verification guides, and architectural designs, while keeping historical/archived reviews, specifications, and the primary work items database untouched.

## Scope

### In Scope
- Removing user-facing references to LLDB in the root `README.md`.
- Modifying active architectural design documents under `docs/architecture/` (excluding `docs/archive/`) to replace or remove references to LLDB.
- Updating active guides under `docs/guides/` to focus exclusively on GDB.
- Updating manual verification guides under `docs/tests/` to exclusively reference GDB.
- Verifying all active documentation files pass internal linting via `npm run lint:docs`.

### Out of Scope
- Modifying any files under `work-items/` (specifically `work-items/dap-transport-layer.json` and its definition of `WI-09`).
- Modifying historical specs, review packages, or documents located under `docs/archive/` (except this newly created specification).
- Modifying primary Angular frontend codebase, as standalone components and services are already debugger-agnostic and default to GDB adapter configuration.

## Behavior

- **Active Documentation & UI Guides**: Every guide, FAQ, or design document in the active workspace will instruct the user to configure and run GDB as the sole supported debug engine.
- **WebSocket Bridge**: Although `WI-09`'s database description remains unchanged, the actual implementation of the bridge in future phases will exclusively target GDB.

## Acceptance Criteria

- [ ] All instances of the terms "lldb" and "lldb-dap" (case-insensitive) are removed or replaced with GDB in the root `README.md`.
- [ ] Active guides (`docs/guides/*.md`), tests (`docs/tests/*.md`), and system specs (`docs/project/*.md`) are cleaned of all LLDB references.
- [ ] Active architecture docs (`docs/architecture/**/*.md`) are cleaned of all LLDB references.
- [ ] Files under `work-items/` and `docs/archive/` (except `docs/archive/specs/remove-lldb-support.md`) remain completely untouched.
- [ ] Running `npm run lint:docs` succeeds with zero errors.
