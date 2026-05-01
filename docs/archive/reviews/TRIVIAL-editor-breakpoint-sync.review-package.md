---
wi: TRIVIAL
title: "Fix: Synchronize Editor Breakpoints with Server Events"
author: Lead_Engineer
status: ready-for-review
skills-required: ["[DEV:ARCH] System Architecture", "[DEV:STATE] Reactive State Flows"]
---

# Review Package: TRIVIAL-editor-breakpoint-sync

## 1. Acceptance Criteria

- [x] Update `EditorComponent.updateBreakpointDecorations` to render breakpoints from `verifiedBreakpoints` map.
- [x] Sync local breakpoints Set in `toggleBreakpoint` to handle server-initiated additions and removals.
- [x] [Test] Verify that a server-initiated breakpoint (e.g., from console) correctly appears in the Monaco editor.

## 2. Diff Summary

| File | Changed Lines | Nature of Change |
| :--- | :--- | :--- |
| `projects/ui-editor/src/lib/editor.component.ts` | L296–307, L346–371 | Updated decoration rendering to use a union of local intent and verified breakpoints. |
| `projects/ui-editor/src/lib/editor.component.spec.ts` | L278–333 | Added unit tests for server-initiated breakpoint sync and toggling. |

## 3. Edge Cases & Design Decisions

- **Decision**: Instead of mutating the local `breakpoints` Map inside `setVerifiedBreakpoints`, I updated `updateBreakpointDecorations` to compute the union of "local intent" and "server reality" during each render cycle. This avoids race conditions where a server response might overwrite a very recent user click that hasn't been synced yet.
- **Decision**: `toggleBreakpoint` now checks both local and verified state to determine if a click should "Add" or "Remove". If a breakpoint exists in either, it is removed from the local intent Set, which then triggers a sync to remove it from the server.

## 4. Tests Added

| File | Suite | Test Case |
| :--- | :--- | :--- |
| `projects/ui-editor/src/lib/editor.component.spec.ts` | `Server-Initiated Breakpoint Sync` | should render breakpoints from verifiedBreakpoints even if not in local intent set |
| `projects/ui-editor/src/lib/editor.component.spec.ts` | `Server-Initiated Breakpoint Sync` | should remove breakpoint when toggling a server-initiated breakpoint |

## 5. Spec-Plan Updates

> None (Trivial bug fix).

## 6. Self-Verification

```text
     ✓ Server-Initiated Breakpoint Sync (2)
       ✓ should render breakpoints from verifiedBreakpoints even if not in local intent set 103ms
       ✓ should remove breakpoint when toggling a server-initiated breakpoint 3ms

 Test Files  1 passed (1)
      Tests  11 passed (11)
```
