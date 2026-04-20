---
title: Library Extraction: AssemblyViewComponent
scope: Low-Level Inspection
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Library Extraction: AssemblyViewComponent (WI-66)

> [!NOTE]
> **Source Work Item**: Library Extraction: AssemblyViewComponent
> **Description**: Extract the AssemblyViewComponent into a dedicated library @taro/ui-assembly to isolate specialized disassembly rendering logic.

## Purpose

Modularize the codebase by extracting assembly-specific UI and logic into a dedicated library `@taro/ui-assembly`. This improves build times, test isolation, and enforces a strict separation between the main debugger orchestration and specialized low-level inspection tools.

## Scope

- **New Library**: Create `projects/ui-assembly` as a standalone Angular library.
- **Relocation**:
  - `AssemblyViewComponent` (and its `.html`, `.scss`).
  - `DapAssemblyService`.
  - `TaroDisassembledInstruction` interface.
- **Dependency Management**:
  - Peer dependencies: `@angular/core`, `@angular/common`, `@angular/cdk/scrolling`, `@angular/material/icon`, `@angular/cdk/layout`, `@taro/dap-core`, `@taro/ui-editor`.
- **Refactoring**:
  - Update `DebuggerComponent` to import from `@taro/ui-assembly`.
  - Remove local copies of assembly files from `projects/taro-debugger-frontend/src/app/`.

## Behavior

- **State Management**: `DapAssemblyService` will be moved to the library. It will remain responsible for fetching and normalizing DAP instruction data.
- **Responsive Layout**: The component continues to use `LAYOUT_COMPACT_MQ` from `@taro/ui-editor` to adjust instruction row heights (24px vs 28px).
- **Virtual Scrolling**: The `ResizeObserver` logic in `ngAfterViewInit` must be preserved to ensure the `cdk-virtual-scroll` viewport correctly calculates its size when the parent `<mat-tab>` becomes active.
- **Sticky Symbols**: The sticky header logic for function symbols must remain intact.

## Acceptance Criteria

### 1. Library Integrity

- [ ] `ng build ui-assembly` completes without errors.
- [ ] `package.json` for `@taro/ui-assembly` correctly lists peer dependencies.
- [ ] `public-api.ts` exports `AssemblyViewComponent` and `DapAssemblyService`.

### 2. Functional Parity

- [ ] Disassembly tab in the main application renders instructions correctly.
- [ ] Sticky headers show the current function name during scroll.
- [ ] The active instruction pointer (IP) is highlighted and automatically scrolled into view.
- [ ] Virtual scroll viewport does not show blank space after switching tabs (verified `checkViewportSize` trigger).

### 3. Architecture

- [ ] `AssemblyViewComponent` is NOT declared or provided locally in `DebuggerComponent`.
- [ ] `DapAssemblyService` is provided either at the library level or via `provideDapAssembly()` if a provider factory is created.
- [ ] No circular dependencies between `@taro/ui-editor` and `@taro/ui-assembly`.

## Technical Implementation Notes

- Use `ng generate library ui-assembly --prefix app` to maintain consistency (or the project's preferred prefix).
- Ensure `tsconfig.json` paths are updated to include `@taro/ui-assembly`.
- The `DapAssemblyService` should likely be provided "in root" or via a library-specific provider to ensure singleton behavior within the library's context if needed, though `DebuggerComponent` currently provides it manually.
