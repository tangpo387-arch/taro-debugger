---
title: Convert to Angular Workspace
scope: General
audience: [Lead_Engineer, Quality_Control_Reviewer, Product_Architect]
related:
  - work-items.md
  - file-map.md
---

# Convert to Angular Workspace (WI-57 - WI-58)

> [!NOTE]
> **Source Work Items**: WI-57, WI-58
> **Description**: Phased transition of the project to a monorepo structure.

## Purpose

To prepare the repository for multi-project development. A monorepo structure (Standard Angular Workspace) allows for:
- **Project Isolation**: Clear separation between the UI application and reusable libraries.
- **Shared Configuration**: Centralized management of linting, testing, and workspace dependencies.
- **Future Growth**: Easy addition of new sub-projects (e.g., CLI, different adapters).

## Scope

### Structural Changes

- **Directory Migration**: Move existing application source (`src/`) and assets to `projects/taro-debugger-frontend/`.
- **Configuration Rooting**: Relocate `tsconfig.app.json` and `tsconfig.spec.json` to the project root.
- **Path Remapping**: Update `angular.json` paths from relative roots to project-specific paths.

### Dependency Updates

- **Package Scripts**: Update `npm start`, `build`, and `test` scripts to target the specific project if necessary.
- **Electron Integration**: Ensure the `electron-builder` and `tsc` commands point to the new source and distribution locations.

## Behavior

- **Workspace Defaults**: The primary application remains reachable via standard commands, utilizing the `defaultProject` setting in `angular.json`.
- **Output Management**: Build artifacts will move to `dist/taro-debugger-frontend/`.

## Acceptance Criteria

1. **Development Server**: `npm start` launches the application correctly in search of the new source path.
2. **Desktop Mode**: `npm run electron:dev` successfully builds the TypeScript main process and loads the Angular bundle from the new `dist/` path.
3. **Test Integrity**: Universal unit tests (`npm run test`) execute correctly across the new project structure.
4. [Test] **Workspace Validation**: Run `ng generate library test-lib` to confirm the workspace structure correctly initializes and builds a secondary project.
