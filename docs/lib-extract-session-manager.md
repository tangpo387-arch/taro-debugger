---
title: Lib: Extract Session Manager
scope: Session Layer
audience: [Lead_Engineer, Quality_Control_Reviewer, Product_Architect]
related:
  - work-items.md
  - file-map.md
  - dap-core-library-spec.md
---

# Specification: WI-61 Extract Session Manager

**Status**: Completed
**Progress**: 100%

## 1. Purpose

Relocate the `DapSessionService` and `DapConfigService` from the Angular application to the `@taro/dap-core` library. This ensures that the session lifecycle and configuration management are framework-agnostic and reusable.

## 2. Structural Changes

### 2.1 Service Relocation

The following files will be moved from `projects/taro-debugger-frontend/src/app/` to `projects/dap-core/src/lib/session/`:
- `dap-session.service.ts`
- `dap-session.service.spec.ts`
- `dap-config.service.ts`
- `dap-config.service.spec.ts`

### 2.2 Library Integration

- **Provider**: `projects/dap-core/src/lib/dap-core.provider.ts` will be updated to include these services.
- **Exports**: `projects/dap-core/src/public-api.ts` will export the services for application use.

### 2.3 Dependency Injection

The application will consume these services via the `@taro/dap-core` package. Injection in components will remain unchanged in syntax (using `inject(DapSessionService)`) but the import path will change from local to library.

## 3. Behavior & State

- **executionState$**: Must remain stable and reactive. Components depending on this stream should not require logic changes.
- **Event Bus**: The library-level event bus must correctly propagate DAP events (e.g., `stopped`, `terminated`) to the UI layer.

## 4. Acceptance Criteria

1. **Migration Integrity**: Files are moved to the correct library directory.
2. **Build Success**: `ng build dap-core` and `npm run build` (app) both pass.
3. **Test Parity**: All unit tests for moved services pass in the library context.
4. **Functional Verification**: [Test] UI correctly reflects session state changes and responds to stepping commands.
