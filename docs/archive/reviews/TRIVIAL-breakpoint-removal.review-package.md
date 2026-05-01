---
wi: TRIVIAL
title: "Fix: Handle Breakpoint Removal Event"
author: Lead_Engineer
status: ready-for-review
skills-required: ["[DEV:DAP] Protocol Implementation"]
---

# Review Package: TRIVIAL-breakpoint-removal

## 1. Acceptance Criteria

- [x] Handle `removed` reason in `handleTransportEvent` 'breakpoint' case
- [x] Update `breakpointsMap` and `breakpointsSubject`
- [x] Ensure UI reflects removal immediately
- [x] [Test] Verify that a server-initiated removal event correctly clears the breakpoint from the sidebar.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-session.service.ts` | L996–1007 | Added logic to handle `reason: 'removed'` in breakpoint events. |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | L809–858 | Added unit tests for breakpoint `changed` and `removed` events. |

## 3. Edge Cases & Design Decisions

- **Decision**: Used both `id` and `line` for matching during removal to ensure compatibility with adapters that might not provide stable IDs or might relocate lines.
- 🔍 **Inspect**: The `break` statement on L1005 — ensure it correctly exits the `case 'breakpoint'` block after removal to avoid falling through to the update logic.

## 4. Tests Added

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | `Breakpoint Events` | should update breakpoint state when changed event is received |
| `projects/dap-core/src/lib/session/dap-session.service.spec.ts` | `Breakpoint Events` | should remove breakpoint when removed event is received |

## 5. Spec-Plan Updates

> None (Trivial bug fix).

## 6. Self-Verification

```text
     ✓ Breakpoint Events (2)
       ✓ should update breakpoint state when changed event is received 1ms
       ✓ should remove breakpoint when removed event is received 1ms
     ✓ High-level DAP Methods (2)
       ✓ should send loadedSources request 1ms
       ✓ should send source request with arguments 1ms

 Test Files  1 passed (1)
      Tests  48 passed (48)
   Start at  12:39:11
   Duration  1.04s (transform 102ms, setup 242ms, import 79ms, tests 143ms, environment 446ms)
```
