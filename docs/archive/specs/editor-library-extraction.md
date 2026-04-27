---
title: Library Extraction: EditorComponent
scope: Editor Features
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Library Extraction: EditorComponent (WI-65)

> [!NOTE]
> **Source Work Item**: Library Extraction: EditorComponent
> **Description**: Extract the Monaco-based EditorComponent into a dedicated library @taro/ui-editor to improve modularity and build isolation.

## Purpose

The Monaco-based `EditorComponent` is one of the most complex UI elements in the project, handling syntax highlighting, breakpoint management, and execution context visualization. Extracting it into a dedicated library `@taro/ui-editor` aims to:
- **Improve Modularity**: Clearly separate the editor's internal logic from the main application's layout management.
- **Isolate Build Complexity**: Faster rebuilds for the main application when editor logic is stable.
- **Enable Reusability**: Potential for reusing the editor component in other hosts or future features (like a standalone file viewer).

## Scope

### Included

- Creation of `@taro/ui-editor` library under `projects/ui-editor`.
- Relocation of `editor.component.ts`, `editor.component.html`, and `editor.component.scss`.
- Relocation of `EditorViewState` interfaces and persistence logic (per `editor-view-state-spec.md`).
- Migration of Monaco-specific model management logic and typings.
- Configuration of the library's `public-api.ts` to export necessary components and types.
- Updating `DebuggerComponent` to import and use the library component.

### Excluded

- Modification of `ngx-monaco-editor-v2` configuration in the root application (unless necessary for project boundaries).
- Changes to `DapSessionService` or `DapFileTreeService`.

## Behavior

### 1. Library Export

- The library will export `EditorComponent` via its module/standalone entry point.
- Selector remains `app-editor`.

### 2. Integration Pattern

- `DebuggerComponent` will interact with `EditorComponent` via standard Angular `@Input()` and `@Output()` properties:
  - `filename`: path to the file to display.
  - `activeLine`: line to highlight for execution context.
  - `revealTrigger`: incrementing counter to force viewport reset.
  - `breakpoints`: list of active breakpoints for the file.
  - `@Output() breakpointChange`: emitted when user toggles a breakpoint in the glyph margin.

### 3. Build & Packaging

- The library will be built using `ng-packagr` as per standard Angular monorepo patterns.
- `tsconfig.json` paths in the workspace root will be updated to map `@taro/ui-editor` to `projects/ui-editor/src/public-api`.

## Acceptance Criteria

- [ ] `@taro/ui-editor` library is created and exports `EditorComponent`.
- [ ] `DebuggerComponent` consumes `@taro/ui-editor` via library import.
- [ ] Mono-editor initialization occurs correctly within the library context.
- [ ] [Test] Source code rendering: Opening a file correctly loads and displays content with appropriate language highlighting.
- [ ] [Test] Breakpoint interaction: Clicking in the glyph margin toggles breakpoints and notifies the host correctly.
- [ ] [Test] Execution context: Stepping through code correctly highlights the current line and scrolls into view.
- [ ] [Test] View state: Switching between files preserves cursor positions (if implemented per `editor-view-state-spec.md`).
- [ ] [Test] Build verification: `npm run build` succeeds for the entire workspace.
