---
title: Research: Portable Debug Session Persistence (.zip)
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
type: Feature Spec
status: research-complete
---

# Research: Portable Debug Session Persistence (.zip)

## Purpose

This document defines the architecture and data schema for preserving a debug session's state in a portable ZIP archive. This allows developers to share "debug contexts" (notes, breakpoints, and launch parameters) or resume complex debugging sessions across different environments.

## Scope

* **In-Scope**: Persistence of breakpoints, symbolic watchpoints, launch configurations, binary metadata (UUID), and multi-document markdown notes.
* **Out-of-Scope**: Source code snapshots, core dump inclusion, memory heap snapshots, and local/stack-based watchpoints.

## Behavior & Design Decisions

### 1. The ZIP Container Structure

The archive uses a standard `.zip` format with the following internal layout:
* `metadata.json`: The core index containing session orchestration data.
* `breakpoints.json`: DAP-compatible breakpoint and data-breakpoint definitions.
* `notes/`: A directory containing one or more `.md` files.
  * `index.md`: The primary entry point for session notes.

### 2. Binary Identity & Integrity (Build-ID)

To prevent "Context Drift," the session is tied to the specific build of the executable.
* **Requirement**: Extract the `GNU Build-ID` (ELF), `UUID` (Mach-O), or `Debug Directory GUID` (PE) from the target binary.
* **Validation**: On import, the system MUST compare the stored UUID with the UUID of the active executable.
* **Decision**: Mismatched UUIDs trigger a **Strict Warning**. The user must explicitly acknowledge the risk before importing state into a different binary build.

### 3. Watchpoint Persistence (Symbolic Expressions)

Memory addresses are transient and affected by ASLR; therefore, absolute addresses are **forbidden** in the persistence schema.
* **Strategy**: Store watchpoints as **Symbolic Expressions** (e.g., `&global_config.status`).
* **Scope Restriction**: Only **Global** or **Static** symbols are eligible for persistence. Local stack variables are excluded as their lifecycle is tied to a specific transient frame.
* **Re-hydration**: On session resume, the system issues a `dataBreakpointInfo` request for each expression to obtain a fresh `dataId` before calling `setDataBreakpoints`.

### 4. Launch Configuration & "Continue" Logic

To allow seamless session resumption, the ZIP includes the launch parameters.
* **Content**: The full JSON object used for the `launch` or `attach` request.
* **Path Handling**: Paths within the launch configuration are normalized to **relative paths** whenever the target resides within the same root directory as the session ZIP.

## Data Schema (metadata.json)

```json
{
  "schema_version": "1.0",
  "identity": {
    "executable_name": "taro_server",
    "uuid": "a1b2c3d4-e5f6-g7h8...",
    "format": "elf-build-id"
  },
  "launch_config": {
    "request": "launch",
    "program": "./bin/taro_server",
    "args": ["--debug"],
    "cwd": "."
  },
  "session_summary": {
    "created_at": "2026-05-01T10:55:00Z",
    "active_thread_count": 1
  }
}
```

## Acceptance Criteria

1. **Integrity**: ZIP files without a valid `metadata.json` are rejected with a descriptive error.
2. **Stability**: Watchpoints correctly re-resolve to new addresses in a fresh execution run with ASLR enabled.
3. **Portability**: A ZIP created on one machine can be successfully imported on another machine if the relative paths to the executable remain valid.
4. **Note Integration**: Markdown files in the `notes/` directory are automatically rendered in the UI upon import.

[Diagram: Persistence Flow — Export serializes live DapSession state -> Archive creation -> Import validates UUID -> Re-hydrates breakpoints -> Launches target.]
