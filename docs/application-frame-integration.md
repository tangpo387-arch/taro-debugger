---
title: Application Frame & Global Controls Integration
scope: UI System Design
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
related:
  - work-items.md
  - architecture/visual-design.md
---

# Application Frame & Global Controls Integration (WI-81)

> [!NOTE]
> **Source Work Item**: Application Frame & Global Controls Integration
> **Description**: Implement a unified Electron native menu bar and a refined Angular top control bar following Flush IDE aesthetics.

## Purpose

The Taro Debugger requires a unified global control surface that bridges the gap between the native desktop environment (Electron) and the internal web-based UI (Angular). This specification defines the structural and visual rules for the application's top-level frame to maximize information density while maintaining a premium "Flush IDE" aesthetic.

## Scope

- **Electron Layer**: Implementation of the native menu bar for macOS, Windows, and Linux.
- **UI Layer (Angular)**: Refinement of the `DebuggerComponent` top toolbar and `DebugControlGroupComponent` capsule.
- **Communication**: Mapping of native menu actions to Angular service calls via IPC and Keyboard Shortcuts.

## Behavior

### 1. Electron Native Menu Bar

A standard native menu hierarchy is implemented to offload secondary operations.

| Menu | Actions | Shortcut (Primary) |
| :--- | :--- | :--- |
| **File** | New Debug Session, Close Session, Exit | `Ctrl+W` |
| **Edit** | Undo, Redo, Cut, Copy, Paste, Select All | Standard |
| **View** | Toggle Explorer, Toggle Inspection, Toggle Console, Reset Layout | `Ctrl+B`, `Ctrl+Alt+B`, `Ctrl+` ` |
| **Debug** | Continue, Pause, Step Over, Step Into, Step Out, Restart, Stop | `F5`, `F6`, `F10`, `F11`, `Shift+F11`, `Cmd+Shift+F5`, `Shift+F5` |
| **Help** | Documentation, About Taro | — |

**Platform Specifics:**

- **macOS**: Menu is set via `Menu.setApplicationMenu`. Includes standard app menu.
- **Windows/Linux**: Menu is integrated into the frame; supports `Alt` toggle.

### 2. Top Control Bar (Angular mat-toolbar)

The primary interaction hub, styled as a sharp, flush surface.

- **Background**: `var(--mat-sys-surface)`
- **Border**: `border-bottom: 1px solid var(--mat-sys-outline-variant)`
- **Height**: `--sys-density-toolbar-height` (40px/48px)

#### A. Session Identity (Left)

Displays the currently loaded executable path.
- **Bidi Protection**: MUST include LRM (`\u200E`) and `&lrm;` for Unix paths.

#### B. Debug Execution Controls (Center)

The execution controls are horizontally centered in the toolbar. This section integrates a status indicator into the existing `DebugControlGroupComponent`.

- **Status LED**: 6px dot at the far left providing high-frequency session feedback.
  - **Tooltip**: Dynamic `[title]` reflecting current state.
  - `Running`: `var(--mat-sys-tertiary)`, 2s pulse.
  - `Paused`: `var(--mat-sys-secondary)`, static.
  - `Idle/Error`: `var(--mat-sys-outline)` / `var(--mat-sys-error)`, static/fast-pulse.

#### C. Layout Controls (Right)

All panel visibility toggles are grouped here. 
- **Visibility**: These buttons MUST be hidden in **Electron mode** as they are redundant with the native menu.
- **Explorer Toggle**: Icon `menu`. Toggles the left sidebar.
- **Inspection Toggle**: Icon `vertical_split`. Toggles the right sidebar.
- **Console Toggle**: Icon `terminal`. Toggles the bottom console.

## Acceptance Criteria

- [ ] Electron native menu is implemented and correctly calls `ActionID` events in the frontend.
- [ ] Top toolbar background and borders match the "Flush IDE" visual standard.
- [ ] Debug Execution Controls (buttons + LED) are horizontally centered.
- [ ] **All layout toggle buttons (Explorer, Inspection, Console) are grouped in the right section.**
- [ ] **All layout toggle buttons are hidden in Electron mode.**
- [ ] **Toggle buttons and Native Menu items reflect the current panel visibility state (checked/active).**
- [ ] **Inspection toggle shortcut is updated to `Ctrl+Alt+B` (Secondary Sidebar pattern).**
- [ ] Status LED pulse animation is only active when `executionState` is `running` or `starting`.
- [ ] **The redundant execution state text is completely removed from the bottom status bar.**
