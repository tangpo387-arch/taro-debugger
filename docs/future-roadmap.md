---
title: Future Roadmap v1.1+
scope: future features, backlog
audience: [Product_Architect, Lead_Engineer]
last_updated: 2026-03-28
related:
  - docs/work-items.md
  - docs/system-specification.md
---

# DAP Debugger Frontend — Future Roadmap

This document outlines features scheduled for v1.1 and beyond. These items are tracked separately from the primary v1.0 `work-items.md` to keep the v1.0 release scope strictly focused.

---

### V1.1-01: Local Variable Modification
<!-- status: pending | size: M | phase: 12 | depends: WI-18.2 -->
- **Size**: M
- **Description**: Allow users to modify the values of local variables during a stopped debug session.
- **Details**:
  - Implement a `setVariable` DAP request within `DapSessionService`.
  - Update `<app-variables>` tree component UI to support inline editing of variable values.
  - Ensure updated values correctly sync back to the debugged process and trigger a refresh of the `DapVariablesService` cache.
- **Dependencies**: WI-18.1, WI-18.2
- **Status**: ⏳ Pending
