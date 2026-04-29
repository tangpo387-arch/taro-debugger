---
title: Debug Console Input Integration & Output Redirection
scope: Console & Status Bar
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Debug Console Input Integration & Output Redirection (WI-92)

> [!NOTE]
> **Source Work Item**: Debug Console Input Integration & Output Redirection
> **Description**: Integrate evaluate input into console stream and redirect output to program logs.

## Purpose

Standardize the debug console experience by moving away from form-style input fields toward a terminal-integrated interaction model. This simplifies the UI and ensures that evaluation results and errors are captured directly within the Debug Console's logical flow, providing a more cohesive debugging experience without intrusive UI elements like toast notifications.

## Scope

- **UI Components**: `DebugConsoleComponent` (projects/ui-console/src/lib/debug-console/)
- **Services**: `DapLogService` (projects/ui-console/src/lib/dap-log.service.ts)
- **Styling**: `debug-console.scss`

## Behavior

1. **Input Integration**:
   - Fixed footer styling removed from `.console-input-area` to create a flush, terminal-like layout.
   - All interactive widgets (Send/Cancel buttons, spinners, icons) removed in favor of a lean `>` prompt.
   - Input field is seamlessly integrated into the scrollable log stream.
2. **Output & Protocol Integration**:
   - **Command Mirroring**: Every evaluation request is mirrored as a `> expression` log entry in the console.
   - **Protocol Redirection**: Evaluation results and errors are streamed directly to `DapLogService`.
   - **Silent Protocol (R7.1)**: `DapSessionService` implements a `silentError` flag for the `evaluate` command. This suppresses the global `_dapError` event emission, preventing redundant system logs and intrusive `MatSnackBar` toasts while allowing local, clean error formatting in the console.
3. **Reactive State & UX**:
   - **In-flight Handling**: Input field transitions to a `.in-flight` state (opacity: 0.7, cursor: wait) during processing.
   - **Auto-Clear**: The input field is guaranteed to clear via the `finally` block after every execution (success or error).
4. **Interaction & Accessibility**:
   - **Hotkey Focus**: `Ctrl + Shift + Y` (VS Code standard) focuses the console, opening the panel and switching to the correct tab if necessary.
   - **Shortcut Whitelisting**: Global debug shortcuts (F5, F10, F11) are whitelisted while focused on the console input, ensuring seamless stepping without losing focus.

## Acceptance Criteria

- [x] Evaluation input bar has no distinct background or border-top (flush layout).
- [x] Send and Cancel buttons are removed.
- [x] Pressing `Enter` in the input field triggers the evaluation.
- [x] Successful evaluation results appear in the "Debug Console" stream.
- [x] Evaluation errors (timeouts, etc.) appear in the "Debug Console" stream as red text.
- [x] No `MatSnackBar` (toast) is shown during evaluation failures (handled via `silentError`).
- [x] `Ctrl + Shift + Y` successfully focuses the console input.
- [x] Function keys (F10, F11) remain active while the console input is focused.
- [x] Input text uses a distinct color (`var(--mat-sys-primary)`) to separate it from history logs.
- [x] Input field is cleared automatically after every command attempt.
