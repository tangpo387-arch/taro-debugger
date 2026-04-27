---
title: Architecture - Editor Component (@taro/ui-editor)
scope: ui-editor, monaco, view-state, breakpoints
audience: [Human Engineer, Lead_Engineer, Product_Architect, Quality_Control_Reviewer]
last_updated: 2026-04-28
related:
  - architecture/core/breakpoint-system.md
  - architecture/ui-shared.md
---

# Editor Component

The `@taro/ui-editor` library provides the primary source code inspection interface using Monaco Editor (`ngx-monaco-editor-v2`).

## 1. Responsibilities

- **Source Visualization**: Renders file content with syntax highlighting and line numbers.
- **Breakpoint Interaction**: Provides the gutter (glyph margin) for toggling breakpoints.
- **Execution Context**: Highlights the "Active Line" where the current thread is suspended.
- **View State Persistence**: Remembers scroll positions and cursor selections per file.

## 2. Integration Interface

The host application (`DebuggerComponent`) interacts with the editor via standard property binding:

| Input | Type | Description |
| :--- | :--- | :--- |
| `filename` | `string` | Absolute path to the source file. |
| `activeLine` | `number` | Line to highlight with the execution pointer. |
| `revealTrigger` | `number` | Incrementing counter to force scrolling to the active line. |
| `breakpoints` | `number[]` | List of lines with active breakpoints. |

| Output | Event | Description |
| :--- | :--- | :--- |
| `breakpointChange` | `number[]` | Emitted when a breakpoint is added/removed in the gutter. |

## 3. View State Persistence

To ensure a seamless navigation experience, the component maintains a volatile cache of editor states.

### 3.1 Persistence Rules

- **State Storage**: Uses `Map<string, ICodeEditorViewState>` keyed by absolute file path.
- **Save Trigger**: When `filename` changes, the current state is saved for the previous file.
- **Restore Trigger**: When a file is loaded, the saved state is applied.
- **Navigation Priority**:
  - **Passive** (File Tree click): Saved view state takes precedence over `activeLine`.
  - **Active** (Breakpoint hit/Stepping): The `activeLine` reveal **overrides** the saved view state to ensure the execution context is visible.

## 4. Breakpoint Management (UI)

The editor handles "Jitter Filtering" for breakpoint interactions.
- Gutter clicks are debounced locally (150ms) to prevent protocol flooding.
- Visual markers are updated optimistically to maintain UI responsiveness.

---

## 5. Constraints & Exclusions

- **Session Scoped**: View states are cleared when the debug session ends or the app reloads.
- **No Disk Sync**: If file content changes on disk externally, cursor positions may drift until the file is re-fetched.
