---
title: Project Management Guide
scope: process, work-items, lifecycle, naming, feature-groups
audience: [Product_Architect, Lead_Engineer, Quality_Control_Reviewer]
last_updated: 2026-04-02
related:
  - docs/work-items.md
  - docs/design-decisions.md
  - docs/test-plan.md
---

# Project Management Guide

This document defines the authoritative process for managing work items in the `taro-debugger` project — from initial creation through implementation to final archival. All agents **must** follow this lifecycle to ensure consistency, traceability, and a clean project backlog.

See [project-roadmap.md](project-roadmap.md) for the visual dependency map of all work items.

---

## 1. Naming Conventions

All trackable units of work use a two-part identifier: a **prefix** and a **two-digit numeric index**.

### 1.1 Work Items (`WI-##`)

Used for any **functional implementation task** — UI features, service logic, refactors, or infrastructure work.

| Field | Rule |
| :--- | :--- |
| **Format** | `WI-` + zero-padded two-digit number (e.g., `WI-01`, `WI-18`) |
| **Sub-tasks** | Append a decimal suffix for tightly coupled splits (e.g., `WI-18.1`, `WI-18.2`) |
| **Assignment** | Assigned by `Product_Architect` when creating or splitting a work item |
| **Uniqueness** | Numbers are never reused, even after an item is retired from `work-items.md` |

### 1.2 Test Items (`TI-##`)

Used for any **automated test task** — unit tests, integration tests, or E2E test suites.

| Field | Rule |
| :--- | :--- |
| **Format** | `TI-` + zero-padded two-digit number (e.g., `TI-01`, `TI-05`) |
| **Relationship** | Each `TI` must reference one or more `WI` IDs in its `depends` field |
| **Uniqueness** | Numbers are never reused |

### 1.3 Traceability in Code

Every implementation or test file associated with a work item **must** include its ID in a top-level JSDoc comment:

```typescript
/**
 * TI-05 — Connection Error & Intent Detection Integration Tests
 * ref: docs/work-items.md, docs/test-plan.md §2.2
 */
```

---

## 1.4 Feature Groups

A **Feature Group** is a named domain category that groups related `WI-##` items by functional area. Feature Groups appear as `## Heading` sections in `docs/work-items.md`.

| Feature Group | Color | Item Range |
| :--- | :--- | :--- |
| Core Infrastructure | 🟢 Green | WI-01 ~ WI-08, WI-10, WI-11 |
| Backend Relay | 🔵 Blue | WI-09 |
| Debug Control UI | 🟠 Orange | — |
| Editor Advanced Interaction | 🟣 Purple | WI-12 ~ WI-14 |
| File Resource Management | 🟡 Yellow | WI-15 ~ WI-16 |
| Debug Info Panel | 🩷 Pink | WI-17 ~ WI-18 |
| Status & Console UI | 🔵 Cyan | WI-19 ~ WI-20 |
| Error Handling | 🟠 Deep Orange | WI-21 ~ WI-22 |
| Electron Desktop Mode | ⬜ Gray | WI-23 ~ WI-25 |
| Low-Level Inspection | 🟣 Indigo | WI-27 ~ WI-29 |
| Automation Tests | ⬜ White | TI-01 ~ TI-06 |

> [!NOTE]
> Feature Group names and color assignments defined in this table (§1.4) are the **SSOT** for the entire project.
> `docs/project-roadmap.md` derives all node fill colors from this table. New groups must be proposed by `Product_Architect` and registered here before being added to the roadmap.

---

## 2. Work Item Lifecycle

A work item travels through the following states. Only `Product_Architect` may create or promote items; only `Lead_Engineer` may set an item to `in-progress` or `done`.

```text
[Proposed] → [Pending] → [In Progress] → [Done] → [Archived]
```

### 2.1 State Definitions

| State | Symbol | Location | Description |
| :--- | :---: | :--- | :--- |
| **Proposed** | 💡 | Discussion / PR comment | Idea raised; not yet formally scoped |
| **Pending** | ⏳ | `docs/work-items.md` | Scoped & approved by `Product_Architect`; waiting for implementation |
| **In Progress** | 🔄 | `docs/work-items.md` | Actively being implemented by `Lead_Engineer` |
| **Done** | ✅ | `docs/work-items.md` | Implementation complete & reviewed; ready for retirement |
| **Retired** | 🗑️ | *(removed from work-items.md)* | Removed from active backlog; ID permanently reserved |

