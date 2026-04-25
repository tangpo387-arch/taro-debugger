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
| **View** | Toggle Explorer, Toggle Inspection, Toggle Console, Reset Layout | `Ctrl+B`, `Ctrl+Shift+I`, `Ctrl+` ` |
| **Debug** | Continue, Pause, Step Over, Step Into, Step Out, Restart, Stop | `F5`, `F6`, `F10`, `F11`, `Shift+F11`, `Shift+F5` |
| **Help** | Documentation, About Taro | — |

**Platform Specifics:**

- **macOS**: Menu is set via `Menu.setApplicationMenu`. Includes standard app menu.
- **Windows/Linux**: Menu is integrated into the frame; supports `Alt` toggle.

### 2. Top Control Bar (Angular mat-toolbar)

The primary interaction hub, styled as a sharp, flush surface.

- **Background**: `var(--mat-sys-surface)`
- **Border**: `border-bottom: 1px solid var(--mat-sys-outline-variant)`
- **Height**: `--sys-density-toolbar-height` (40px/48px)

#### A. Sidebar Toggle (Left)

Icon button (`menu` or `menu_open`) to toggle the Left Sidenav.

#### B. Debug Execution Controls (Center)

The execution controls are horizontally centered in the toolbar. This section integrates a status indicator into the existing `DebugControlGroupComponent`.

- **Status LED**: 6px dot at the far left providing high-frequency session feedback.
  - **Tooltip**: MUST implement a dynamic `[title]` attribute reflecting the current text-based state (e.g., `"Paused"`, `"Running"`).
  - `Running`: `var(--mat-sys-tertiary)`, 2s pulse.
  - `Paused`: `var(--mat-sys-secondary)`, static.
  - `Idle/Error`: `var(--mat-sys-outline)` / `var(--mat-sys-error)`, static/fast-pulse.

#### C. Layout & Session Controls (Right)

- **Panel Toggles**: Icons for Right Sidenav and Bottom Console visibility. Active state shows `primary` highlight.
- **Close Session**: Disconnects the session and returns to `/setup`. (Visible in Web mode only; Electron users use the native menu).

## Acceptance Criteria

- [ ] Electron native menu is implemented and correctly calls `ActionID` events in the frontend.
- [ ] Top toolbar background and borders match the "Flush IDE" visual standard.
- [ ] Debug Execution Controls (buttons + LED) are horizontally centered.
- [ ] Status LED pulse animation is only active when `executionState` is `running` or `starting`.
- [ ] Status LED implements a dynamic tooltip reflecting the current text-based state.
- [ ] The redundant "State: <state>" label is removed from the bottom status bar to reduce UI clutter.
- [ ] Close Session button is hidden in Electron mode and visible in Web mode.
- [ ] Layout toggle buttons on the right correctly reflect the current visibility of the side/bottom panels.
