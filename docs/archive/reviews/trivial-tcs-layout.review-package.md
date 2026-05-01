---
wi: trivial
title: Fix Thread-Call-Stack Panel Layout Misalignment
author: Lead_Engineer
status: ready-for-review
skills-required: [DEV:VIS]
---

# Review Package: trivial-tcs-layout

## 1. Acceptance Criteria

- [x] Fix overlap between frame ID and function name in the Thread-Call-Stack panel.
- [x] Correct font-family token typos (`--font-family-mono` -> `--font-mono`) in the SCSS.
- [x] Ensure frame IDs have enough space (3+ digits) without shifting layout.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/ui-inspection/src/lib/thread-call-stack.component.scss` | L72, L92, L97–101 | Fixed font-family typos and increased `.frame-id` width/alignment. |

## 3. Edge Cases & Design Decisions

- **Decision**: Increased `.frame-id` width to `min-width: 32px` and set `text-align: right`. By using `min-width` instead of fixed `width`, the container can grow gracefully to accommodate extremely deep call stacks (e.g., `#10000+`) without overlapping the function name, while the `text-align: right` preserves vertical alignment for standard depths.
- **Decision**: Fixed `var(--font-family-mono)` to `var(--font-mono)`. The former was a typo that resulted in fallback to browser default mono fonts; the latter correctly consumes the project's design tokens.

## 4. Tests Added

N/A (Visual/CSS only). Component tests for `ThreadCallStackComponent` are currently missing in the codebase; verified that the library still compiles and existing tests in `ui-inspection` pass.

## 5. Spec-Plan Updates

N/A (Trivial fix).

## 6. Self-Verification

```bash
$ ng test ui-inspection --watch=false
...
✓ |ui-inspection| projects/ui-inspection/src/lib/dap-variables.service.spec.ts (27 tests) 121ms
✓ |ui-inspection| projects/ui-inspection/src/lib/breakpoints.component.spec.ts (4 tests) 29ms
 Test Files  2 passed (2)
      Tests  31 passed (31)
```
