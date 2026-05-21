---
wi: trivial
title: Unify Panel Background Colors
author: Lead_Engineer
status: ready-for-review
skills-required: [DEV:VIS]
---

# Review Package: Unify Panel Background Colors

## 1. Acceptance Criteria

- [x] Unify bottom consoles container (`.consoles-container`) background to `var(--mat-sys-surface-container)`.
- [x] Unify consoles viewport background to `var(--mat-sys-surface-container)`.
- [x] Unify active console tab background to `var(--mat-sys-surface-container)`.
- [x] Unify thread call stack tree container background to `var(--mat-sys-surface-container)`.
- [x] Update documentation `docs/architecture/visual-design.md` to specify these unified backgrounds, using a generic term for regular panels, and cover the Memory tab.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `docs/architecture/visual-design.md` | L95–99, L239–243 | Updated tables to specify `var(--mat-sys-surface-container)` for regular panels (explorer, inspectors, console viewport) and cover Memory tab |
| `projects/taro-debugger-frontend/src/app/debugger.component.scss` | L380 | Changed `.consoles-container` background-color to `var(--mat-sys-surface-container)` |
| `projects/ui-console/src/lib/console-shared.scss` | L8 | Changed `.console-viewport` background-color to `var(--mat-sys-surface-container)` |
| `projects/ui-console/src/lib/log-viewer/log-viewer.scss` | L55 | Changed `.mdc-tab--active` background-color to `var(--mat-sys-surface-container)` |
| `projects/ui-inspection/src/lib/thread-call-stack.component.scss` | L10 | Changed `.tree-container` background-color to `var(--mat-sys-surface-container)` |

## 3. Edge Cases & Design Decisions

- None. This is a purely visual/style update.

## 4. Tests Added

None. Visual/SCSS style changes only, no logic or typescript modifications.

## 5. Spec-Plan Updates

None.

## 6. Self-Verification

```
 Test Files  12 passed (12)
      Tests  103 passed (103)
   Start at  23:02:18
   Duration  12.18s
```
