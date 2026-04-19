---
title: VS Code Compatible Keyboard Shortcuts Specification
scope: ux, keyboard, shortcut, global-events
audience: [Human Engineer, Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
tech_stack:
  angular: 21
  rxjs: "~7.8.0"
---

# VS Code Compatible Keyboard Shortcuts Specification

> [!IMPORTANT]
> **Exclusion Boundaries:** Does not cover custom user-defined keybinding configuration. Prescribes exclusively the default VS Code-compatible map.

## 1. Purpose

Provide global IDE-like keyboard shortcuts (F5-F11) to control the debug session and interact with the editor without relying on the UI toolbar.

## 2. Scope

- **Included**: Global `keydown` interception, Action ID mapping, Angular zone performance optimization, and Monaco editor integration for F9.
- **Excluded**: User-configurable shortcuts, Vim keybindings, or a command palette interface.

## 3. Behavior

### 3.1 Shortcut Mapping

| Shortcut Key | Modifiers (Win/Linux) | Modifiers (macOS) | Action ID | Action Description |
| :--- | :--- | :--- | :--- | :--- |
| **F5** | None | None | `debug.continue` | Resume execution |
| **Shift + F5** | Shift | Shift | `debug.stop` | Stop debugger |
| **F5** | Ctrl + Shift | Cmd + Shift | `debug.restart` | Restart debugger |
| **F6** | None | None | `debug.pause` | Pause execution |
| **F9** | None | None | `editor.toggleBreakpoint` | Toggle breakpoint at cursor |
| **F10** | None | None | `debug.stepOver` | Step over line |
| **F11** | None | None | `debug.stepInto` | Step into function |
| **Shift + F11** | Shift | Shift | `debug.stepOut` | Step out of function |

### 3.2 Performance & Zone Bounds

To prevent significant performance degradation across the application (Change Detection firing on every keystroke):
- The global `keydown` event listener must be bound outside the Angular Zone.
- Re-entry to the Angular Zone occurs strictly upon successful `ActionID` identification.

```typescript
// ✅ Preferred: optimized global listener pattern
this.ngZone.runOutsideAngular(() => {
  fromEvent<KeyboardEvent>(window, 'keydown', { capture: true }).subscribe(...)
});
```

### 3.3 Event Focus Guards

Standard browser shortcuts are suppressed using `event.preventDefault()` exclusively when an action match occurs. To maintain standard UX:
- All debug shortcuts are strictly ignored if the active focus target is a standard HTML `<input>` or `<textarea>`.
- **Monaco Whitelist Exception**: The Monaco Editor uses a hidden `<textarea class="inputarea">` to intercept user typing. This specific DOM element is exempted from the guard to ensure shortcuts (especially F9/F10) trigger seamlessly while the user is actively navigating source code.

## 4. Acceptance Criteria

- [ ] Pressing F5 resumes execution properly routed to the session layer.
- [ ] Pressing F10 steps over the current line properly routed to the session layer.
- [ ] Pressing F9 toggles a breakpoint at the current Monaco editor cursor position using `toggleBreakpointAtCurrentPosition`.
- [ ] Typing standard alphanumeric keys within the Monaco Editor does not trigger an Angular change detection cycle.
- [ ] Pressing F10 while actively focused within a log viewer evaluation `<input>` ignores the debug shortcut assignment.
