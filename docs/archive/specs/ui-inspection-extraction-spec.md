---
title: UI Library: Extract @taro/ui-inspection
scope: Variables & Call Stack
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# UI Library: Extract @taro/ui-inspection (WI-73)

> [!NOTE]
> **Source Work Item**: UI Library: Extract @taro/ui-inspection
> **Description**: Move Variables, Call Stack, and their supporting service to a dedicated UI library for better modularity.

## Purpose

The primary goal is to enforce the **Three-Layer Pattern** by modularizing the UI components responsible for execution state inspection. By moving the `VariablesComponent` and `CallStackComponent` into a dedicated library (`@taro/ui-inspection`), we reduce the complexity of the `taro-debugger-frontend` shell and establish a reusable pattern for future inspection panels (e.g., Threads, Breakpoints).

## Scope

This Work Item covers:
- Creation of the `@taro/ui-inspection` secondary library in the Angular workspace.
- Relocation of existing `VariablesComponent`, `CallStackComponent`, and `DapVariablesService`.
- **New Home for Inspection Panels**: Establishing this library as the target for `ThreadsComponent` (WI-70) and `BreakpointsComponent` (WI-71) to ensure consolidated inspection logic.
- Updating `projects/taro-debugger-frontend/src/app/debugger.component.ts` to import these from the new library.
- Migrating associated unit tests (`*.spec.ts`) and ensuring test runner compatibility.

## Behavior

This is both a **structural refactor** and an **architectural anchor**.
- **Refactor**: Variables and Call Stack behavior remains unchanged.
- **Anchor**: Provides the baseline for implementing the and Threads (WI-70) and Breakpoints (WI-71) panels within a dedicated library context.

## Acceptance Criteria

- [ ] Command `ng generate library ui-inspection --prefix taro` (or equivalent) has been executed successfully.
- [ ] `projects/ui-inspection/` contains the migrated components and services.
- [ ] `public-api.ts` in the new library exports all necessary symbols.
- [ ] `DebuggerComponent` is successfully refactored to use components from `@taro/ui-inspection`.
- [ ] `npm run test -- projects/ui-inspection` passes with 100% success.
- [ ] `npm run start` launches without bundle errors or component-not-found errors.