---

## 3. Creating a New Work Item

**Owner**: `Product_Architect`

### Step 1 — Assign an ID

Determine the next available `WI-##` or `TI-##` number by checking the highest existing ID in `work-items.md`. IDs of retired items are permanently reserved and must never be reused.

### Step 2 — Write the entry in `docs/work-items.md`

Add the item under its corresponding Feature Group section using the standard template:

```markdown
### WI-XX: [Short Descriptive Title]
<!-- status: pending | size: S|M|L | depends: WI-YY, WI-ZZ -->
- **Size**: S / M / L
- **Description**: One-sentence summary of what this item delivers.
- **Details**:
  - Specific sub-task or acceptance criterion 1
  - Specific sub-task or acceptance criterion 2
- **Dependencies**: WI-YY (or `none`)
- **Status**: ⏳ Pending
```

> [!IMPORTANT]
> The HTML comment `<!-- status: ... -->` on the second line is machine-readable metadata. Always keep it in sync with the visible `**Status**` field.

### Step 3 — Update the Dependency Map

Add the new WI node to the Mermaid dependency graph in `project-roadmap.md` and add a matching `style` entry (fill color aligned with its Feature Group).

---

## 4. Progressing a Work Item

**Owner**: `Lead_Engineer`

| Action | Required Update |
| :--- | :--- |
| Starting an item | Change `Status` field and HTML comment to `in-progress` / `🔄 In Progress` |
| Completing an item | Change `Status` field and HTML comment to `done` / `✅ Done` |
| Blocked by a dependency | Add a note under `**Details**` explaining the blocker; do NOT change status |

---

## 5. Retiring a Feature Group (Done → Retired)

Retirement is a **deliberate decision made by `Product_Architect`**, not an automatic consequence of all work being done.

### Step 1 — Remove the Feature Group block from `work-items.md`

Delete the entire Feature Group section (the `## Heading` + all `### WI-##` entries) from `docs/work-items.md`. WI IDs are permanently reserved and must not be reused.

### Step 2 — Update the Mermaid graph in `project-roadmap.md`

Update the retired WI nodes in the Mermaid dependency graph to use the distinct archived style (`stroke-dasharray: 5`) for historical reference.

### Step 3 — Record significant decisions (if any)

If the Feature Group introduced non-obvious implementation decisions, add an ADR entry to `docs/design-decisions.md` before removing the WI block.

### Step 4 — Verify cross-references

Ensure no other document (e.g., `test-plan.md`, `architecture.md`) contains a broken link to the retired items' old anchor in `work-items.md`.

> [!NOTE]
> Individual `TI-##` items follow the same retirement flow and are removed alongside the Feature Group they belong to.

---

## 6. Feature Group Completion Criteria

A Feature Group is considered complete and eligible for archival only when **all** of the following conditions are met:

- [ ] All `WI-##` items within the Feature Group have `Status: ✅ Done`.
- [ ] All associated `TI-##` items (if any) have `Status: ✅ Done` and all tests pass (`npm run test -- --watch=false`).
- [ ] `Quality_Control_Reviewer` has reviewed all implementation files for the Feature Group and raised no blocking issues.
- [ ] `Product_Architect` has confirmed the deliverable matches the corresponding section in `docs/system-specification.md`.

---

## 7. Quick Reference

```text
Create WI/TI   →  Product_Architect adds to work-items.md
Implement      →  Lead_Engineer sets status to In Progress
Complete       →  Lead_Engineer sets status to Done
Review         →  Quality_Control_Reviewer approves
Archive        →  Product_Architect removes Feature Group from work-items.md
               →  Records decisions in design-decisions.md (if applicable)
               →  Updates Mermaid graph in project-roadmap.md
```

---

## 8. Related Documents

| Document | Purpose |
| :--- | :--- |
| [`docs/work-items.md`](work-items.md) | Active backlog of pending and in-progress work items |
| [`docs/design-decisions.md`](design-decisions.md) | Architecture Decision Records (ADRs) for non-obvious implementation choices |
| [`docs/test-plan.md`](test-plan.md) | Detailed test strategy and TI scope definitions |
| [`docs/system-specification.md`](system-specification.md) | Feature requirements each WI must satisfy |
| [`.agents/project-context.md`](../.agents/project-context.md) | Agent navigation index — links to this document |
