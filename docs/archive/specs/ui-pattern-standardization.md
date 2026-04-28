---
title: Standardization of UI Patterns
scope: UI System Design
audience: [Human Engineer, Agent Role Play]
related:
  - work-items.md
---

# Standardization of UI Patterns (WI-74)

> [!NOTE]
> **Source Work Item**: Standardization of UI Patterns
> **Description**: Consolidate duplicated UI components, SCSS tokens, and shared Angular utilities into a unified internal library.

## Purpose

To consolidate duplicated layout and styling logic across functional libraries, centralize SCSS tokens (such as Material Design 3 mapping and visual density mixins), and provide a unified, standardized set of shared Angular UI components. This architectural refactor minimizes redundancy, prevents styling drift, and guarantees a consistent visual density scaling language across the `taro-debugger-frontend` application.

## Scope

**In Scope**:
- Auditing existing functional libraries to adopt the already-implemented `TaroEmptyState` component for consistent empty data visualization.
- Centralizing core SCSS tokens, Material Design 3 (M3) color mappings, and visual density mixins into `@taro/ui-shared`.
- Auditing existing functional libraries for duplicated layout and styling logic, removing ad-hoc styles in favor of the shared library.
- Migrating at least one functional panel (e.g., the Debugger Console or Editor) to utilize the new shared components to validate the integration.
- Implementing unit tests for the shared components with a specific focus on visual density scaling.

**Out of Scope**:
- A complete visual redesign of the debugger application.
- Migrating all functional panels simultaneously.
- Altering the core DAP protocol integration or reactive state logic unrelated to UI standardization.

## Behavior

1. **Centralized SCSS Architecture**:
   The `@taro/ui-shared` library acts as the Single Source of Truth for all SCSS tokens. Applications and functional libraries will consume these tokens for consistency, avoiding ad-hoc hardcoded values.
2. **Standardized UI Components**:
   - `TaroEmptyState`: Provides a centralized visual presentation for panels when data is missing or a session is inactive.
3. **Density Scaling**:
   All components must respect visual density mixins, ensuring they render correctly regardless of the host environment's density preferences (e.g., compact versus standard mode).

## Acceptance Criteria

- [ ] Functional libraries have been audited; redundant layout and styling logic has been removed and replaced with `@taro/ui-shared` imports.
- [ ] SCSS tokens (M3 mappings and Density Mixins) are successfully centralized in the `@taro/ui-shared` library.
- [ ] Existing ad-hoc empty states across functional panels are migrated to use the existing `TaroEmptyState` component.
- [ ] Comprehensive unit tests are written for all shared components, specifically verifying the correct application of visual density scaling rules.
- [ ] At least one functional panel is successfully migrated to use the new shared library components without functional or visual regression.
