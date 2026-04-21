---
title: Architecture - Monorepo Standards
scope: monorepo, build, tsconfig, libraries
audience: [Human Engineer, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-21
---

# Monorepo Build & Resolution Standards

This document defines the architectural standards for managing the workspace structure, library resolution, and build-time constraints within the taro-debugger monorepo.

## 1. Library Resolution Strategy: Binary-Linked (Dist-Based)

As of April 2026, the project has transitioned from Source-Linked to **Binary-Linked (Dist-Based)** path mappings for all internal `@taro/*` libraries.

### 1.1 Decision: Use `./dist/` over `./projects/*/src/public-api.ts`

To ensure compiler stability and enforce strict modularity, all internal libraries must be resolved via their compiled artifacts in the `dist` folder.

| Feature | Requirement | Reason |
| :--- | :--- | :--- |
| **In-Workspace Resolution** | `tsconfig.json` paths must point to `./dist/<lib-name>` | Bypasses `ngtsc` internal reference tracking bugs in Angular 21/TS 5.9. |
| **Contract Enforcement** | Only symbols in `public-api.ts` are accessible | Prevents "module bleed" where internal implementation details are accidentally consumed. |
| **Build Prerequisite** | Libraries must be built before the consumer builds | Ensures that only valid, packagable libraries are integrated into the application. |

### 1.2 Impact on Development Workflow

1. **Fresh Workspace**: After a clean clone or `dist` sweep, you must run a full library build:
   `npx ng build dap-core && npx ng build ui-editor && npx ng build ui-console && npx ng build ui-assembly && npx ng build ui-inspection`
2. **Active Library Development**: When modifying a library, use `--watch` to maintain the `dist` artifact:
   `ng build <lib-name> --watch`
3. **Application Serve**: The `ng serve` command remains the entry point for frontend development but depends on the presence of existing `dist` bundles for all imported `@taro/*` modules.

## 2. Dependency Hierarchy

To avoid circular dependencies and ensure a stable build order, libraries should follow this hierarchical dependency model:

1. **Core Domain Layer**: `@taro/dap-core` (No internal dependencies)
2. **Shared UI Utilities**: `@taro/ui-shared` (Future), `@taro/ui-editor`
3. **Functional UI Layers**: `@taro/ui-console`, `@taro/ui-assembly`, `@taro/ui-inspection`
4. **Application Layer**: `taro-debugger-frontend` (Consumes all of the above)

---

## 3. Exclusion Boundaries

- This document does NOT cover the implementation logic of the libraries (see specific `docs/architecture/*.md` files).
- This document does NOT cover the CI/CD pipeline configuration (see GitHub Actions or specific build scripts).

[Diagram: Dependency Flow — Application depends on dist artifacts of Libraries, which depend on core domain.]
